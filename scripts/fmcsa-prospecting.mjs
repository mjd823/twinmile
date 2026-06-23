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
 */
async function queryCarriersByState(state, limit) {
  const select = 'dot_number,legal_name,dba_name,phy_city,phy_state,phy_zip,phone,power_units,total_drivers,classdef,email_address,carrier_operation,interstate_beyond_100_miles,hm_ind';

  // Filter for owner-operator profile:
  // - Active status (A)
  // - 1-3 drivers (owner-operator scale)
  // - 1-5 power units (small fleet)
  // - General freight (crgo_genfreight = X) — power-only target
  // - Authorized for hire (carrier_operation = C)
  // - No Hazmat (hm_ind = N)
  const where = `phy_state='${state}' AND status_code='A' AND total_drivers IN ('1','2','3') AND power_units IN ('1','2','3','4','5') AND crgo_genfreight='X' AND carrier_operation='C' AND hm_ind='N'`;

  const params = new URLSearchParams({
    '$select': select,
    '$where': where,
    '$limit': String(limit),
    '$order': 'dot_number DESC', // newer registrations first
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

    return await response.json();
  } catch (err) {
    console.error(`[fmcsa-prospecting] Error querying ${state}:`, err.message);
    return [];
  }
}

/**
 * Score a carrier based on real FMCSA data.
 */
function scoreCarrier(carrier) {
  let score = 0;
  const signals = [];
  const analysis = [];

  // Authorized for hire
  if (carrier.classdef && carrier.classdef.includes('AUTHORIZED FOR HIRE')) {
    score += 25;
    signals.push('Authorized for hire');
  } else if (carrier.classdef && carrier.classdef.includes('AUTHORIZED')) {
    score += 15;
  }

  // Interstate operation
  if (carrier.interstate_beyond_100_miles && carrier.interstate_beyond_100_miles !== '0') {
    score += 15;
    signals.push('Interstate operations');
  }

  // Owner-operator scale (1 power unit = true owner-operator)
  const units = parseInt(carrier.power_units || '0', 10);
  const drivers = parseInt(carrier.total_drivers || '0', 10);

  if (units === 1) {
    score += 20;
    signals.push('Single power unit (true owner-operator)');
    analysis.push('Solo owner-operator — ideal power-only target');
  } else if (units >= 2 && units <= 3) {
    score += 15;
    signals.push(`${units} power units (small fleet owner)`);
  } else if (units >= 4 && units <= 5) {
    score += 8;
    signals.push(`${units} power units (small fleet)`);
  }

  if (drivers === 1) {
    score += 10;
    signals.push('Owner-driver (drives own truck)');
  } else if (drivers >= 2 && drivers <= 3) {
    score += 5;
  }

  // Has phone number (contactable)
  if (carrier.phone && carrier.phone.length >= 10) {
    score += 10;
    signals.push('Phone number available');
  }

  // Has email (directly contactable — rare but valuable)
  if (carrier.email_address && carrier.email_address.includes('@') && !carrier.email_address.includes('example')) {
    score += 15;
    signals.push('Email address available');
  }

  // No Hazmat (already filtered, but double-check)
  if (carrier.hm_ind === 'N') {
    score += 5;
  }

  // DBA name suggests active branding/marketing
  if (carrier.dba_name && carrier.dba_name !== carrier.legal_name) {
    score += 5;
    signals.push(`DBA: ${carrier.dba_name}`);
  }

  score = Math.max(0, Math.min(100, score));

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

    // Query each target state for real owner-operators
    const perState = Math.ceil(MAX_RESULTS / TARGET_STATES.length) + 5;
    let allCarriers = [];

    for (const state of TARGET_STATES) {
      console.log(`[fmcsa-prospecting] Querying FMCSA census for ${state}...`);
      const carriers = await queryCarriersByState(state, perState);
      console.log(`[fmcsa-prospecting]   Found ${carriers.length} real carriers in ${state}`);
      allCarriers.push(...carriers);
      await sleep(500); // Rate limit between states
    }

    console.log(`[fmcsa-prospecting] Total real carriers found: ${allCarriers.length}`);

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