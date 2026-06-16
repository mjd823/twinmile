"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, TrendingDown, Target, BarChart3, 
  AlertTriangle, CheckCircle2, Settings, RefreshCw
} from "lucide-react";

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

interface ScoringCalibrationData {
  bands: ScoreBand[];
  overallConversionRate: number;
  totalLeads: number;
  totalConverted: number;
  recommendedThreshold: { qualified: number; premium: number };
  lastCalibrated: string;
}

export function ScoringCalibration() {
  const [data, setData] = React.useState<ScoringCalibrationData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [autoCalibrate, setAutoCalibrate] = React.useState(false);

  React.useEffect(() => {
    fetchData();
    if (autoCalibrate) {
      const interval = setInterval(fetchData, 300000); // 5 min
      return () => clearInterval(interval);
    }
  }, [autoCalibrate]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/scoring-calibration');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch scoring calibration:', error);
    } finally {
      setLoading(false);
    }
  };

  const runCalibration = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scoring-calibration', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          alert('Calibration complete! New thresholds applied.');
        }
      }
    } catch (error) {
      console.error('Calibration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading scoring calibration...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { bands, overallConversionRate, totalLeads, totalConverted, recommendedThreshold, lastCalibrated } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Scoring Calibration</h2>
            <p className="text-sm text-muted-foreground">Track conversion by score band • Auto-tune 75/85 thresholds</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={runCalibration} disabled={loading}>
            <Settings className="h-4 w-4 mr-2" />
            Run Calibration
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoCalibrate}
              onChange={e => setAutoCalibrate(e.target.checked)}
              className="w-4 h-4 rounded border-border/80 text-primary"
            />
            Auto (5min)
          </label>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Converted</p>
                <p className="text-2xl font-bold text-green-600">{totalConverted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{overallConversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Qualified ≥</p>
                <p className="text-2xl font-bold text-purple-600">{recommendedThreshold.qualified}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Premium ≥</p>
                <p className="text-2xl font-bold text-amber-600">{recommendedThreshold.premium}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Bands Table */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Conversion by Score Band
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 text-left text-sm text-muted-foreground">
                  <th className="pb-2 text-left">Score Range</th>
                  <th className="pb-2 text-right">Leads</th>
                  <th className="pb-2 text-right">Converted</th>
                  <th className="pb-2 text-right">Rate</th>
                  <th className="pb-2 text-right">Avg Days</th>
                  <th className="pb-2 text-right">Revenue</th>
                  <th className="pb-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band) => (
                  <tr key={band.range} className="border-b border-border/60">
                    <td className="py-3 font-medium">
                      <Badge variant="outline" className={`text-xs ${
                        band.recommendation === 'raise' ? 'border-red-500/30 text-red-700' :
                        band.recommendation === 'lower' ? 'border-green-500/30 text-green-700' :
                        band.recommendation === 'review' ? 'border-amber-500/30 text-amber-700' :
                        'border-border'
                      }`}>
                        {band.range}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">{band.count}</td>
                    <td className="py-3 text-right">{band.conversions}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Progress value={band.rate} max={100} className="w-24 h-1.5" />
                        <span className="text-sm font-medium">{band.rate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-sm">{band.avgDaysToConvert.toFixed(1)}d</td>
                    <td className="py-3 text-right font-medium">${band.revenue.toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <Badge variant="outline" className={`text-[10px] ${
                        band.recommendation === 'raise' ? 'border-red-500/30 text-red-700 bg-red-500/5' :
                        band.recommendation === 'lower' ? 'border-green-500/30 text-green-700 bg-green-500/5' :
                        band.recommendation === 'review' ? 'border-amber-500/30 text-amber-700 bg-amber-500/5' :
                        'border-border'
                      }`}>
                        {band.recommendation === 'raise' && <TrendingDown className="h-3 w-3 mr-1" />}
                        {band.recommendation === 'lower' && <TrendingUp className="h-3 w-3 mr-1" />}
                        {band.recommendation === 'review' && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {band.recommendation === 'keep' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {band.recommendation.charAt(0).toUpperCase() + band.recommendation.slice(1)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Auto-Calibration Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Suggested Threshold Update</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Qualified: <strong>{data?.bands.find(b => b.range.includes('75'))?.recommendation === 'raise' ? '75 → 80' : '75 (keep)'}</strong> | 
                  Premium: <strong>{recommendedThreshold.premium} (keep)</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Based on {totalLeads} leads with {overallConversionRate.toFixed(1)}% overall conversion.
                  Last calibrated: {new Date(lastCalibrated).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <p className="font-medium">Auto-Calibration Logic</p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc pl-5">
              <li>Raise threshold if band conversion < 5% and < 10 leads</li>
              <li>Lower threshold if band conversion > 25% and > 50 leads</li>
              <li>Premium threshold: maintain ≥85 for top 10% of leads</li>
              <li>Recalibrate weekly (Mondays 6 AM) or on demand</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}