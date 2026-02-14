"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { automatedLeadManager, type LeadScore } from "@/lib/automated-lead-manager";

// Mock data for demonstration - in production this would come from your database
const mockDailyStats = {
  totalLeads: 12,
  autoQualified: 11,
  premiumLeads: 3,
  totalValue: 28500,
  automationRate: 100,
};

const mockRecentLeads: (LeadScore & { name: string; type: string; timestamp: string })[] = [
  {
    name: "ABC Manufacturing",
    type: "quote",
    timestamp: "2024-02-14 13:45:00",
    score: 92,
    quality: "premium",
    estimatedValue: 3500,
    priority: "urgent",
    autoActions: ["immediate_response", "escalate_to_owner", "business_client_priority"],
    routing: { shouldAutoRespond: true, shouldNotify: true, shouldEscalate: true, assignee: "owner" },
  },
  {
    name: "John Smith",
    type: "driver",
    timestamp: "2024-02-14 13:30:00",
    score: 85,
    quality: "premium",
    estimatedValue: 7500,
    priority: "urgent",
    autoActions: ["immediate_response", "escalate_to_owner", "owner_operator_priority"],
    routing: { shouldAutoRespond: true, shouldNotify: true, shouldEscalate: true, assignee: "recruiting_team" },
  },
  {
    name: "Global Logistics Co",
    type: "quote",
    timestamp: "2024-02-14 13:15:00",
    score: 78,
    quality: "high",
    estimatedValue: 2200,
    priority: "high",
    autoActions: ["priority_response", "assign_to_best_rep", "business_client_priority"],
    routing: { shouldAutoRespond: true, shouldNotify: true, shouldEscalate: false, assignee: "freight_specialist" },
  },
];

function getQualityColor(quality: string) {
  switch (quality) {
    case "premium": return "bg-purple-500/20 text-purple-700 border-purple-500/30";
    case "high": return "bg-green-500/20 text-green-700 border-green-500/30";
    case "medium": return "bg-blue-500/20 text-blue-700 border-blue-500/30";
    case "low": return "bg-gray-500/20 text-gray-700 border-gray-500/30";
    default: return "bg-gray-500/20 text-gray-700 border-gray-500/30";
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent": return "bg-red-500/20 text-red-700 border-red-500/30";
    case "high": return "bg-orange-500/20 text-orange-700 border-orange-500/30";
    case "medium": return "bg-yellow-500/20 text-yellow-700 border-yellow-500/30";
    case "low": return "bg-gray-500/20 text-gray-700 border-gray-500/30";
    default: return "bg-gray-500/20 text-gray-700 border-gray-500/30";
  }
}

export function AutomationDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">🤖 Lead Automation Dashboard</h2>
        <p className="text-muted-foreground">
          Real-time automated lead qualification and routing - Zero manual intervention required
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDailyStats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Auto-Qualified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mockDailyStats.autoQualified}</div>
            <p className="text-xs text-muted-foreground">{mockDailyStats.automationRate}% automation rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Premium Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{mockDailyStats.premiumLeads}</div>
            <p className="text-xs text-muted-foreground">Escalated automatically</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${mockDailyStats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Estimated revenue</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Automation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mockDailyStats.automationRate}%</div>
            <p className="text-xs text-muted-foreground">Fully automated</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads */}
      <Card>
        <CardHeader>
          <CardTitle>🔥 Recent Automated Processing</CardTitle>
          <CardDescription>
            Leads automatically scored, qualified, and routed without human intervention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockRecentLeads.map((lead, index) => (
              <div key={index} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{lead.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {lead.type === 'quote' ? '📋 Quote Request' : '🚛 Driver Application'} • {lead.timestamp}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getQualityColor(lead.quality)}>
                      {lead.quality} ({lead.score}/100)
                    </Badge>
                    <Badge className={getPriorityColor(lead.priority)}>
                      {lead.priority}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Estimated Value:</span>
                    <span className="ml-2 text-green-600 font-semibold">${lead.estimatedValue.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-medium">Auto-Assigned to:</span>
                    <span className="ml-2 text-blue-600">{lead.routing.assignee}</span>
                  </div>
                </div>
                
                <div>
                  <span className="font-medium text-sm">🤖 Automated Actions:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {lead.autoActions.map((action, actionIndex) => (
                      <Badge key={actionIndex} variant="outline" className="text-xs">
                        {action.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Automation Rules */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Automation Rules Active</CardTitle>
          <CardDescription>
            Your lead processing is 100% automated with these intelligent rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">🎯 Lead Scoring</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Business clients get +10 points</li>
                <li>• Complete routes get +15 points</li>
                <li>• Owner operators get +15 points</li>
                <li>• 5+ years experience gets +20 points</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">🚀 Auto-Routing</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Premium leads → Owner notification</li>
                <li>• Freight leads → Freight specialist</li>
                <li>• Driver leads → Recruiting team</li>
                <li>• Low quality → Automated response only</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
