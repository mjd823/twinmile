/**
 * FMCSA-Based Real Prospecting Service
 *
 * Instead of asking an LLM to hallucinate prospect data, this service
 * queries the FMCSA SAFER public database for REAL motor carriers.
 *
 * The FMCSA Company Snapshot is a free, public government resource:
 * https://safer.fmcsa.dot.gov/CompanySnapshot.aspx
 *
 * This gives us REAL carriers with REAL DOT numbers, REAL operating
 * authority status, and REAL safety ratings — not fabricated profiles.
 *
 * For carriers found, we can then:
 * 1. Verify their authority is active
 * 2. Check their operation classification (interstate, for-hire)
 * 3. Check cargo carried (to identify power-only / general freight)
 * 4. Check their safety rating
 * 5. Score them based on real data
 *
 * NOTE: FMCSA SAFER does NOT provide email addresses (that's by design —
 * it's a safety database, not a marketing list). The real outreach flow
 * is: find carrier → look up their business phone/address from the
 * registration → call or mail them → invite to onboarding portal.
 *
 * This is how real freight brokers recruit owner-operators.
 */

import { MongoClient } from 'mongodb';

const SAFER_BASE = 'https://safer.fmcsa.dot.gov';

export interface FMCSACarrier {
  dotNumber: string;
  legalName: string;
  dbaName?: string;
  physicalAddress: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  operationClassification: string[];
  cargoCarried: string[];
  safetyRating: string;
  outOfService: boolean;
  powerUnits: number;
  drivers: number;
  mcNumber?: string;
  entityType: string; // 'Carrier', 'Broker', 'Shipper', etc.
  authorityStatus: string; // 'AUTHORIZED', 'NOT_AUTHORIZED', 'PENDING'
  sourceUrl: string;
}

export interface ScoredCarrier extends FMCSACarrier {
  aiScore: number;
  aiAnalysis: string;
  interestSignals: string[];
  authorityStatusNormalized: 'own' | 'lease' | 'unknown';
  lanes: string[];
  equipment: string;
  experience: string;
}

/**
 * Scrape a carrier's Company Snapshot from FMCSA SAFER.
 * This is public government data, freely accessible.
 */
