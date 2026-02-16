// Client-Side AI Activity Engine - Calls API for real data
export class ClientAIActivityEngine {
  private static instance: ClientAIActivityEngine;
  private activityCache: any = null;
  private lastFetch: number = 0;
  private cacheTimeout = 30000; // 30 seconds

  static getInstance(): ClientAIActivityEngine {
    if (!ClientAIActivityEngine.instance) {
      ClientAIActivityEngine.instance = new ClientAIActivityEngine();
    }
    return ClientAIActivityEngine.instance;
  }

  private constructor() {
    console.log('🤖 Client AI Activity Engine initialized');
  }

  // Get current activity from API
  async getCurrentActivity() {
    const cached = this.getCachedData();
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/admin/api/ai-activity');
      const data = await response.json();
      
      if (data.success) {
        this.activityCache = {
          isActive: true,
          systemHealth: data.supervisorReport.systemHealth,
          recentActivities: data.activities,
          supervisor: {
            name: data.supervisorReport.supervisorName,
            currentTask: 'Monitoring all AI operations',
            alertsCount: data.supervisorReport.activeAlerts.length,
            interventionsCount: data.supervisorReport.totalInterventions
          },
          realMetrics: {
            actualLeadsProcessed: data.databaseStats.totalLeads,
            actualCustomers: data.databaseStats.customers,
            actualDrivers: data.databaseStats.drivers
          },
          databaseStats: data.databaseStats
        };
        this.lastFetch = Date.now();
        return this.activityCache;
      } else {
        // Fallback mode
        return this.getFallbackData();
      }
    } catch (error) {
      console.error('Failed to fetch AI activity:', error);
      return this.getFallbackData();
    }
  }

  // Get activity feed
  getActivityFeed(limit: number = 10) {
    const data = this.activityCache || this.getFallbackData();
    const activities = data.recentActivities || [];
    
    return activities.slice(0, limit).map((activity: any) => ({
      ...activity,
      timeAgo: this.getTimeAgo(new Date(activity.timestamp))
    }));
  }

  // Get supervisor report — returns whatever the API gave us, no fakes
  getSupervisorReport() {
    const data = this.activityCache || this.getFallbackData();
    return {
      supervisorName: data.supervisor?.name || 'AI Supervisor',
      systemHealth: data.systemHealth || {
        score: 0,
        status: 'loading',
        activeAgents: 8,
        databaseConnected: false,
        totalRecords: 0,
      },
      performance: {
        average: data.systemHealth?.score ?? 0,
        topPerformer: { name: 'N/A', successRate: 0 },
        needsAttention: [],
      },
      activeAlerts: [],
      totalInterventions: data.supervisor?.interventionsCount || 0,
      lastReview: new Date().toISOString(),
      recommendations: data.systemHealth?.databaseConnected
        ? [
            `${data.realMetrics?.actualLeadsProcessed ?? 0} leads in pipeline`,
            `${data.realMetrics?.actualCustomers ?? 0} customer accounts`,
          ]
        : ['Connecting to database…'],
      systemStatus: data.systemHealth?.databaseConnected
        ? 'All Systems Operational'
        : 'Connecting…',
    };
  }

  // Handle dashboard actions
  async handleDashboardAction(action: string) {
    try {
      const response = await fetch('/admin/api/ai-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();
      
      // Clear cache to force refresh
      this.activityCache = null;
      
      return result;
    } catch (error) {
      console.error('Dashboard action failed:', error);
      return {
        success: false,
        message: `❌ Failed to execute ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString()
      };
    }
  }

  // Cache management
  private getCachedData() {
    if (this.activityCache && Date.now() - this.lastFetch < this.cacheTimeout) {
      return this.activityCache;
    }
    return null;
  }

  // Honest fallback when API hasn't responded yet
  private getFallbackData() {
    return {
      isActive: false,
      systemHealth: {
        score: 0,
        status: 'loading',
        activeAgents: 8,
        databaseConnected: false,
        totalRecords: 0,
      },
      recentActivities: [],
      supervisor: {
        name: 'AI Supervisor',
        currentTask: 'Connecting to database…',
        alertsCount: 0,
        interventionsCount: 0,
      },
      realMetrics: {
        actualLeadsProcessed: 0,
        actualCustomers: 0,
        actualDrivers: 0,
      },
      databaseStats: null,
    };
  }

  // Helper function for time ago
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }
}

// Export singleton
export const clientAIActivityEngine = ClientAIActivityEngine.getInstance();
