"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Crown, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare
} from "lucide-react";

interface OwnerDashboardProps {
  premiumLeads: any[];
}

export function OwnerDashboard({ premiumLeads }: OwnerDashboardProps) {
  const urgentLeads = premiumLeads.filter(lead => lead.priority === 'urgent');
  const totalValue = premiumLeads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-purple-600" />
              Premium Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{premiumLeads.length}</div>
            <p className="text-xs text-muted-foreground">Auto-escalated</p>
          </CardContent>
        </Card>
        
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Urgent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{urgentLeads.length}</div>
            <p className="text-xs text-muted-foreground">Immediate action</p>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Estimated revenue</p>
          </CardContent>
        </Card>
        
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Avg Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {premiumLeads.length > 0 ? Math.round(premiumLeads.reduce((sum, lead) => sum + (lead.score || 0), 0) / premiumLeads.length) : 0}/100
            </div>
            <p className="text-xs text-muted-foreground">Lead scoring</p>
          </CardContent>
        </Card>
      </div>

      {/* Premium Leads List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Premium Lead Queue
          </CardTitle>
          <CardDescription>
            High-value leads requiring your immediate attention and approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {premiumLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No premium leads in queue</p>
                <p className="text-sm">The system will notify you when high-value leads arrive</p>
              </div>
            ) : (
              premiumLeads.map((lead, index) => (
                <div key={index} className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{lead.name || 'Unknown'}</h4>
                        <Badge className="bg-purple-500/20 text-purple-700 border-purple-500/30">
                          {lead.quality || 'premium'} ({lead.score || 0}/100)
                        </Badge>
                        {lead.priority === 'urgent' && (
                          <Badge className="bg-red-500/20 text-red-700 border-red-500/30">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {lead.email || 'No email'}
                        </div>
                        {lead.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {lead.phone}
                          </div>
                        )}
                        {lead.company && (
                          <div className="font-medium text-foreground">{lead.company}</div>
                        )}
                        {lead.serviceType && (
                          <div>Service: {lead.serviceType}</div>
                        )}
                        {lead.truckType && (
                          <div>Truck: {lead.truckType}</div>
                        )}
                        <div className="text-green-600 font-semibold">
                          Estimated Value: ${lead.estimatedValue?.toLocaleString() || '0'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                        Approve & Assign
                      </Button>
                      <Button size="sm" variant="outline">
                        Review Details
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-purple-500/20">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Auto-escalated: {new Date(lead.timestamp || Date.now()).toLocaleString()}</span>
                      <span>•</span>
                      <span>Actions: {lead.autoActions?.join(', ') || 'None'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks for managing premium leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button className="h-20 flex-col gap-2" variant="outline">
              <CheckCircle className="h-6 w-6" />
              <span>Bulk Approve</span>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline">
              <MessageSquare className="h-6 w-6" />
              <span>Contact Team</span>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline">
              <TrendingUp className="h-6 w-6" />
              <span>View Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
