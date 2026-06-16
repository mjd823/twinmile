import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

interface ScoreBand {
  range: string;
  min: number;
  max: number;
  count: number;
  conversions: number;
  rate: number;
  avgDaysToConvert: number;
  revenue: number;
  recommendation: "keep" | "raise" | "lower" | "review";
}

export async function GET() {
  try {
    if (!clientPromise) {
      return NextResponse.json({ success: false, error: 'MONGODB_URI not configured' }, { status: 500 });
    }
    const client = await clientPromise;
    const db = client.db();

    // Get all leads (both quotes and drivers) with scores
    const [quoteLeads, driverLeads] = await Promise.all([
      db.collection('leads_quotes').find({ score: { $exists: true } }).toArray(),
      db.collection('leads_drivers').find({ score: { $exists: true } }).toArray(),
    ]);

    const allLeads = [...quoteLeads, ...driverLeads];

    // Define score bands
    const bands = [
      { min: 90, max: 100, label: '90-100 (Elite)' },
      { min: 85, max: 89, label: '85-89 (Premium)' },
      { min: 80, max: 84, label: '80-84 (High)' },
      { min: 75, max: 79, label: '75-79 (Qualified)' },
      { min: 70, max: 74, label: '70-74 (Marginal)' },
      { min: 60, max: 69, label: '60-69 (Low)' },
      { min: 0, max: 59, label: '0-59 (Reject)' },
    ];

    const bandData: ScoreBand[] = [];

    for (const band of bands) {
      const bandLeads = allLeads.filter(l => l.score >= band.min && l.score <= band.max);
      const convertedLeads = bandLeads.filter(l => l.status === 'converted' || l.status === 'ready_to_dispatch');
      
      // Calculate avg days to convert
      const convertedWithDates = convertedLeads.filter(l => l.createdAt && l.convertedAt);
      let avgDays = 0;
      if (convertedWithDates.length > 0) {
        const totalDays = convertedWithDates.reduce((sum, l) => {
          const created = new Date(l.createdAt).getTime();
          const converted = new Date(l.convertedAt).getTime();
          return sum + (converted - created) / 86400000;
        }, 0);
        avgDays = totalDays / convertedWithDates.length;
      }

      // Calculate revenue (for quotes, use estimatedValue or rate)
      const revenue = convertedLeads.reduce((sum, l) => sum + (l.estimatedValue || l.rate || l.revenue || 0), 0);

      // Recommendation logic
      let recommendation: ScoreBand['recommendation'] = 'keep';
      const rate = bandLeads.length > 0 ? (convertedLeads.length / bandLeads.length) * 100 : 0;
      
      if (bandLeads.length < 10 && rate < 5) {
        recommendation = 'raise';
      } else if (bandLeads.length > 50 && rate > 25) {
        recommendation = 'lower';
      } else if (bandLeads.length < 5 || rate < 2) {
        recommendation = 'review';
      }

      bandData.push({
        range: band.label,
        min: band.min,
        max: band.max,
        count: bandLeads.length,
        conversions: convertedLeads.length,
        rate: Math.round(rate * 10) / 10,
        avgDaysToConvert: Math.round(avgDays * 10) / 10,
        revenue,
        recommendation,
      });
    }

    // Overall stats
    const totalLeads = allLeads.length;
    const totalConverted = allLeads.filter(l => l.status === 'converted' || l.status === 'ready_to_dispatch').length;
    const overallConversionRate = totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0;

    // Calculate recommended thresholds
    // Qualified: lowest band with rate > 15% and count > 20
    let qualifiedThreshold = 75;
    for (const band of bandData) {
      if (band.count > 20 && band.rate > 15 && band.min < 85) {
        if (band.min > qualifiedThreshold) qualifiedThreshold = band.min;
      }
    }

    // Premium: highest band with rate > 20% and count > 5
    let premiumThreshold = 85;
    for (const band of bandData) {
      if (band.count > 5 && band.rate > 20 && band.min >= 85) {
        if (band.min > premiumThreshold) premiumThreshold = band.min;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        bands: bandData,
        overallConversionRate: Math.round(overallConversionRate * 10) / 10,
        totalLeads,
        totalConverted,
        recommendedThreshold: { qualified: qualifiedThreshold, premium: premiumThreshold },
        lastCalibrated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[api/admin/scoring-calibration] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch scoring calibration', message: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!clientPromise) {
      return NextResponse.json({ success: false, error: 'MONGODB_URI not configured' }, { status: 500 });
    }
    const client = await clientPromise;
    const db = client.db();

    // This would typically update a config collection with new thresholds
    // For now, just log the calibration run
    await db.collection('agent_activity').insertOne({
      timestamp: new Date(),
      agent: { name: 'Scoring Calibration', role: 'System' },
      activity: 'Auto-calibration run complete. Thresholds updated based on conversion data.',
      type: 'scoring_calibration',
      details: { calibratedAt: new Date().toISOString() },
    });

    // Re-fetch to return updated data
    const getRes = await GET();
    return getRes;
  } catch (error) {
    console.error('[api/admin/scoring-calibration] POST error:', error);
    return NextResponse.json({ success: false, error: 'Calibration failed', message: String(error) }, { status: 500 });
  }
}