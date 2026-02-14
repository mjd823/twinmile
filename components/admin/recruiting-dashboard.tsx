"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  UserCheck, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Phone,
  Mail,
  Truck,
  Star
} from "lucide-react";

interface RecruitingDashboardProps {
  driverLeads: any[];
}

export function RecruitingDashboard({ driverLeads }: RecruitingDashboardProps) {
  const urgentLeads = driverLeads.filter(lead => lead.priority === 'urgent');
  const totalValue = driverLeads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
  const experiencedDrivers = driverLeads.filter(lead => {
    const years = parseInt(lead.yearsExperience || '0');
    return years >= 2;
  });

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-600" />
              Driver Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{driverLeads.length}</div>
            <p className="text-xs text-muted-foreground">Auto-assigned</p>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-green-600" />
              Experienced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{experiencedDrivers.length}</div>
            <p className="text-xs text-muted-foreground">2+ years experience</p>
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
            <p className="text-xs text-muted-foreground">Immediate contact</p>
          </CardContent>
        </Card>
        
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">${totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Annual revenue potential</p>
          </CardContent>
        </Card>
      </div>

      {/* Driver Applications List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Driver Application Queue
          </CardTitle>
          <CardDescription>
            Driver applications automatically scored and assigned to your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {driverLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No driver applications in queue</p>
                <p className="text-sm">New applications will appear here automatically</p>
              </div>
            ) : (
              driverLeads.map((lead, index) => {
                const years = parseInt(lead.yearsExperience || '0');
                const isExperienced = years >= 2;
                const isOwnerOperator = lead.hasOwnAuthority === 'true';
                
                return (
                  <div key={index} className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{lead.name || 'Unknown'}</h4>
                          <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">
                            {lead.quality || 'medium'} ({lead.score || 0}/100)
                          </Badge>
                          {isExperienced && (
                            <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                              {years}+ years
                            </Badge>
                          )}
                          {isOwnerOperator && (
                            <Badge className="bg-purple-500/20 text-purple-700 border-purple-500/30">
                              Owner Operator
                            </Badge>
                          )}
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
                          {lead.truckType && (
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              Truck: {lead.truckType}
                            </div>
                          )}
                          {lead.yearsExperience && (
                            <div>Experience: {lead.yearsExperience} years</div>
                          )}
                          {lead.preferredRoutes && (
                            <div>Preferred Routes: {lead.preferredRoutes}</div>
                          )}
                          <div className="text-purple-600 font-semibold">
                            Estimated Revenue: ${lead.estimatedValue?.toLocaleString() || '0'}/year
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          Contact Driver
                        </Button>
                        <Button size="sm" variant="outline">
                          View Profile
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-blue-500/20">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Applied: {new Date(lead.timestamp || Date.now()).toLocaleString()}</span>
                        <span>•</span>
                        <span>Actions: {lead.autoActions?.join(', ') || 'None'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recruiting Actions</CardTitle>
          <CardDescription>
            Common tasks for managing driver applications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button className="h-20 flex-col gap-2" variant="outline">
              <Phone className="h-6 w-6" />
              <span>Bulk Contact</span>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline">
              <CheckCircle className="h-6 w-6" />
              <span>Schedule Interviews</span>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline">
              <TrendingUp className="h-6 w-6" />
              <span>Recruitment Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
