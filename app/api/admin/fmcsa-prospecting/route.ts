import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

/**
 * FMCSA Real Prospecting API
 *
 * Queries the FMCSA Company Census File via the public Socrata API
 * at data.transportation.gov for REAL motor carriers.
 *
 * This replaces the old AI-hallucination approach. No fake data.
 *
 * POST /api/admin/fmcsa-prospecting
 * Body: { maxResults?: number, targetStates?: string[] }
 */
const CENSUS_API = 'https://data.transportation.gov/resource/az4n-8mr2.json';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      maxResults = 30,
      targetStates = ['TX', 'LA', 'CA', 'GA', 'TN']
    } = body;

    if (!clientPromise) {
      return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db();

    console.log(`🎯 Sofia Rodriguez starting FMCSA real carrier prospecting (target: ${maxResults})`);

    const perState = Math.ceil(maxResults / targetStates.length) + 5;
    let allCarriers: any[] = [];

    for (const state of targetStates) {
      const select = 'dot_number,legal_name,dba_name,phy_city,phy_state,phy_zip,phone,power_units,total_drivers,classdef,email_address,carrier_operation,interstate_beyond_100_miles,hm_ind';
      const where = `phy_state='${state}' AND status_code='A' AND total_drivers IN ('1','2','3') AND power_units IN ('1','2','3','4','5') AND crgo_genfreight='X' AND carrier_operation='C' AND hm_ind='N'`;

      const params = new URLSearchParams({
        '$select': select,
        '$where': where,
        '$limit': String(perState),
        '$order': 'dot_number DESC',
      });

      const url = `${CENSUS_API}?${params.toString()}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'TwinMile-Prospecting/1.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const carriers = await response.json();
        allCarriers.push(...carriers);
        console.log(`[fmcsa-prospecting] ${state}: found ${carriers.length} real carriers`);
      }
    }

    // Score carriers
    const scored = allCarriers.map(c => ({
      ...c,
      aiScore: scoreCarrier(c),
    }));

    scored.sort((a, b) => b.aiScore - a.aiScore);
    const topProspects = scored.slice(0, maxResults);

    // Save to database
    let savedCount = 0;
    const enriched = topProspects.map((c: any, i: number) => ({
      id: `fmcsa_${Date.now()}_${i}`,
      name: c.legal_name,
      dbaName: c.dba_name || null,
      contact: { phone: c.phone || null, email: c.email_address || null },
      location: `${c.phy_city}, ${c.phy_state} ${c.phy_zip}`,
      city: c.phy_city,
      state: c.phy_state,
      zip: c.phy_zip,
      equipment: 'Power-only / General Freight',
      experience: `${c.total_drivers} driver${c.total_drivers > 1 ? 's' : ''}, ${c.power_units} power unit${c.power_units > 1 ? 's' : ''}`,
      authorityStatus: 'own',
      currentCarrier: c.dba_name || 'Independent owner-operator',
      lanes: getLanesForState(c.phy_state),
      interestSignals: getSignals(c),
      source: 'fmcsa_census_api',
      sourceUrl: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.dot_number}`,
      aiScore: c.aiScore,
      aiAnalysis: 'Real FMCSA-verified carrier — active, authorized for hire, general freight',
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

    const qualifiedCount = topProspects.filter((c: any) => c.aiScore >= 75).length;

    await db.collection('agent_activity').insertOne({
      action: 'fmcsa_prospecting',
      agent: { name: 'Sofia Rodriguez', role: 'Lead Generation Specialist', department: 'Sales' },
      result: { carriersFound: allCarriers.length, qualified: qualifiedCount, saved: savedCount, targetStates },
      success: true,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `🎯 Sofia Rodriguez completed FMCSA carrier prospecting`,
      data: {
        carriersFound: allCarriers.length,
        qualified: qualifiedCount,
        prospectsSaved: savedCount,
        carriers: topProspects.map((c: any) => ({
          dotNumber: c.dot_number,
          legalName: c.legal_name,
          state: c.phy_state,
          city: c.phy_city,
          aiScore: c.aiScore,
          powerUnits: c.power_units,
          phone: c.phone,
          email: c.email_address,
        })),
        agent: 'Sofia Rodriguez (Lead Generation Specialist)',
        source: 'FMCSA Company Census API (real government data)',
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('FMCSA prospecting error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

function scoreCarrier(c: any): number {
  let score = 0;
  if (c.classdef?.includes('AUTHORIZED FOR HIRE')) score += 25;
  if (c.interstate_beyond_100_miles && c.interstate_beyond_100_miles !== '0') score += 15;
  const units = parseInt(c.power_units || '0', 10);
  if (units === 1) score += 20;
  else if (units >= 2 && units <= 3) score += 15;
  else if (units >= 4 && units <= 5) score += 8;
  if (c.total_drivers === '1') score += 10;
  if (c.phone?.length >= 10) score += 10;
  if (c.email_address?.includes('@') && !c.email_address.includes('example')) score += 15;
  if (c.hm_ind === 'N') score += 5;
  if (c.dba_name && c.dba_name !== c.legal_name) score += 5;
  return Math.max(0, Math.min(100, score));
}

function getSignals(c: any): string[] {
  const signals: string[] = [];
  if (c.classdef?.includes('AUTHORIZED FOR HIRE')) signals.push('Authorized for hire');
  if (c.interstate_beyond_100_miles && c.interstate_beyond_100_miles !== '0') signals.push('Interstate operations');
  if (c.power_units === '1') signals.push('Single power unit (true owner-operator)');
  if (c.total_drivers === '1') signals.push('Owner-driver (drives own truck)');
  if (c.phone?.length >= 10) signals.push('Phone number available');
  if (c.email_address?.includes('@') && !c.email_address.includes('example')) signals.push('Email address available');
  return signals;
}

function getLanesForState(state: string): string[] {
  const lanes: Record<string, string[]> = {
    TX: ['TX-LA', 'TX-CA', 'TX-GA', 'TX-TN', 'Regional TX'],
    LA: ['TX-LA', 'LA-TX', 'Gulf Coast'],
    CA: ['TX-CA', 'CA-TX', 'West Coast'],
    GA: ['TX-GA', 'GA-TN', 'Southeast'],
    TN: ['TX-TN', 'TN-GA', 'Mid-South'],
  };
  return lanes[state] || [];
}

export async function GET() {
  return NextResponse.json({
    service: 'FMCSA Real Prospecting',
    description: 'Queries the FMCSA Company Census API for real motor carriers',
    endpoint: 'POST /api/admin/fmcsa-prospecting',
    realData: true,
    fakeData: false,
  });
}