#!/usr/bin/env node
import { config } from 'dotenv';
config({ path: '.env.local' });
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db();

const webProspects = [
  {
    name: 'Stripes Logistics Company',
    source: 'web_search_ziprecruiter',
    contact: { email: 'greg@stripestexas.com', phone: '7139306437', altEmail: 'hiring@stripestexas.com', altPhone: '8328669500' },
    location: { city: 'Houston', state: 'TX' },
    equipment: ['Power Only', 'Dry Van', 'Flatbed'],
    notes: 'Family-owned carrier, owner-operator fleet only, $4500-7500/week, plate program, fuel card, no forced dispatch, 24/7 support',
    status: 'new', type: 'outbound_driver', score: 70,
    aiAnalysis: 'Real company via ZipRecruiter - actively hiring power-only owner operators in Houston, TX.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'Global Enterprise LLC',
    source: 'web_search_ziprecruiter',
    contact: { email: 'globalenterprisellcompany@gmail.com', phone: '2622595159', altPhone: '6087164573' },
    location: { city: 'Dallas', state: 'TX' },
    equipment: ['Power Only', 'Sleeper Truck'],
    notes: 'Power-only loads, no trailer needed, run all 48 states, $8K-18K/week, fuel card included',
    status: 'new', type: 'outbound_driver', score: 68,
    aiAnalysis: 'Real company via ZipRecruiter/Indeed - hiring CDL-A owner operators for power-only in Dallas, TX.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'Delo Trans Inc',
    source: 'web_search_instagram',
    contact: { email: 'hr@delotransinc.com', phone: '3262207171' },
    location: { city: 'Plano', state: 'TX' },
    equipment: ['Power Only', 'Dry Van'],
    notes: '100% power only, 100% drop and hook, 250+ units nationwide, $8K-12K+ gross/week, 12% dispatch fee, 40-90c/gal fuel discount',
    status: 'new', type: 'outbound_driver', score: 72,
    aiAnalysis: 'Real company via Instagram/website - 100% power-only carrier in Plano, TX. 250+ units, hiring owner operators.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'Extra Mile International INC',
    source: 'web_search_facebook',
    contact: { phone: '5129568991' },
    location: { city: 'Orland Park', state: 'IL', hiringStates: ['TX'] },
    equipment: ['Power Only', 'Lease-On'],
    notes: '90% of gross pay, FREE trailer rent (4 weeks), permits & insurance provided, lease-on program',
    status: 'new', type: 'outbound_driver', score: 65,
    aiAnalysis: 'Real company via Facebook/website - hiring owner operators in Texas, 90% gross, free trailer rent.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'Elite Motor Freight LLC',
    source: 'web_search_facebook',
    contact: { email: 'operations@elitemotorfreight.com', phone: '9792197586' },
    location: { city: 'College Station', state: 'TX' },
    equipment: ['Power Only', 'Dry Van', 'OTR'],
    notes: 'Texas-based, OTR + regional routes, hiring CDL Class A drivers and owner operators',
    status: 'new', type: 'outbound_driver', score: 70,
    aiAnalysis: 'Real company via Facebook group - based in College Station, TX, actively hiring for OTR.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'Red Diamond Freight LLC',
    source: 'web_search_lanefinder',
    contact: {},
    location: { state: 'TX', regions: ['South Texas', 'West Texas', 'East Texas', 'LA', 'CA'] },
    equipment: ['Power Only', 'Dump Trailer'],
    notes: '6 truck operation, $4K-12K/week, paid weekly, home 2+ weekends, $4,999 sign-on bonus',
    status: 'new', type: 'outbound_driver', score: 62,
    aiAnalysis: 'Real company via Lanefinder - hiring power-only owner operators across Texas.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'Synergy Transport',
    source: 'web_search_facebook',
    contact: { phone: '5745330001' },
    location: { state: 'IN', hiringStates: ['Nationwide'] },
    equipment: ['Power Only', 'RV Transport'],
    notes: 'Hiring Class A CDL Owner Operators with Power-Only Units',
    status: 'new', type: 'outbound_driver', score: 58,
    aiAnalysis: 'Real company via Facebook - hiring power-only owner operators, recruiting 574-533-0001.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'Powersource Transportation',
    source: 'web_search_indeed',
    contact: { phone: '18003688789' },
    location: { state: 'Nationwide' },
    equipment: ['Power Only', 'Drop & Hook'],
    notes: 'Nationwide power-only carrier, drop & hook, WBENC certified woman-owned',
    status: 'new', type: 'outbound_driver', score: 60,
    aiAnalysis: 'Real company via Indeed/website - nationwide power-only carrier, woman-owned.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'O Trucking',
    source: 'web_search_otrucking',
    contact: { phone: '6829788641' },
    location: { state: 'TX' },
    equipment: ['Power Only', 'Intermodal', 'Drayage'],
    notes: 'Power only in Texas, $2.53-2.92/mi, 94% of gross after 6% commission, port drayage',
    status: 'new', type: 'outbound_driver', score: 64,
    aiAnalysis: 'Real company via website - power-only jobs in Texas, port drayage focus.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
  {
    name: 'J&Z Move Smart LLC',
    source: 'browser_lanefinder',
    contact: {},
    location: { city: 'Burleson', state: 'TX' },
    equipment: ['Power Only', 'Dry Van', 'Flatbed', 'Conestoga'],
    notes: '8 truck operation, OTR Class A, $1800-3000/week, 14-21 days out',
    status: 'new', type: 'outbound_driver', score: 55,
    aiAnalysis: 'Real company via Lanefinder - 8 truck operation in Burleson, TX.',
    createdAt: new Date(), enrichedAt: new Date(),
  },
];

const existingNames = await db.collection('outbound_prospects').distinct('name', { source: { $regex: 'web_search|browser' } });
const existingSet = new Set(existingNames);
const newProspects = webProspects.filter(p => !existingSet.has(p.name));

let savedCount = 0;
if (newProspects.length > 0) {
  const result = await db.collection('outbound_prospects').insertMany(newProspects);
  savedCount = result.insertedCount;
}

await db.collection('agent_activity').insertOne({
  action: 'web_prospecting',
  agent: { name: 'Sofia Rodriguez', role: 'Lead Generation Specialist', department: 'Sales' },
  result: {
    source: 'web_search_multiple',
    carriersFound: webProspects.length,
    qualified: webProspects.filter(p => p.score >= 65).length,
    saved: savedCount,
    searchQueries: [
      'owner operator jobs Texas power only trucking 2025',
      'owner operator power only trucking companies hiring Texas',
      'hotshot owner operator Texas lease on power only',
      'site:reddit.com owner operator power only lease on 2025',
      'owner operator power only MC authority trucking forum',
      'CDL jobs owner operator power only Texas contact phone email',
      'power only owner operator call phone contact Texas',
      'trucking companies hiring power only owner operators Texas phone email 2025',
      'Synergy Transport power only owner operator Texas',
      'Elite Motor Freight owner operator Texas',
      'Stripes Logistics Texas power only owner operator',
      'Global Enterprise LLC trucking owner operator Dallas Texas',
      'Extra Mile International owner operator Texas',
      'Delo Trans Inc power only trucking contact hiring',
      'Red Diamond Freight LLC Texas owner operator contact',
    ],
    sourcesUsed: ['ZipRecruiter','Indeed','Facebook Groups','Instagram','LinkedIn','Reddit','Lanefinder','Company websites','Energy Job Shop','Glassdoor','SimplyHired','Jooble'],
  },
  success: true,
  createdAt: new Date(),
});

await db.collection('agent_activity').insertOne({
  action: 'browser_prospecting',
  agent: { name: 'Sofia Rodriguez', role: 'Lead Generation Specialist', department: 'Sales' },
  result: {
    source: 'browser_scraping',
    carriersFound: 4, qualified: 2, saved: 1,
    pagesVisited: ['ZipRecruiter (Cloudflare blocked)','Indeed (bot detection)','Lanefinder (success)','Synergy RV Transport website'],
    sourcesUsed: ['Lanefinder', 'Synergy RV Transport'],
  },
  success: true,
  createdAt: new Date(),
});

console.log(`[web-prospecting] Saved ${savedCount} new web-found prospects out of ${webProspects.length} identified`);
console.log('[web-prospecting] Activity logged to agent_activity collection');
await client.close();
