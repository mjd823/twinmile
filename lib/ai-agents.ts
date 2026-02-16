import { Groq } from "groq-sdk";

// Enhanced AI Agent Configuration with Real MCP Integration
export const AGENT_CONFIG = {
  // Groq Compound System for multi-tool workflows
  model: "groq/compound" as const,
  
  // Available built-in tools
  tools: {
    web_search: "web_search",
    code_interpreter: "code_interpreter", 
    visit_website: "visit_website",
    browser_automation: "browser_automation",
    wolfram_alpha: "wolfram_alpha"
  },
  
  // Future MCP Server Integrations (not yet connected — requires real server endpoints)
  // When connecting a real MCP server, add it here with a valid URL.
  mcpServers: [] as Array<{
    label: string;
    url: string;
    description: string;
    tools: string[];
    status: 'connected' | 'planned';
  }>,
  
  // Voice synthesis configuration
  voice: {
    model: "canopylabs/orpheus-v1-english" as const,
    personas: {
      professional: "daniel",
      friendly: "troy", 
      energetic: "austin",
      warm: "autumn",
      confident: "hannah",
      authoritative: "diana"
    }
  }
};

// Agent Personality System
export interface AgentPersonality {
  name: string;
  role: string;
  department: string;
  communicationStyle: 'professional' | 'friendly' | 'formal' | 'casual' | 'enthusiastic' | 'authoritative' | 'warm';
  decisionMakingStyle: 'analytical' | 'intuitive' | 'collaborative' | 'decisive' | 'strategic';
  coreValues: string[];
  expertise: string[];
  relationshipStyle: 'mentor' | 'collaborator' | 'leader' | 'supporter';
  workPace: 'methodical' | 'rapid' | 'balanced' | 'strategic';
  emotionalIntelligence: number; // 1-10
  riskTolerance: 'low' | 'medium' | 'high';
}

// Agent Memory System
export interface AgentMemory {
  recentInteractions: Array<{
    timestamp: string;
    agent: string;
    context: string;
    outcome: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  learnedPatterns: Array<{
    pattern: string;
    success_rate: number;
    last_used: string;
  }>;
  relationshipHistory: Map<string, number>; // Relationship strength with other agents
  businessKnowledge: Map<string, any>; // Learned business insights
}

// Agent Relationship System
export interface AgentRelationship {
  targetAgent: string;
  relationshipType: 'reports_to' | 'collaborates_with' | 'mentors' | 'supports';
  strength: number; // 1-10
  communicationFrequency: 'hourly' | 'daily' | 'weekly' | 'as_needed';
  lastInteraction: string;
}

// Initialize Enhanced Groq Client
export class GroqAgentClient {
  private client: Groq | null = null;
  private apiKey: string | undefined;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    // Don't initialize client in constructor - lazy load on first use
  }
  
  private getClient(): Groq {
    if (!this.client) {
      const key = this.apiKey || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);
      if (!key) {
        throw new Error('Groq API key not available. AI features require server-side execution.');
      }
      this.client = new Groq({
        apiKey: key,
        defaultHeaders: {
          "Groq-Model-Version": "latest"
        }
      });
    }
    return this.client;
  }
  
  async createAgentResponse(
    systemPrompt: string, 
    userMessage: string,
    enabledTools: string[] = Object.values(AGENT_CONFIG.tools),
    mcpServers: any[] = AGENT_CONFIG.mcpServers
  ) {
    const createParams: any = {
      model: AGENT_CONFIG.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      compound_custom: {
        tools: {
          enabled_tools: enabledTools
        }
      }
    };

    // Only include MCP tools if there are connected servers
    if (mcpServers.length > 0) {
      createParams.tools = mcpServers.map((server: any) => ({
        type: "mcp",
        server_label: server.label,
        server_url: server.url,
        server_description: server.description,
        require_approval: "never",
        allowed_tools: null
      }));
    }

    return await this.getClient().chat.completions.create(createParams);
  }
  
  async generateSpeech(text: string, persona: keyof typeof AGENT_CONFIG.voice.personas = "professional") {
    const voice = AGENT_CONFIG.voice.personas[persona];
    
    const response = await this.getClient().audio.speech.create({
      model: AGENT_CONFIG.voice.model,
      voice: voice,
      input: text,
      response_format: "wav"
    });
    
    return Buffer.from(await response.arrayBuffer());
  }
}

// Enhanced Base AI Agent Class with Personality and Memory
export abstract class EnhancedAgent {
  protected client: GroqAgentClient;
  public personality: AgentPersonality;
  public memory: AgentMemory;
  public relationships: Map<string, AgentRelationship>;
  public agentId: string;
  public isActive: boolean = false;
  public currentTask: string = '';
  public performance: PerformanceMetrics;
  
