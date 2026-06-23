#!/usr/bin/env node
/**
 * FMCSA Real Prospecting Cron Script (v2 — Census API)
 *
 * This script queries the FMCSA Company Census File via the public
 * Socrata API at data.transportation.gov — the same data source
 * freight brokers and logistics platforms use.
 *
 * It pulls REAL motor carriers with REAL DOT numbers, names, phone
 * numbers, emails, and addresses — no AI hallucination, no fake data.
 *
 * Target: Owner-operators (1-5 power units, 1-3 drivers) in target
 * states who haul general freight and are authorized for hire.
 *
 * Run: node scripts/fmcsa-prospecting.mjs
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { MongoClient } from 'mongodb';

const CENSUS_API = 'https://data.transportation.gov/resource/az4n-8mr2.json';
const MAX_RESULTS = parseInt(process.env.FMCSA_MAX_RESULTS || '30', 10);
const TARGET_STATES = (process.env.FMCSA_TARGET_STATES || 'TX,LA,CA,GA,TN').split(',');
const APP_TOKEN = process.env.SOCRATA_APP_TOKEN || ''; // Optional, for higher rate limits

if (!process.env.MONGODB_URI) {
  console.error('[fmcsa-prospecting] MONGODB_URI not set');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Query the FMCSA Census API for real owner-operators in target states.
 * Returns actual carriers with DOT numbers, names, phones, emails, etc.
 * Now excludes DOT numbers already in our DB and randomizes queries
 * to get DIFFERENT carriers each run instead of the same ones.
 */
