"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Truck, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Phone,
  Mail,
  Package,
  MapPin
} from "lucide-react";

interface FreightDashboardProps {
  quoteLeads: any[];
}

export function FreightDashboard({ quoteLeads }: FreightDashboardProps) {
  const urgentLeads = quoteLeads.filter(lead => lead.priority === 'urgent');
  const totalValue = quoteLeads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
  const businessLeads = quoteLeads.filter(lead => lead.company);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-green-600" />
              Quote Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{quoteLeads.length}</div>
            <p className="text-xs text-muted-foreground">Auto-assigned</p>
          </CardContent>
        </Card>
        
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              Business Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{businessLeads.length}</div>
            <p className="text-xs text-muted-foreground">Company leads</p>
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
            <p className="text-xs text-muted-foreground">Immediate quotes</p>
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
            <p className="text-xs text-muted-foreground">Estimated revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Quote Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Freight Quote Queue
          </CardTitle>
          <CardDescription>
            Quote requests automatically scored and assigned to freight specialists
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quoteLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No quote requests in queue</p>
                <p className="text-sm">New quote requests will appear here automatically</p>
              </div>
            ) : (
              quoteLeads.map((lead, index) => {
                const hasCompleteRoute = lead.pickupLocation && lead.dropoffLocation;
                const isBusinessClient = !!lead.company;
                
                return (
                  <div key={index} className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{lead.name || 'Unknown'}</h4>
                          <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                            {lead.quality || 'medium'} ({lead.score || 0}/100)
                          </Badge>
                          {isBusinessClient && (
                            <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">
                              Business Client
                            </Badge>
                          )}
                          {hasCompleteRoute && (
                            <Badge className="bg-purple-500/20 text-purple-700 border-purple-500/30">
                              Complete Route
                            </Badge>
                          )}
                          {lead.priority === 'urgent' && (
                            <Badge className="bg-red-500/20 text-red-700 border-red-500/30">
                              Urgent Quote
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
                            <div>Service Type: {lead.serviceType}</div>
                          )}
                          {lead.pickupLocation && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Pickup: {lead.pickupLocation}
                            </div>
                          )}
                          {lead.dropoffLocation && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Dropoff: {lead.dropoffLocation}
                            </div>
                          )}
                          <div className="text-green-600 font-semibold">
                            Estimated Value: ${lead.estimatedValue?.toLocaleString() || '0'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          Generate Quote
                        </Button>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-green-500/20">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Requested: {new Date(lead.timestamp || Date.now()).toLocaleString()}</span>
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
          <CardTitle>Freight Operations</CardTitle>
          <CardDescription>
            Common tasks for managing quote requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button className="h-20 flex-col gap-2" variant="outline">
              <DollarSign className="h-6 w-6" />
              <span>Bulk Quotes</span>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline">
              <CheckCircle className="h-6 w-6" />
              <span>Route Planning</span>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline">
              <TrendingUp className="h-6 w-6" />
              <span>Freight Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
