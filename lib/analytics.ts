// World-Class Analytics Tracking System
// This provides advanced tracking beyond standard GA4 implementation

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (command: string, ...args: any[]) => void;
  }
}

// Advanced conversion tracking with business intelligence
export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  
  static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  // Track quote form submission with detailed business intelligence
  trackQuoteSubmission(data: {
    serviceType: string;
    pickupLocation: string;
    dropoffLocation?: string;
    contactMethod: 'phone' | 'email';
    company?: string;
    estimatedValue?: number;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }) {
    // Calculate lead quality score
    const qualityScore = this.calculateLeadQuality(data);
    
    // Estimate potential revenue
    const estimatedRevenue = this.estimateRevenue(data);
    
    // Track with GA4
    window.gtag('event', 'quote_submission', {
      event_category: 'lead_generation',
      event_label: data.serviceType,
      value: estimatedRevenue,
      custom_parameters: {
        service_type: data.serviceType,
        pickup_location: data.pickupLocation,
        dropoff_location: data.dropoffLocation || '',
        contact_method: data.contactMethod,
        has_company: !!data.company,
        lead_quality_score: qualityScore,
        estimated_revenue: estimatedRevenue,
        utm_source: data.utmSource || '',
        utm_medium: data.utmMedium || '',
        utm_campaign: data.utmCampaign || '',
        timestamp: new Date().toISOString(),
      }
    });

    // Track lead quality for business intelligence
    window.gtag('event', 'lead_quality_score', {
      event_category: 'business_intelligence',
      value: qualityScore,
      custom_parameters: {
        lead_type: 'quote',
        quality_factors: this.getQualityFactors(data),
      }
    });
  }

  // Track driver application with detailed qualifications
  trackDriverApplication(data: {
    truckType: string;
    yearsExperience: string;
    preferredRoutes: string;
    startDate: string;
    hasOwnAuthority: boolean;
    estimatedRevenue?: number;
    utmSource?: string;
    utmMedium?: string;
  }) {
    const qualityScore = this.calculateDriverQuality(data);
    const estimatedRevenue = data.estimatedRevenue || this.estimateDriverRevenue(data);
    
    window.gtag('event', 'driver_application', {
      event_category: 'recruitment',
      event_label: data.truckType,
      value: estimatedRevenue,
      custom_parameters: {
        truck_type: data.truckType,
        years_experience: data.yearsExperience,
        preferred_routes: data.preferredRoutes,
        start_date: data.startDate,
        has_own_authority: data.hasOwnAuthority,
        driver_quality_score: qualityScore,
        estimated_revenue: estimatedRevenue,
        utm_source: data.utmSource || '',
        utm_medium: data.utmMedium || '',
        timestamp: new Date().toISOString(),
      }
    });
  }

  // Track contact interactions with detailed context
  trackPhoneCall(phoneNumber: string, context: string) {
    window.gtag('event', 'phone_call', {
      event_category: 'contact',
      event_label: phoneNumber,
      custom_parameters: {
        contact_method: 'phone',
        context: context,
        timestamp: new Date().toISOString(),
      }
    });
  }

  trackEmailClick(emailAddress: string, context: string) {
    window.gtag('event', 'email_click', {
      event_category: 'contact',
      event_label: emailAddress,
      custom_parameters: {
        contact_method: 'email',
        context: context,
        timestamp: new Date().toISOString(),
      }
    });
  }

  // Track page engagement with business metrics
  trackPageEngagement(pagePath: string, engagementData: {
    scrollDepth: number;
    timeOnPage: number;
    interactions: string[];
  }) {
    window.gtag('event', 'page_engagement', {
      event_category: 'user_behavior',
      event_label: pagePath,
      value: engagementData.timeOnPage,
      custom_parameters: {
        scroll_depth: engagementData.scrollDepth,
        interactions: engagementData.interactions.join(','),
        engagement_score: this.calculateEngagementScore(engagementData),
        timestamp: new Date().toISOString(),
      }
    });
  }

  // Advanced business intelligence methods
  private calculateLeadQuality(data: any): number {
    let score = 50; // Base score
    
    // Service type scoring
    if (data.serviceType === 'freight') score += 20;
    if (data.serviceType === 'hotshot') score += 15;
    if (data.serviceType === 'last_mile') score += 10;
    
    // Location scoring
    if (data.pickupLocation && data.dropoffLocation) score += 15;
    
    // Company presence
    if (data.company) score += 10;
    
    // Contact method
    if (data.contactMethod === 'phone') score += 5;
    
    return Math.min(score, 100);
  }

  private calculateDriverQuality(data: any): number {
    let score = 50; // Base score
    
    // Experience scoring
    const years = parseInt(data.yearsExperience) || 0;
    if (years >= 5) score += 20;
    else if (years >= 2) score += 15;
    else if (years >= 1) score += 10;
    
    // Truck type scoring
    if (data.truckType === 'power_only') score += 15;
    if (data.truckType === 'hotshot') score += 10;
    
    // Authority scoring
    if (data.hasOwnAuthority) score += 10;
    
    // Start date urgency
    if (data.startDate === 'immediate') score += 5;
    
    return Math.min(score, 100);
  }

  private estimateRevenue(data: any): number {
    // Estimate based on service type and distance
    const baseRevenue = {
      'freight': 2500,
      'hotshot': 1800,
      'last_mile': 800,
      'power_only': 1500,
    };
    
    return baseRevenue[data.serviceType as keyof typeof baseRevenue] || 1000;
  }

  private estimateDriverRevenue(data: any): number {
    // Estimate annual driver revenue
    const baseRevenue = {
      'power_only': 300000,
      'hotshot': 250000,
      'flatbed': 200000,
      'dry_van': 180000,
    };
    
    return baseRevenue[data.truckType as keyof typeof baseRevenue] || 200000;
  }

  private getQualityFactors(data: any): string[] {
    const factors: string[] = [];
    if (data.serviceType === 'freight') factors.push('high_value_service');
    if (data.pickupLocation && data.dropoffLocation) factors.push('complete_route');
    if (data.company) factors.push('business_client');
    if (data.contactMethod === 'phone') factors.push('direct_contact');
    return factors;
  }

  private calculateEngagementScore(data: any): number {
    let score = 0;
    score += Math.min(data.scrollDepth / 100 * 40, 40);
    score += Math.min(data.timeOnPage / 60 * 30, 30); // Max 30 points for time
    score += Math.min(data.interactions.length * 10, 30); // Max 30 points for interactions
    return Math.min(score, 100);
  }
}

// Export singleton instance
export const analytics = AnalyticsTracker.getInstance();

// Helper functions for React components
export const useAnalytics = () => {
  return {
    trackQuoteSubmission: analytics.trackQuoteSubmission.bind(analytics),
    trackDriverApplication: analytics.trackDriverApplication.bind(analytics),
    trackPhoneCall: analytics.trackPhoneCall.bind(analytics),
    trackEmailClick: analytics.trackEmailClick.bind(analytics),
    trackPageEngagement: analytics.trackPageEngagement.bind(analytics),
  };
};
