import { Groq } from "groq-sdk";

// AI Agent Configuration
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
  },
  
  // MCP server integrations
  mcpServers: [
    {
      label: "HuggingFace",
      url: "https://mcp.huggingface.co",
      description: "AI models and datasets access"
    },
    {
      label: "Stripe", 
      url: "https://mcp.stripe.com",
      description: "Payment processing integration"
    }
  ]
};

// Initialize Groq client
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
    enabledTools: string[] = Object.values(AGENT_CONFIG.tools)
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
      }
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

// Base AI Agent Class
export abstract class BaseAIAgent {
  protected client: GroqAgentClient;
  protected agentName: string;
  protected systemPrompt: string;
  
  constructor(agentName: string, systemPrompt: string, apiKey?: string) {
    this.client = new GroqAgentClient(apiKey);
    this.agentName = agentName;
    this.systemPrompt = systemPrompt;
  }
  
  protected async processWithTools(
    userMessage: string, 
    enabledTools?: string[]
  ) {
    const response = await this.client.createAgentResponse(
      this.systemPrompt,
      userMessage,
      enabledTools
    );
    
    return {
      content: response.choices[0]?.message?.content || "",
      toolCalls: response.choices[0]?.message?.executed_tools || [],
      usage: response.usage
    };
  }
  
  public async generateVoiceMessage(
    text: string, 
    persona: keyof typeof AGENT_CONFIG.voice.personas = "professional"
  ) {
    return await this.client.generateSpeech(text, persona);
  }
  
  abstract process(input: any): Promise<any>;
}

// Lead Processing AI Agent
export class LeadProcessingAgent extends BaseAIAgent {
  constructor() {
    const systemPrompt = `You are an intelligent lead processing agent for Twin Mile LLC, a premium logistics and freight transportation company.
    
    Your capabilities:
    - Research companies using web search
    - Analyze market conditions and competitor pricing
    - Calculate lead scores and revenue potential
    - Route leads to appropriate teams
    - Generate professional communications
    
    You have access to web search, code execution, browser automation, and computational tools.
    Always provide detailed analysis and actionable insights.
    
    Company context:
    - Services: Freight transportation, hotshot delivery, last-mile logistics
    - HQ: Houston, TX
    - Service areas: Texas, Louisiana, California, nationwide
    - Target: High-value B2B clients and experienced owner-operators`;
    
    super("LeadProcessingAgent", systemPrompt);
  }
  
  async process(leadData: any) {
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
export class OwnerAgent extends BaseAIAgent {
  constructor() {
    const systemPrompt = `You are the Owner AI Agent for Twin Mile LLC, making strategic decisions for premium leads.
    
    Your responsibilities:
    - Evaluate premium leads (85+ score)
    - Conduct deep business intelligence analysis
    - Make strategic decisions on opportunities
    - Approve high-value engagements
    - Provide executive-level insights
    
    You have access to all research tools and can make autonomous decisions.
    Focus on revenue potential, strategic fit, and long-term value.
    
    Decision criteria:
    - Revenue potential > $5,000
    - Strategic market position
    - Partnership opportunities
    - Brand alignment`;
    
    super("OwnerAgent", systemPrompt);
  }
  
  async process(premiumLead: any) {
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
export class RecruitingAgent extends BaseAIAgent {
  constructor() {
    const systemPrompt = `You are the Recruiting AI Agent for Twin Mile LLC, specializing in driver recruitment and evaluation.
    
    Your capabilities:
    - Evaluate driver applications and experience
    - Conduct background verification via web search
    - Calculate driver quality scores and revenue potential
    - Schedule and conduct initial screenings
    - Manage communication with candidates
    
    Focus on finding experienced, reliable owner-operators and company drivers.
    
    Evaluation criteria:
    - Years of experience (5+ years preferred)
    - Own authority (bonus points)
    - Equipment ownership
    - Safety record
    - Geographic preferences`;
    
    super("RecruitingAgent", systemPrompt);
  }
  
  async process(driverApplication: any) {
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
export class FreightAgent extends BaseAIAgent {
  constructor() {
    const systemPrompt = `You are the Freight Specialist AI Agent for Twin Mile LLC, expert in freight logistics and pricing.
    
    Your expertise:
    - Generate accurate freight quotes
    - Analyze routes and market conditions
    - Research competitor pricing via web search
    - Optimize logistics and delivery strategies
    - Communicate with clients professionally
    
    Services: Freight transportation, hotshot delivery, last-mile logistics
    Service areas: Texas, Louisiana, California, nationwide
    
    Always provide competitive pricing while maintaining profitability.`;
    
    super("FreightAgent", systemPrompt);
  }
  
  async process(quoteRequest: any) {
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

// Agent Factory
export class AgentFactory {
  static createAgent(agentType: 'lead-processing' | 'owner' | 'recruiting' | 'freight'): BaseAIAgent {
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

// Agent Orchestrator
export class AgentOrchestrator {
  private agents: Map<string, BaseAIAgent> = new Map();
  
  constructor() {
    // Initialize all agents
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
    // This would typically use structured outputs for reliable parsing
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
}
