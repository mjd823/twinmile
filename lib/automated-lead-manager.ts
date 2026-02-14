// Automated Lead Management System
// This handles lead qualification, scoring, and routing automatically

import { analytics } from './analytics';

export interface LeadData {
  id: string;
  type: 'quote' | 'driver';
  name: string;
  email: string;
  phone?: string;
  serviceType?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  truckType?: string;
  yearsExperience?: string;
  hasOwnAuthority?: boolean;
  company?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  timestamp: string;
}

export interface LeadScore {
  score: number; // 0-100
  quality: 'low' | 'medium' | 'high' | 'premium';
  estimatedValue: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  autoActions: string[];
  routing: {
    shouldAutoRespond: boolean;
    shouldNotify: boolean;
    shouldEscalate: boolean;
    assignee?: string;
  };
}

export class AutomatedLeadManager {
  private static instance: AutomatedLeadManager;
  
  static getInstance(): AutomatedLeadManager {
    if (!AutomatedLeadManager.instance) {
      AutomatedLeadManager.instance = new AutomatedLeadManager();
    }
    return AutomatedLeadManager.instance;
  }

  // Automatically score and categorize leads
  async processIncomingLead(lead: LeadData): Promise<LeadScore> {
    const score = this.calculateLeadScore(lead);
    const routing = this.determineRouting(lead, score);
    
    // Track the automated scoring
    analytics.trackPageEngagement('/lead-automation', {
      scrollDepth: 0,
      timeOnPage: 0,
      interactions: [`lead_scored_${score.quality}`, `lead_value_${score.estimatedValue}`],
    });

    // Execute automated actions
    await this.executeAutomatedActions(lead, score, routing);
    
    return { ...score, routing };
  }

  private calculateLeadScore(lead: LeadData): Omit<LeadScore, 'routing'> {
    let score = 50; // Base score
    let estimatedValue = 0;
    let autoActions: string[] = [];

    if (lead.type === 'quote') {
      // Quote lead scoring
      if (lead.serviceType === 'freight') { score += 20; estimatedValue += 1000; }
      if (lead.serviceType === 'hotshot') { score += 15; estimatedValue += 800; }
      if (lead.serviceType === 'last_mile') { score += 10; estimatedValue += 500; }
      
      if (lead.pickupLocation && lead.dropoffLocation) { 
        score += 15; 
        estimatedValue += 500;
      }
      
      if (lead.company) { 
        score += 10; 
        estimatedValue += 300;
        autoActions.push('business_client_priority');
      }
      
      // UTM-based scoring
      if (lead.utmSource === 'google') score += 10;
      if (lead.utmMedium === 'cpc') score += 5;
      
    } else if (lead.type === 'driver') {
      // Driver lead scoring
      const years = parseInt(lead.yearsExperience || '0');
      if (years >= 5) { score += 20; estimatedValue += 5000; }
      else if (years >= 2) { score += 15; estimatedValue += 3000; }
      else if (years >= 1) { score += 10; estimatedValue += 2000; }
      
      if (lead.truckType === 'power_only') { score += 15; estimatedValue += 2000; }
      if (lead.truckType === 'hotshot') { score += 10; estimatedValue += 1500; }
      
      if (lead.hasOwnAuthority) { 
        score += 15; 
        estimatedValue += 3000;
        autoActions.push('owner_operator_priority');
      }
    }

    // Determine quality tier
    let quality: 'low' | 'medium' | 'high' | 'premium';
    let priority: 'low' | 'medium' | 'high' | 'urgent';
    
    if (score >= 85) {
      quality = 'premium';
      priority = 'urgent';
      autoActions.push('immediate_response', 'escalate_to_owner');
    } else if (score >= 70) {
      quality = 'high';
      priority = 'high';
      autoActions.push('priority_response', 'assign_to_best_rep');
    } else if (score >= 55) {
      quality = 'medium';
      priority = 'medium';
      autoActions.push('standard_response');
    } else {
      quality = 'low';
      priority = 'low';
      autoActions.push('automated_response');
    }

    return {
      score: Math.min(score, 100),
      quality,
      estimatedValue,
      priority,
      autoActions,
    };
  }

  private determineRouting(lead: LeadData, score: Omit<LeadScore, 'routing'>) {
    return {
      shouldAutoRespond: true, // Always auto-respond
      shouldNotify: score.quality !== 'low', // Don't notify for low quality
      shouldEscalate: score.quality === 'premium',
      assignee: this.getBestAssignee(lead, score),
    };
  }

  private getBestAssignee(lead: LeadData, score: Omit<LeadScore, 'routing'>): string {
    // Automated assignment logic
    if (score.quality === 'premium') return 'owner';
    if (lead.type === 'driver') return 'recruiting_team';
    if (lead.serviceType === 'freight') return 'freight_specialist';
    if (lead.serviceType === 'hotshot') return 'hotshot_team';
    return 'general_sales';
  }

  private async executeAutomatedActions(lead: LeadData, score: Omit<LeadScore, 'routing'>, routing: any) {
    const actions = [];
    
    // 1. Send automated response
    if (routing.shouldAutoRespond) {
      actions.push('auto_response_sent');
      // This would trigger your automated email/SMS system
    }
    
    // 2. Route to appropriate team
    if (routing.assignee && routing.assignee !== 'general_sales') {
      actions.push(`routed_to_${routing.assignee}`);
    }
    
    // 3. Escalate premium leads
    if (routing.shouldEscalate) {
      actions.push('escalated_to_management');
    }
    
    // 4. Track automation
    analytics.trackPageEngagement('/lead-automation', {
      scrollDepth: 0,
      timeOnPage: 0,
      interactions: actions,
    });
  }

  // Get daily automation report
  getAutomationReport(): {
    totalLeads: number;
    autoQualified: number;
    premiumLeads: number;
    totalValue: number;
    automationRate: number;
  } {
    // This would pull from your analytics and database
    return {
      totalLeads: 0, // Pull from actual data
      autoQualified: 0,
      premiumLeads: 0,
      totalValue: 0,
      automationRate: 100, // Should be 100% with this system
    };
  }
}

// Export singleton
export const automatedLeadManager = AutomatedLeadManager.getInstance();