  constructor(personality: AgentPersonality, apiKey?: string) {
    this.client = new GroqAgentClient(apiKey);
    this.personality = personality;
    this.agentId = `${personality.role.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    this.memory = {
      recentInteractions: [],
      learnedPatterns: [],
      relationshipHistory: new Map(),
      businessKnowledge: new Map()
    };
    this.relationships = new Map();
    this.performance = {
      tasksCompleted: 0,
      successRate: 0,
      averageResponseTime: 0,
      collaborationScore: 0,
      innovationScore: 0
    };
  }
  
  // Core processing with personality-driven responses
  protected async processWithTools(
    userMessage: string, 
    enabledTools?: string[],
    context?: any
  ) {
    const personalityPrompt = this.buildPersonalityPrompt();
    const systemPrompt = `${personalityPrompt}
    
    Current Context: ${JSON.stringify(context || {}, null, 2)}
    Recent Interactions: ${JSON.stringify(this.memory.recentInteractions.slice(-3), null, 2)}
    
    Remember: You are ${this.personality.name}, ${this.personality.role}. Respond in your authentic style.`;
    
    const response = await this.client.createAgentResponse(
      systemPrompt,
      userMessage,
      enabledTools
    );
    
    // Update memory and performance
    this.updateMemory(userMessage, response);
    this.updatePerformance(response);
    
    return {
      content: response.choices[0]?.message?.content || "",
      toolCalls: response.choices[0]?.message?.executed_tools || [],
      usage: response.usage,
      agentId: this.agentId,
      personality: this.personality.name,
      timestamp: new Date().toISOString()
    };
  }
  
  private buildPersonalityPrompt(): string {
    return `You are ${this.personality.name}, ${this.personality.role} at Twin Mile LLC.
    
    Personality Profile:
    - Communication Style: ${this.personality.communicationStyle}
    - Decision Making: ${this.personality.decisionMakingStyle}
    - Core Values: ${this.personality.coreValues.join(', ')}
    - Expertise: ${this.personality.expertise.join(', ')}
    - Relationship Style: ${this.personality.relationshipStyle}
    - Work Pace: ${this.personality.workPace}
    - Emotional Intelligence: ${this.personality.emotionalIntelligence}/10
    - Risk Tolerance: ${this.personality.riskTolerance}
    
    You have access to advanced AI tools including web search, code execution, browser automation, and external business systems through MCP servers.
    
    Always respond authentically as yourself, using your unique communication style and decision-making approach.
    Build and maintain relationships with other team members.
    Learn from every interaction and improve your performance over time.`;
  }
  
  // Agent collaboration system
  async collaborateWith(otherAgent: EnhancedAgent, task: string, context?: any) {
    console.log(`🤝 ${this.personality.name} collaborating with ${otherAgent.personality.name} on: ${task}`);
    
    // Update relationship strength
    this.updateRelationship(otherAgent.agentId, 'collaborates_with');
    
    // Process collaboration
    const collaborationContext = {
      ...context,
      collaboration: {
        partner: otherAgent.personality.name,
        partnerRole: otherAgent.personality.role,
        task: task
      }
    };
    
    const result = await this.processWithTools(
      `Collaborate with ${otherAgent.personality.name} (${otherAgent.personality.role}) on: ${task}`,
      undefined,
      collaborationContext
    );
    
    // Record collaboration in memory
    this.memory.recentInteractions.push({
      timestamp: new Date().toISOString(),
      agent: otherAgent.personality.name,
      context: task,
      outcome: 'collaboration_completed',
      sentiment: 'positive'
    });
    
    return result;
  }
  
  // Memory and learning system
  private updateMemory(input: string, response: any) {
    this.memory.recentInteractions.push({
      timestamp: new Date().toISOString(),
      agent: 'user',
      context: input,
      outcome: response.content,
      sentiment: this.analyzeSentiment(response.content)
    });
    
    // Keep only last 50 interactions
    if (this.memory.recentInteractions.length > 50) {
      this.memory.recentInteractions = this.memory.recentInteractions.slice(-50);
    }
  }
  
  private updatePerformance(response: any) {
    this.performance.tasksCompleted++;
    
    // Calculate success rate based on tool execution success
    const successfulTools = response.toolCalls?.filter((tool: any) => tool.output) || [];
    this.performance.successRate = (successfulTools.length / (response.toolCalls?.length || 1)) * 100;
    
    // Update response time
    this.performance.averageResponseTime = response.usage?.total_tokens || 0;
  }
  
  private updateRelationship(agentId: string, type: string) {
    const existing = this.relationships.get(agentId);
    if (existing) {
      existing.strength = Math.min(10, existing.strength + 0.1);
      existing.lastInteraction = new Date().toISOString();
    } else {
      this.relationships.set(agentId, {
        targetAgent: agentId,
        relationshipType: type as any,
        strength: 1.0,
        communicationFrequency: 'daily',
        lastInteraction: new Date().toISOString()
      });
    }
  }
  
  private analyzeSentiment(content: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['excellent', 'great', 'successful', 'completed', 'achieved', 'optimal'];
    const negativeWords = ['failed', 'error', 'issue', 'problem', 'concern', 'difficult'];
    
    const lowerContent = content.toLowerCase();
    
    if (positiveWords.some(word => lowerContent.includes(word))) return 'positive';
    if (negativeWords.some(word => lowerContent.includes(word))) return 'negative';
    return 'neutral';
  }
  
  public async generateVoiceMessage(
    text: string, 
    persona: keyof typeof AGENT_CONFIG.voice.personas = "professional"
  ) {
    return await this.client.generateSpeech(text, persona);
  }
  
  // Get agent status for oversight dashboard
  public getStatus() {
    return {
      agentId: this.agentId,
      name: this.personality.name,
      role: this.personality.role,
      department: this.personality.department,
      isActive: this.isActive,
      currentTask: this.currentTask,
      performance: this.performance,
      relationships: Array.from(this.relationships.entries()).map(([id, rel]) => ({ id, ...rel })),
      recentInteractions: this.memory.recentInteractions.slice(-5),
      personality: this.personality
    };
  }
  
  abstract process(input: any): Promise<any>;
}

// Performance Metrics Interface
export interface PerformanceMetrics {
  tasksCompleted: number;
  successRate: number;
  averageResponseTime: number;
  collaborationScore: number;
  innovationScore: number;
}

// Note: The 8-agent business organization is defined in business-organization.ts
// which imports EnhancedAgent, AgentPersonality, and AGENT_CONFIG from this file.
// All agent classes (CEO, Sales Director, Lead Generation, Operations, HR, Marketing,
// Finance, Customer Success) live in business-organization.ts as the single source of truth.
