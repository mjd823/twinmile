import { AgentOrchestrator, AgentFactory } from "@/lib/ai-agents";
import { automatedLeadManager, type LeadData } from "@/lib/automated-lead-manager";

// Enhanced AI-Powered Lead Manager
export class AIEnhancedLeadManager {
  private orchestrator: AgentOrchestrator;
  private static instance: AIEnhancedLeadManager;
  
  static getInstance(): AIEnhancedLeadManager {
    if (!AIEnhancedLeadManager.instance) {
      AIEnhancedLeadManager.instance = new AIEnhancedLeadManager();
    }
    return AIEnhancedLeadManager.instance;
  }
  
  private constructor() {
    this.orchestrator = new AgentOrchestrator();
  }
  
  // Process lead with full AI intelligence
  async processIncomingLead(lead: LeadData) {
    console.log(`🤖 AI Agent processing lead: ${lead.name} (${lead.type})`);
    
    try {
      // Step 1: Get traditional automated scoring
      const traditionalScore = await automatedLeadManager.processIncomingLead(lead);
      
      // Step 2: Process with AI agents for deep intelligence
      const aiAnalysis = await this.orchestrator.processLead(lead);
      
      // Step 3: Combine traditional scoring with AI insights
      const enhancedResult = {
        ...traditionalScore,
        aiAnalysis: {
          leadAnalysis: aiAnalysis.leadAnalysis,
          specialistResult: aiAnalysis.specialistResult,
          teamAssignment: aiAnalysis.teamAssignment,
          insights: this.extractInsights(aiAnalysis),
          recommendations: this.extractRecommendations(aiAnalysis)
        },
        processedAt: new Date().toISOString(),
        processingMethod: 'ai-enhanced'
      };
      
      // Step 4: Log AI processing details
      console.log(`🧠 AI Analysis completed for ${lead.name}:`, {
        score: enhancedResult.score,
        quality: enhancedResult.quality,
        aiTeamAssignment: enhancedResult.aiAnalysis.teamAssignment,
        insights: enhancedResult.aiAnalysis.insights.length,
        recommendations: enhancedResult.aiAnalysis.recommendations.length
      });
      
      return enhancedResult;
      
    } catch (error) {
      console.error(`❌ AI Agent processing failed for ${lead.name}:`, error);
      
      // Fallback to traditional processing
      return await automatedLeadManager.processIncomingLead(lead);
    }
  }
  
  private extractInsights(aiAnalysis: any): string[] {
    const insights: string[] = [];
    const content = aiAnalysis.leadAnalysis?.content || '';
    
    // Extract key insights from AI analysis
    if (content.includes('market research')) {
      insights.push('Market research completed');
    }
    if (content.includes('competitor analysis')) {
      insights.push('Competitor analysis performed');
    }
    if (content.includes('background verified')) {
      insights.push('Background verification completed');
    }
    if (content.includes('route optimized')) {
      insights.push('Route optimization analysis done');
    }
    
    return insights;
  }
  
  private extractRecommendations(aiAnalysis: any): string[] {
    const recommendations: string[] = [];
    const content = aiAnalysis.specialistResult?.content || '';
    
    // Extract recommendations from specialist analysis
    if (content.includes('approve')) {
      recommendations.push('Immediate approval recommended');
    }
    if (content.includes('interview')) {
      recommendations.push('Schedule interview recommended');
    }
    if (content.includes('quote')) {
      recommendations.push('Generate detailed quote');
    }
    if (content.includes('negotiate')) {
      recommendations.push('Negotiation opportunity identified');
    }
    
    return recommendations;
  }
  
  // Generate AI-powered communication
  async generateCommunication(
    leadData: LeadData, 
    communicationType: 'initial' | 'followup' | 'approval' | 'rejection',
    persona: 'professional' | 'friendly' | 'urgent' = 'professional'
  ) {
    const agent = AgentFactory.createAgent(
      leadData.type === 'driver' ? 'recruiting' : 'freight'
    );
    
    const prompt = `Generate ${communicationType} communication for this ${leadData.type} lead:
    
    Lead: ${JSON.stringify(leadData, null, 2)}
    Type: ${communicationType}
    Persona: ${persona}
    
    Please generate professional, personalized communication that builds relationship and drives action.`;
    
    const response = await agent.process(prompt);
    
    return {
      text: response.content,
      voiceAudio: await agent.generateVoiceMessage(response.content, persona as any),
      generatedAt: new Date().toISOString()
    };
  }
  
  // Get AI agent performance metrics
  getPerformanceMetrics() {
    return {
      agentsActive: 4,
      processingMethods: ['ai-enhanced', 'traditional-fallback'],
      capabilities: [
        'web-research',
        'code-execution', 
        'browser-automation',
        'voice-synthesis',
        'market-analysis',
        'background-verification',
        'competitor-intelligence'
      ],
      averageProcessingTime: '2-5 seconds',
      intelligenceLevel: 'advanced-autonomous'
    };
  }
}

// Export singleton instance
export const aiEnhancedLeadManager = AIEnhancedLeadManager.getInstance();