export async function lookupCarrierByDOT(dotNumber: string): Promise<FMCSACarrier | null> {
  try {
    const url = `${SAFER_BASE}/CompanySnapshot.aspx?dotNumber=${dotNumber}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TwinMile-Prospecting/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    return parseSAFERHTML(html, dotNumber, url);
  } catch (error) {
    console.error(`[FMCSA] Error looking up DOT ${dotNumber}:`, error);
    return null;
  }
}

/**
 * Parse the SAFER Company Snapshot HTML page to extract carrier data.
 */
function parseSAFERHTML(html: string, dotNumber: string, sourceUrl: string): FMCSACarrier | null {
  // Extract fields from HTML tables — SAFER uses consistent formatting
  const getText = (label: string): string | null => {
    const regex = new RegExp(`${label}.*?<td[^>]*>(.*?)</td>`, 'is');
    const match = html.match(regex);
    if (!match) return null;
    return match[1].replace(/<[^>]*>/g, '').trim();
  };

  const legalName = getText('Legal Name');
  if (!legalName) return null;

  const dbaName = getText('DBA Name') || undefined;
  const city = getText('City') || '';
  const state = getText('State') || '';
  const zip = getText('ZIP Code') || '';
  const phone = getText('Phone') || undefined;
  const safetyRating = getText('Safety Rating') || 'NOT_RATED';
  const powerUnits = parseInt(getText('Power Units') || '0', 10);
  const drivers = parseInt(getText('Drivers') || '0', 10);
  const physicalAddress = getText('Physical Address') || '';

  // Operation classification — multiple checkboxes in SAFER
  const operationClassification: string[] = [];
  const opClassRegex = /<td[^>]*>([^<]*(?:Interstate|Intrastate|HM|Passenger)[^<]*)<\/td>/gi;
  let opMatch;
  while ((opMatch = opClassRegex.exec(html)) !== null) {
    operationClassification.push(opMatch[1].trim());
  }

  // Cargo carried — multiple checkboxes
  const cargoCarried: string[] = [];
  const cargoRegex = new RegExp(
    '<td[^>]*>([^<]*(?:General Freight|Household|Metal|Motor Vehicles|Drive.Tow|Log|Building Materials|Produce|Meat|Refrigerated|Liquid.Gas|Intermodal|Passengers|Livestock|Grain|Coal|Sand|Other)[^<]*)<\\/td>',
    'gi'
  );
  let cargoMatch;
  while ((cargoMatch = cargoRegex.exec(html)) !== null) {
    cargoCarried.push(cargoMatch[1].trim());
  }

  // Out of service status
  const outOfService = html.includes('OUT OF SERVICE');

  // MC Number
  const mcMatch = html.match(/MC[- ]?(\d+)/);
  const mcNumber = mcMatch ? `MC-${mcMatch[1]}` : undefined;

  // Entity type
  let entityType = 'Carrier';
  if (html.includes('Broker')) entityType = 'Broker/Carrier';
  if (html.includes('Shipper')) entityType = 'Shipper/Carrier';

  // Authority status
  let authorityStatus = 'NOT_AUTHORIZED';
  if (html.includes('AUTHORIZED for Property')) authorityStatus = 'AUTHORIZED';
  if (html.includes('PENDING')) authorityStatus = 'PENDING';

  return {
    dotNumber,
    legalName,
    dbaName,
    physicalAddress,
    city,
    state,
    zip,
    phone,
    operationClassification,
    cargoCarried,
    safetyRating,
    outOfService,
    powerUnits,
    drivers,
    mcNumber,
    entityType,
    authorityStatus,
    sourceUrl,
  };
}

/**
 * Score a carrier based on real FMCSA data.
 *
 * Scoring criteria (0-100):
 * - Active interstate authority: +20
 * - Authorized for property/for-hire: +15
 * - Carries general freight (power-only fit): +15
 * - NOT out of service: +15
 * - Has 1-5 power units (small fleet / owner-operator): +15
 * - Has 1-3 drivers (owner-operator size): +10
 * - Satisfactory safety rating: +10
 * - Located in target state: +5
 * - Has phone number (contactable): +5
 * - Deductions for HM/passenger (not our target): -20
 */
export function scoreCarrier(carrier: FMCSACarrier, targetStates: string[] = ['TX', 'LA', 'CA', 'GA', 'TN']): ScoredCarrier {
  let score = 0;
  const signals: string[] = [];
  const analysis: string[] = [];

  // Active authority
  if (carrier.authorityStatus === 'AUTHORIZED') {
    score += 20;
    signals.push('Active interstate authority');
    analysis.push('Has active for-hire authority — can operate interstate');
  } else if (carrier.authorityStatus === 'PENDING') {
    score += 5;
    analysis.push('Authority pending — not yet ready');
  }

  // Interstate operation
  if (carrier.operationClassification.some(c => c.includes('Interstate'))) {
    score += 10;
    signals.push('Interstate carrier');
  }

  // Cargo type — general freight is our power-only target
  if (carrier.cargoCarried.some(c => c.includes('General Freight'))) {
    score += 15;
    signals.push('Hauls general freight (power-only fit)');
  }

  // Not out of service
  if (!carrier.outOfService) {
    score += 15;
  } else {
    score -= 50;
    analysis.push('OUT OF SERVICE — disqualifying');
  }

  // Fleet size — owner-operators have 1-5 power units
  if (carrier.powerUnits >= 1 && carrier.powerUnits <= 5) {
    score += 15;
    signals.push(`Small fleet (${carrier.powerUnits} power unit${carrier.powerUnits > 1 ? 's' : ''})`);
    analysis.push('Owner-operator scale operation');
  } else if (carrier.powerUnits > 5 && carrier.powerUnits <= 20) {
    score += 5;
    analysis.push('Small-to-mid fleet');
  } else if (carrier.powerUnits === 0) {
    score -= 10;
    analysis.push('No power units registered');
  }

  // Driver count
  if (carrier.drivers >= 1 && carrier.drivers <= 3) {
    score += 10;
    signals.push(`${carrier.drivers} driver${carrier.drivers > 1 ? 's' : ''} registered`);
  }

  // Safety rating
  if (carrier.safetyRating === 'Satisfactory') {
    score += 10;
    signals.push('Satisfactory safety rating');
  } else if (carrier.safetyRating === 'Conditional') {
    score += 2;
    analysis.push('Conditional safety rating — needs review');
  }

  // Target state
  if (targetStates.includes(carrier.state)) {
    score += 5;
    signals.push(`Located in ${carrier.state} (target state)`);
  }

  // Has phone — contactable
  if (carrier.phone && carrier.phone !== 'None') {
    score += 5;
    signals.push('Phone number available for outreach');
  }

  // Disqualify for Hazmat or Passenger (not our target)
  if (carrier.cargoCarried.some(c => c.includes('Hazmat') || c.includes('Passenger'))) {
    score -= 20;
    analysis.push('Hazmat/Passenger — not a power-only general freight target');
  }

  // Cap score at 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine lanes from state
  const stateLanes: Record<string, string[]> = {
    TX: ['TX-LA', 'TX-CA', 'TX-GA', 'TX-TN', 'Regional TX'],
    LA: ['TX-LA', 'LA-TX', 'Gulf Coast'],
    CA: ['TX-CA', 'CA-TX', 'West Coast'],
    GA: ['TX-GA', 'GA-TN', 'Southeast'],
    TN: ['TX-TN', 'TN-GA', 'Mid-South'],
  };

  const equipment = carrier.cargoCarried.includes('General Freight')
    ? 'Power-only / General Freight'
    : carrier.cargoCarried[0] || 'Not specified';

  const experience = carrier.powerUnits >= 1
    ? `${Math.max(carrier.drivers, carrier.powerUnits)} unit${Math.max(carrier.drivers, carrier.powerUnits) > 1 ? 's' : ''} operating`
    : 'Not specified';

  return {
    ...carrier,
    aiScore: score,
    aiAnalysis: analysis.join('; ') || 'Real FMCSA-verified carrier data',
    interestSignals: signals,
    authorityStatusNormalized: carrier.authorityStatus === 'AUTHORIZED' ? 'own' : 'unknown',
    lanes: stateLanes[carrier.state] || [],
    equipment,
    experience,
  };
}

/**
 * Generate a list of DOT numbers to check.
 *
 * Since FMCSA SAFER only allows single-carrier lookups (not bulk searches),
 * we use a range-based approach: FMCSA DOT numbers are sequential, and
 * newer registrations have higher numbers. We sample from a range of
 * recent DOT numbers (3,000,000-3,500,000 are registrations from
 * approximately the last 3-5 years — likely active small carriers).
 *
 * Each run picks random DOT numbers from this range, checks if they're
 * active carriers in our target states with the right profile.
 *
 * This is a slow but HONEST approach — we're querying real government
 * data for real carriers, not hallucinating.
 */
export function generateDOTSample(count: number, seedRange: [number, number] = [3000000, 3500000]): string[] {
  const [min, max] = seedRange;
  const dotNumbers: string[] = [];
  const used = new Set<number>();

  while (dotNumbers.length < count && used.size < (max - min)) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    if (used.has(num)) continue;
    used.add(num);
    dotNumbers.push(String(num));
  }

  return dotNumbers;
}

/**
 * Full prospecting run: sample DOT numbers, look up real carriers,
 * score them, and save qualified ones to the database.
 */
export async function runFMCSAProspecting(
  mongoUri: string,
  options: { maxResults?: number; targetStates?: string[] } = {}
): Promise<{
  checked: number;
  found: number;
  qualified: number;
  saved: number;
  carriers: ScoredCarrier[];
}> {
  const maxResults = options.maxResults || 30;
  const targetStates = options.targetStates || ['TX', 'LA', 'CA', 'GA', 'TN'];

  console.log(`[FMCSA] Starting real carrier prospecting — target: ${maxResults} prospects`);

  const client = new MongoClient(mongoUri, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    maxPoolSize: 2,
    appName: 'twinmile-fmcsa-prospecting',
  });

  try {
    await client.connect();
    const db = client.db();

    // Generate DOT sample — we check 3x the target since many won't match
    const dotSample = generateDOTSample(maxResults * 3);
    console.log(`[FMCSA] Generated ${dotSample.length} DOT numbers to check`);

    const carriers: ScoredCarrier[] = [];
    let checked = 0;
    let found = 0;

    // Check each DOT number (rate-limited to be respectful to FMCSA)
    for (const dot of dotSample) {
      checked++;
      if (checked % 10 === 0) {
        console.log(`[FMCSA] Checked ${checked}/${dotSample.length}...`);
      }

      const carrier = await lookupCarrierByDOT(dot);
      if (!carrier) continue;

      found++;

      // Quick filter: must be in a target state, not out of service, and have power units
      if (!targetStates.includes(carrier.state)) continue;
      if (carrier.outOfService) continue;
      if (carrier.powerUnits === 0) continue;
      // Must be interstate for-hire (not just intrastate)
      if (!carrier.operationClassification.some(c => c.includes('Interstate'))) continue;

      // Score the carrier
      const scored = scoreCarrier(carrier, targetStates);
      carriers.push(scored);

      // Stop if we have enough qualified prospects
      if (carriers.length >= maxResults) break;

      // Rate limit: 500ms between requests to FMCSA
      await new Promise(r => setTimeout(r, 500));
    }

    // Save to database
    let savedCount = 0;
    const enriched = carriers.map((c, i) => ({
      id: `fmcsa_${Date.now()}_${i}`,
      name: c.legalName,
      contact: {
        phone: c.phone,
        // FMCSA doesn't provide email — we'll get it during onboarding
      },
      location: `${c.city}, ${c.state} ${c.zip}`,
      equipment: c.equipment,
      experience: c.experience,
      authorityStatus: c.authorityStatusNormalized,
      currentCarrier: c.dbaName || 'Not disclosed',
      lanes: c.lanes,
      interestSignals: c.interestSignals,
      source: 'fmcsa_safer_database',
      sourceUrl: c.sourceUrl,
      aiScore: c.aiScore,
      aiAnalysis: c.aiAnalysis,
      status: c.aiScore >= 75 ? 'qualified' : 'new',
      type: 'outbound_driver',
      dotNumber: c.dotNumber,
      mcNumber: c.mcNumber,
      safetyRating: c.safetyRating,
      powerUnits: c.powerUnits,
      drivers: c.drivers,
      // BSON Dates, never ISO strings (see 2026-07 normalize migration).
      createdAt: new Date(),
      enrichedAt: new Date(),
    }));

    if (enriched.length > 0) {
      // Deduplicate by DOT number
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

    // Log activity
    const qualified = carriers.filter(c => c.aiScore >= 75).length;
    await db.collection('agent_activity').insertOne({
      action: 'fmcsa_prospecting',
      agent: { name: 'Sofia Rodriguez', role: 'Lead Generation Specialist', department: 'Sales' },
      result: {
        carriersChecked: checked,
        carriersFound: found,
        qualified,
        saved: savedCount,
        targetStates,
      },
      success: true,
      createdAt: new Date(),
    });

    console.log(`[FMCSA] Done: ${checked} checked, ${found} found, ${qualified} qualified, ${savedCount} saved`);

    return {
      checked,
      found,
      qualified,
      saved: savedCount,
      carriers,
    };
  } finally {
    await client.close();
  }
}