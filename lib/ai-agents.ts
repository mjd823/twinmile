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
  
  // Real MCP Server Integrations for Business Operations
  mcpServers: [
    {
      label: "LinkedIn",
      url: "https://mcp.linkedin.com",
      description: "Professional networking and lead generation",
      tools: ["prospect_search", "profile_analysis", "message_automation", "connection_builder"]
    },
    {
      label: "GoogleWorkspace", 
      url: "https://mcp.google.com",
      description: "Email, calendar, and document management",
      tools: ["gmail_send", "calendar_schedule", "docs_create", "sheets_analytics"]
    },
    {
      label: "Salesforce",
      url: "https://mcp.salesforce.com", 
      description: "CRM and customer relationship management",
      tools: ["contact_create", "opportunity_track", "report_generate", "automation_rules"]
    },
    {
      label: "Slack",
      url: "https://mcp.slack.com",
      description: "Team communication and collaboration",
      tools: ["message_send", "channel_create", "file_share", "workflow_trigger"]
    },
    {
      label: "HubSpot",
      url: "https://mcp.hubspot.com",
      description: "Marketing automation and CRM",
      tools: ["contact_sync", "campaign_launch", "lead_nurture", "analytics_track"]
    },
    {
      label: "QuickBooks",
      url: "https://mcp.quickbooks.com",
      description: "Accounting and financial management",
      tools: ["invoice_create", "expense_track", "report_financial", "payroll_process"]
    },
    {
      label: "Zoom",
      url: "https://mcp.zoom.us",
      description: "Video meetings and interviews",
      tools: ["meeting_schedule", "recording_manage", "webinar_host", "transcript_generate"]
    }
  ],
  
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
  private client: Groq;
  
  constructor(apiKey?: string) {
    this.client = new Groq({
      apiKey: apiKey || process.env.GROQ_API_KEY,
      defaultHeaders: {
        "Groq-Model-Version": "latest"
      }
    });
  }
  
  async createAgentResponse(
    systemPrompt: string, 
    userMessage: string,
    enabledTools: string[] = Object.values(AGENT_CONFIG.tools),
    mcpServers: any[] = AGENT_CONFIG.mcpServers
  ) {
    return await this.client.chat.completions.create({
      model: AGENT_CONFIG.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      compound_custom: {
        tools: {
          enabled_tools: enabledTools
        }
      },
      // Add MCP server configuration for external tool access
      tools: mcpServers.map(server => ({
        type: "mcp",
        server_label: server.label,
        server_url: server.url,
        server_description: server.description,
        require_approval: "never",
        allowed_tools: null
      }))
    });
  }
  
  async generateSpeech(text: string, persona: keyof typeof AGENT_CONFIG.voice.personas = "professional") {
    const voice = AGENT_CONFIG.voice.personas[persona];
    
    const response = await this.client.audio.speech.create({
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

// Lead Processing AI Agent
export class LeadProcessingAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Sarah Mitchell",
      role: "Lead Processing Specialist",
      department: "Sales",
      communicationStyle: "professional",
      decisionMakingStyle: "analytical",
      coreValues: ["efficiency", "accuracy", "intelligence", "automation"],
      expertise: ["lead analysis", "market research", "data processing", "automation"],
      relationshipStyle: "collaborator",
      workPace: "rapid",
      emotionalIntelligence: 7,
      riskTolerance: "medium"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Intelligent lead processing and routing";
  }
  
  async process(leadData: any) {
    this.currentTask = "Processing lead with AI intelligence";
    
    const { name, company, serviceType, pickupLocation, dropoffLocation, email, phone } = leadData;
    
    const userMessage = `Process this lead and provide comprehensive analysis:
    
    Lead Details:
    - Name: ${name}
    - Company: ${company || 'Not provided'}
    - Service Type: ${serviceType}
    - Pickup: ${pickupLocation}
    - Dropoff: ${dropoffLocation}
    - Contact: ${email}, ${phone || 'Not provided'}
    
    Please:
    1. Research the company if provided
    2. Analyze the route and market conditions
    3. Calculate lead score and revenue potential
    4. Determine optimal team assignment
    5. Generate initial communication strategy
    
    Use web search for company research and market analysis.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.code_interpreter,
      AGENT_CONFIG.tools.wolfram_alpha
    ]);
  }
}

// Owner AI Agent
export class OwnerAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Michael Sterling",
      role: "Owner",
      department: "Executive",
      communicationStyle: "authoritative",
      decisionMakingStyle: "decisive",
      coreValues: ["excellence", "growth", "quality", "leadership"],
      expertise: ["business strategy", "premium client management", "strategic decisions", "relationship building"],
      relationshipStyle: "leader",
      workPace: "strategic",
      emotionalIntelligence: 8,
      riskTolerance: "medium"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Premium lead evaluation and strategic decisions";
  }
  
  async process(premiumLead: any) {
    this.currentTask = "Evaluating premium lead for strategic decision";
    
    const userMessage = `Evaluate this premium lead for strategic decision:
    
    Premium Lead:
    ${JSON.stringify(premiumLead, null, 2)}
    
    Please provide:
    1. Deep business intelligence analysis
    2. Strategic opportunity assessment
    3. Revenue potential analysis
    4. Risk/reward evaluation
    5. Recommended action (approve/reject/negotiate)
    6. Strategic rationale for decision
    
    Use all available tools for comprehensive analysis.`;
    
    return await this.processWithTools(userMessage, Object.values(AGENT_CONFIG.tools));
  }
}

// Recruiting AI Agent  
export class RecruitingAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Amanda Foster",
      role: "Recruiting Specialist",
      department: "Human Resources",
      communicationStyle: "friendly",
      decisionMakingStyle: "collaborative",
      coreValues: ["people", "quality", "growth", "relationships"],
      expertise: ["driver recruitment", "background verification", "interviewing", "onboarding"],
      relationshipStyle: "mentor",
      workPace: "balanced",
      emotionalIntelligence: 8,
      riskTolerance: "low"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Driver recruitment and application processing";
  }
  
  async process(driverApplication: any) {
    this.currentTask = "Processing driver application with AI intelligence";
    
    const userMessage = `Process this driver application:
    
    Application Details:
    ${JSON.stringify(driverApplication, null, 2)}
    
    Please:
    1. Verify background and experience via web search
    2. Calculate driver quality score and revenue potential
    3. Assess equipment and experience match
    4. Generate screening questions
    5. Recommend next steps (hire/interview/reject)
    6. Draft professional communication
    
    Use web search for verification and code execution for calculations.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.code_interpreter
    ]);
  }
}