async function queryCarriersByState(state, limit, existingDOTs = new Set()) {
  const select = 'dot_number,legal_name,dba_name,phy_city,phy_state,phy_zip,phone,power_units,total_drivers,classdef,email_address,carrier_operation,interstate_beyond_100_miles,hm_ind,mcs150_date,mcs150_mileage,add_date';

  // Filter for owner-operator profile:
  // - Active status (A)
  // - 1-3 drivers (owner-operator scale)
  // - 1-5 power units (small fleet)
  // - General freight (crgo_genfreight = X) — power-only target
  // - Authorized for hire (carrier_operation = C)
  // - No Hazmat (hm_ind = N)
  let where = `phy_state='${state}' AND status_code='A' AND total_drivers IN ('1','2','3') AND power_units IN ('1','2','3','4','5') AND crgo_genfreight='X' AND carrier_operation='C' AND hm_ind='N'`;

  // RANDOMIZE: Use different ordering strategies each run to get different carriers
  // This prevents getting the same "newest" carriers every time
  const orderStrategies = [
    'dot_number DESC',           // Newest registrations
    'dot_number ASC',            // Oldest registrations (established carriers)
    'mcs150_mileage DESC',       // High-mileage carriers (more active)
    'mcs150_date DESC',          // Recently updated MCS-150
    'add_date DESC',             // Recently added
    'total_drivers ASC, dot_number DESC', // Solo drivers first
  ];
  const randomOrder = orderStrategies[Math.floor(Math.random() * orderStrategies.length)];

  // RANDOMIZE: Add a random offset to get different carriers from deeper in the results
  // The API returns up to 1000 records, we sample from different points
  const randomOffset = Math.floor(Math.random() * 200); // 0-200 offset

  // Add a random filter to vary the results — alternate between different driver/unit combinations
  const driverFilters = [
    "total_drivers='1'",                     // Solo owner-operators
    "total_drivers='2'",                     // Small teams
    "total_drivers IN ('1','2')",            // Mix
    "power_units='1'",                       // Single truck
    "power_units IN ('2','3')",              // Small fleet
  ];
  const randomDriverFilter = driverFilters[Math.floor(Math.random() * driverFilters.length)];

  // Replace the base driver filter with randomized one for variety
  where = `phy_state='${state}' AND status_code='A' AND ${randomDriverFilter} AND power_units IN ('1','2','3','4','5') AND crgo_genfreight='X' AND carrier_operation='C' AND hm_ind='N'`;

  const params = new URLSearchParams({
    '$select': select,
    '$where': where,
    '$limit': String(limit + randomOffset),
    '$order': randomOrder,
  });

  if (APP_TOKEN) {
    params.append('$$app_token', APP_TOKEN);
  }

  const url = `${CENSUS_API}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TwinMile-Prospecting/1.0',
        'Accept': 'application/json',
        ...(APP_TOKEN ? { 'X-App-Token': APP_TOKEN } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(`[fmcsa-prospecting] API error for ${state}: ${response.status}`);
      return [];
    }

    const allResults = await response.json();

    // Filter out DOT numbers already in our DB
    const newCarriers = allResults.filter(c => !existingDOTs.has(c.dot_number));

    // If we got mostly duplicates, try a deeper slice
    if (newCarriers.length < limit && allResults.length > randomOffset) {
      const deeperSlice = allResults.slice(randomOffset).filter(c => !existingDOTs.has(c.dot_number));
      if (deeperSlice.length > newCarriers.length) {
        console.log(`[fmcsa-prospecting]   ${state}: Using deeper slice (${deeperSlice.length} new vs ${newCarriers.length} from top)`);
        return deeperSlice.slice(0, limit);
      }
    }

    console.log(`[fmcsa-prospecting]   ${state}: ${allResults.length} found, ${newCarriers.length} new (excluded ${allResults.length - newCarriers.length} duplicates)`);
    return newCarriers.slice(0, limit);
  } catch (err) {
    console.error(`[fmcsa-prospecting] Error querying ${state}:`, err.message);
    return [];
  }
}

/**
 * Score a carrier based on REAL FMCSA data — rigorous qualification, not just "active = qualified".
 * A carrier must genuinely demonstrate they're a good power-only fit AND reachable.
 */
function scoreCarrier(carrier) {
  let score = 0;
  const signals = [];
  const analysis = [];
  const disqualifiers = [];

  // === AUTHORITY (max 15) — not just "has authority", but verified active ===
  if (carrier.classdef && carrier.classdef.includes('AUTHORIZED FOR HIRE')) {
    score += 15;
    signals.push('Active for-hire authority');
  } else if (carrier.classdef && carrier.classdef.includes('AUTHORIZED')) {
    score += 8;
  } else {
    analysis.push('No active for-hire authority — lower priority');
    score += 0;
  }

  // === INTERSTATE OPERATION (max 10) — must actually run interstate ===
  if (carrier.interstate_beyond_100_miles && carrier.interstate_beyond_100_miles !== '0') {
    score += 10;
    signals.push('Interstate operations (long-haul capable)');
  }

  // === FLEET SIZE (max 15) — true owner-operators preferred ===
  const units = parseInt(carrier.power_units || '0', 10);
  const drivers = parseInt(carrier.total_drivers || '0', 10);

  if (units === 1 && drivers === 1) {
    score += 15;
    signals.push('True owner-operator (1 truck, 1 driver)');
    analysis.push('Solo owner-operator — ideal power-only target');
  } else if (units === 1) {
    score += 12;
    signals.push('Single power unit');
  } else if (units >= 2 && units <= 3) {
    score += 8;
    signals.push(`${units} power units (small fleet)`);
    analysis.push('Small fleet — may need multi-truck lease');
  } else if (units >= 4 && units <= 5) {
    score += 4;
    signals.push(`${units} power units (mid-small fleet)`);
  }

  // === MILEAGE / ACTIVITY (max 15) — how active is this carrier? ===
  const mileage = parseInt(carrier.mcs150_mileage || '0', 10);
  if (mileage > 100000) {
    score += 15;
    signals.push(`High activity (${(mileage/1000).toFixed(0)}K miles/year)`);
    analysis.push('Very active carrier — likely running loads regularly');
  } else if (mileage > 50000) {
    score += 10;
    signals.push(`Moderate activity (${(mileage/1000).toFixed(0)}K miles/year)`);
  } else if (mileage > 10000) {
    score += 5;
    signals.push(`Low activity (${(mileage/1000).toFixed(0)}K miles/year)`);
  } else if (mileage > 0) {
    score += 2;
    analysis.push('Minimal mileage reported — may be new or part-time');
  } else {
    score -= 5;
    disqualifiers.push('No mileage reported — may be inactive or paper-only carrier');
  }

  // === MCS-150 RECENCY (max 10) — recent update = actively managed ===
  const mcs150Date = carrier.mcs150_date?.toString().substring(0, 8);
  if (mcs150Date) {
    const updateYear = parseInt(mcs150Date.substring(0, 4), 10);
    const yearsSinceUpdate = new Date().getFullYear() - updateYear;
    if (yearsSinceUpdate <= 1) {
      score += 10;
      signals.push('MCS-150 updated within 1 year (actively managed)');
    } else if (yearsSinceUpdate <= 2) {
      score += 5;
    } else {
      score -= 5;
      disqualifiers.push(`MCS-150 not updated in ${yearsSinceUpdate} years — may be inactive`);
    }
  }

  // === CONTACTABILITY (max 20) — can we actually reach them? ===
  let contactScore = 0;
  if (carrier.phone && carrier.phone.length >= 10) {
    contactScore += 10;
    signals.push('Phone number available');
  }
  if (carrier.email_address && carrier.email_address.includes('@') && !carrier.email_address.includes('example')) {
    contactScore += 10;
    signals.push('Email address available (direct outreach possible)');
  } else if (carrier.email_address && carrier.email_address.includes('example')) {
    disqualifiers.push('Placeholder email only');
  }
  score += contactScore;

  // If NO contact info at all, disqualify — can't reach them
  if (contactScore === 0) {
    score -= 15;
    disqualifiers.push('No phone or email — cannot contact');
  }

  // === YEARS IN OPERATION (max 10) — established = more reliable ===
  const addDate = carrier.add_date?.toString().substring(0, 8);
  if (addDate) {
    const regYear = parseInt(addDate.substring(0, 4), 10);
    const yearsInOp = new Date().getFullYear() - regYear;
    if (yearsInOp >= 3) {
      score += 10;
      signals.push(`${yearsInOp} years in operation (established)`);
    } else if (yearsInOp >= 1) {
      score += 5;
      signals.push(`${yearsInOp} year(s) in operation`);
    } else {
      score += 2;
      analysis.push('New carrier — less track record');
    }
  }

  // === DBA NAME (max 5) — branded business suggests professionalism ===
  if (carrier.dba_name && carrier.dba_name !== carrier.legal_name && carrier.dba_name !== 'None') {
    score += 5;
    signals.push(`DBA: ${carrier.dba_name} (branded business)`);
  }

  // === DISQUALIFIERS — apply penalties ===
  if (disqualifiers.length > 0) {
    analysis.push(`Concerns: ${disqualifiers.join('; ')}`);
  }

  score = Math.max(0, Math.min(100, score));

  // If there are major disqualifiers, cap the score lower
  if (disqualifiers.some(d => d.includes('inactive') || d.includes('cannot contact'))) {
    score = Math.min(score, 45); // Can't be qualified if unreachable or inactive
  }

  return { score, signals, analysis };
}

async function main() {
  console.log('[fmcsa-prospecting] Starting real FMCSA census prospecting...');
  console.log(`[fmcsa-prospecting] Target: ${MAX_RESULTS} prospects in: ${TARGET_STATES.join(', ')}`);

  const client = new MongoClient(process.env.MONGODB_URI, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    maxPoolSize: 2,
    appName: 'twinmile-fmcsa-prospecting-cron',
  });

  try {
    await client.connect();
    const db = client.db();
    console.log('[fmcsa-prospecting] Connected to database');

    // Load existing DOT numbers from DB to exclude duplicates
    const existingDOTArray = await db.collection('outbound_prospects').distinct('dotNumber');
    const existingDOTs = new Set(existingDOTArray.filter(Boolean));
    console.log(`[fmcsa-prospecting] Excluding ${existingDOTs.size} existing DOT numbers from DB`);

    // Query each target state for real owner-operators
    const perState = Math.ceil(MAX_RESULTS / TARGET_STATES.length) + 10; // Request more to account for dedup
    let allCarriers = [];

    for (const state of TARGET_STATES) {
      console.log(`[fmcsa-prospecting] Querying FMCSA census for ${state}...`);
      const carriers = await queryCarriersByState(state, perState, existingDOTs);
      console.log(`[fmcsa-prospecting]   Found ${carriers.length} NEW real carriers in ${state}`);
      allCarriers.push(...carriers);
      await sleep(500); // Rate limit between states
    }

    console.log(`[fmcsa-prospecting] Total NEW real carriers found: ${allCarriers.length}`);

    // Score and deduplicate
    const scored = allCarriers.map(c => {
      const { score, signals, analysis } = scoreCarrier(c);
      return { ...c, aiScore: score, interestSignals: signals, aiAnalysis: analysis.join('; ') };
    });

    // Sort by score descending, take top MAX_RESULTS
    scored.sort((a, b) => b.aiScore - a.aiScore);
    const topProspects = scored.slice(0, MAX_RESULTS);

    // Save to database — deduplicate by DOT number
    let savedCount = 0;
    const enriched = topProspects.map((c, i) => ({
      id: `fmcsa_${Date.now()}_${i}`,
      name: c.legal_name,
      dbaName: c.dba_name || null,
      contact: {
        phone: c.phone || null,
        email: c.email_address || null,
      },
      location: `${c.phy_city}, ${c.phy_state} ${c.phy_zip}`,
      city: c.phy_city,
      state: c.phy_state,
      zip: c.phy_zip,
      equipment: 'Power-only / General Freight',
      experience: `${c.total_drivers} driver${c.total_drivers > 1 ? 's' : ''}, ${c.power_units} power unit${c.power_units > 1 ? 's' : ''}`,
      authorityStatus: 'own',
      currentCarrier: c.dba_name || 'Independent owner-operator',
      lanes: getLanesForState(c.phy_state),
      interestSignals: c.interestSignals,
      source: 'fmcsa_census_api',
      sourceUrl: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.dot_number}`,
      aiScore: c.aiScore,
      aiAnalysis: c.aiAnalysis || 'Real FMCSA-verified carrier — active, authorized for hire, general freight',
      status: c.aiScore >= 75 ? 'qualified' : 'new',
      type: 'outbound_driver',
      dotNumber: c.dot_number,
      classdef: c.classdef,
      powerUnits: parseInt(c.power_units || '0', 10),
      drivers: parseInt(c.total_drivers || '0', 10),
      interstate: c.interstate_beyond_100_miles === '1',
      createdAt: new Date().toISOString(),
      enrichedAt: new Date().toISOString(),
    }));

    if (enriched.length > 0) {
      const existing = await db.collection('outbound_prospects')
        .find({ dotNumber: { $in: enriched.map(e => e.dotNumber) } })
        .toArray();
      const existingDOTs = new Set(existing.map(e => e.dotNumber));
      const newProspects = enriched.filter(e => !existingDOTs.has(e.dotNumber));

      if (newProspects.length > 0) {
        const result = await db.collection('outbound_prospects').insertMany(newProspects);
        savedCount = result.insertedCount;
      }
    }

    const qualifiedCount = topProspects.filter(c => c.aiScore >= 75).length;

    // Log agent activity
    await db.collection('agent_activity').insertOne({
      action: 'fmcsa_prospecting',
      agent: { name: 'Sofia Rodriguez', role: 'Lead Generation Specialist', department: 'Sales' },
      result: {
        carriersFound: allCarriers.length,
        qualified: qualifiedCount,
        saved: savedCount,
        targetStates: TARGET_STATES,
        dataSource: 'FMCSA Company Census API (data.transportation.gov)',
      },
      success: true,
      createdAt: new Date(),
    });

    console.log(`[fmcsa-prospecting] Done: ${allCarriers.length} found, ${qualifiedCount} qualified, ${savedCount} saved`);
    console.log('[fmcsa-prospecting] Top prospects:');
    topProspects.slice(0, 8).forEach(c => {
      console.log(`  - ${c.legal_name} (DOT ${c.dot_number}) | ${c.phy_city}, ${c.phy_state} | Score: ${c.aiScore} | ${c.power_units} unit, ${c.total_drivers} driver | Phone: ${c.phone || 'N/A'} | Email: ${c.email_address || 'N/A'}`);
    });
  } finally {
    await client.close();
  }
}

function getLanesForState(state) {
  const lanes = {
    TX: ['TX-LA', 'TX-CA', 'TX-GA', 'TX-TN', 'Regional TX'],
    LA: ['TX-LA', 'LA-TX', 'Gulf Coast'],
    CA: ['TX-CA', 'CA-TX', 'West Coast'],
    GA: ['TX-GA', 'GA-TN', 'Southeast'],
    TN: ['TX-TN', 'TN-GA', 'Mid-South'],
  };
  return lanes[state] || [];
}

main().catch(err => {
  console.error('[fmcsa-prospecting] Fatal error:', err);
  process.exit(1);
});