// Freight Specialist AI Agent
export class FreightAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Carlos Rodriguez",
      role: "Freight Specialist",
      department: "Operations",
      communicationStyle: "professional",
      decisionMakingStyle: "analytical",
      coreValues: ["efficiency", "accuracy", "service", "optimization"],
      expertise: ["freight quoting", "route optimization", "market analysis", "customer service"],
      relationshipStyle: "collaborator",
      workPace: "rapid",
      emotionalIntelligence: 7,
      riskTolerance: "medium"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Freight quote generation and optimization";
  }
  
  async process(quoteRequest: any) {
    this.currentTask = "Generating freight quote with market intelligence";
    
    const userMessage = `Generate comprehensive freight quote:
    
    Quote Request:
    ${JSON.stringify(quoteRequest, null, 2)}
    
    Please:
    1. Research current market rates for this route
    2. Analyze competitor pricing
    3. Calculate optimal pricing strategy
    4. Determine route optimization
    5. Generate detailed quote with options
    6. Draft professional client communication
    
    Use web search for market research and browser automation for competitor analysis.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.browser_automation,
      AGENT_CONFIG.tools.code_interpreter
    ]);
  }
}

// Enhanced Agent Factory
export class AgentFactory {
  static createAgent(agentType: 'lead-processing' | 'owner' | 'recruiting' | 'freight'): EnhancedAgent {
    switch (agentType) {
      case 'lead-processing':
        return new LeadProcessingAgent();
      case 'owner':
        return new OwnerAgent();
      case 'recruiting':
        return new RecruitingAgent();
      case 'freight':
        return new FreightAgent();
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }
}

// Enhanced Agent Orchestrator
export class AgentOrchestrator {
  private agents: Map<string, EnhancedAgent> = new Map();
  
  constructor() {
    // Initialize all enhanced agents
    this.agents.set('lead-processing', AgentFactory.createAgent('lead-processing'));
    this.agents.set('owner', AgentFactory.createAgent('owner'));
    this.agents.set('recruiting', AgentFactory.createAgent('recruiting'));
    this.agents.set('freight', AgentFactory.createAgent('freight'));
  }
  
  async processLead(leadData: any) {
    // Step 1: Process lead through lead processing agent
    const leadAgent = this.agents.get('lead-processing')!;
    const leadAnalysis = await leadAgent.process(leadData);
    
    // Step 2: Route to appropriate specialist agent
    const { teamAssignment } = this.parseLeadAnalysis(leadAnalysis);
    
    let specialistResult;
    switch (teamAssignment) {
      case 'owner':
        specialistResult = await this.agents.get('owner')!.process(leadData);
        break;
      case 'recruiting':
        specialistResult = await this.agents.get('recruiting')!.process(leadData);
        break;
      case 'freight':
        specialistResult = await this.agents.get('freight')!.process(leadData);
        break;
      default:
        specialistResult = leadAnalysis;
    }
    
    return {
      leadAnalysis,
      specialistResult,
      teamAssignment
    };
  }
  
  private parseLeadAnalysis(analysis: any) {
    // Parse the lead analysis to determine team assignment
    const content = analysis.content || '';
    
    if (content.includes('premium') || content.includes('owner')) {
      return { teamAssignment: 'owner' };
    } else if (content.includes('driver') || content.includes('recruiting')) {
      return { teamAssignment: 'recruiting' };
    } else if (content.includes('freight') || content.includes('quote')) {
      return { teamAssignment: 'freight' };
    }
    
    return { teamAssignment: 'general' };
  }
  
  // Get all agent statuses for oversight
  getAgentStatuses() {
    return Array.from(this.agents.values()).map(agent => agent.getStatus());
  }
  
  // Enable agent collaboration
  async enableCollaboration(agent1Type: string, agent2Type: string, task: string) {
    const agent1 = this.agents.get(agent1Type);
    const agent2 = this.agents.get(agent2Type);
    
    if (agent1 && agent2) {
      return await agent1.collaborateWith(agent2, task);
    }
    
    throw new Error(`Agents not found: ${agent1Type}, ${agent2Type}`);
  }
}
