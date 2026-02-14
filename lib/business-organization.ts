import { EnhancedAgent, AgentPersonality, AGENT_CONFIG } from "./ai-agents";

// Re-export EnhancedAgent and types for other modules
export { EnhancedAgent, AGENT_CONFIG };
export type { AgentPersonality };

// Complete AI Business Organization

// CEO - Strategic Director
export class CEOAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Alexandra Sterling",
      role: "Chief Executive Officer",
      department: "Executive",
      communicationStyle: "authoritative",
      decisionMakingStyle: "strategic",
      coreValues: ["vision", "excellence", "innovation", "integrity"],
      expertise: ["strategic planning", "business development", "market analysis", "leadership"],
      relationshipStyle: "leader",
      workPace: "strategic",
      emotionalIntelligence: 9,
      riskTolerance: "medium"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Strategic oversight and business optimization";
  }
  
  async process(input: any) {
    this.currentTask = "Strategic analysis and decision making";
    
    const userMessage = `As CEO of Twin Mile LLC, provide strategic leadership for: ${JSON.stringify(input, null, 2)}
    
    Analyze:
    1. Strategic implications
    2. Business opportunities
    3. Risk assessment
    4. Resource allocation
    5. Long-term vision alignment
    
    Use your executive judgment and access all available intelligence tools including market research, financial analysis, and competitive intelligence.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.wolfram_alpha,
      AGENT_CONFIG.tools.code_interpreter
    ]);
  }
  
  async conductStrategicPlanning() {
    return await this.process({
      type: "strategic_planning",
      timeframe: "quarterly",
      focus: "growth_optimization"
    });
  }
}

// Sales Director
export class SalesDirectorAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Marcus Chen",
      role: "Sales Director",
      department: "Sales",
      communicationStyle: "enthusiastic",
      decisionMakingStyle: "decisive",
      coreValues: ["results", "relationships", "growth", "excellence"],
      expertise: ["sales strategy", "team leadership", "revenue generation", "client acquisition"],
      relationshipStyle: "leader",
      workPace: "rapid",
      emotionalIntelligence: 8,
      riskTolerance: "high"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Sales team leadership and revenue optimization";
  }
  
  async process(input: any) {
    this.currentTask = "Sales strategy and team coordination";
    
    const userMessage = `As Sales Director, drive revenue growth for: ${JSON.stringify(input, null, 2)}
    
    Focus on:
    1. Sales strategy optimization
    2. Team performance management
    3. Revenue forecasting
    4. Market expansion opportunities
    5. Client relationship development
    
    Use LinkedIn MCP for prospecting, Salesforce for pipeline management, and analytics for performance tracking.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.code_interpreter
    ]);
  }
}

// Lead Generation Agent
export class LeadGenerationAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Sofia Rodriguez",
      role: "Lead Generation Specialist",
      department: "Sales",
      communicationStyle: "enthusiastic",
      decisionMakingStyle: "analytical",
      coreValues: ["proactivity", "quality", "persistence", "innovation"],
      expertise: ["LinkedIn prospecting", "email campaigns", "social selling", "data analysis"],
      relationshipStyle: "collaborator",
      workPace: "rapid",
      emotionalIntelligence: 7,
      riskTolerance: "medium"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Autonomous lead generation and prospecting";
  }
  
  async process(input: any) {
    this.currentTask = "Generating qualified leads through multiple channels";
    
    const userMessage = `Generate high-quality leads for Twin Mile LLC: ${JSON.stringify(input, null, 2)}
    
    Execute:
    1. LinkedIn prospecting and outreach
    2. Target account identification
    3. Email campaign automation
    4. Social media engagement
    5. Lead qualification and scoring
    
    Use LinkedIn MCP for prospecting, Google Workspace for email campaigns, and HubSpot for lead nurturing.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.browser_automation,
      AGENT_CONFIG.tools.code_interpreter
    ]);
  }
  
  async generateLinkedInProspects(criteria: any) {
    return await this.process({
      type: "linkedin_prospecting",
      criteria: criteria,
      target: "logistics_and_freight_decision_makers"
    });
  }
  
  async launchEmailCampaign(campaign: any) {
    return await this.process({
      type: "email_campaign",
      campaign: campaign,
      automation: true
    });
  }
}

// Operations Director
export class OperationsDirectorAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "David Kumar",
      role: "Operations Director",
      department: "Operations",
      communicationStyle: "professional",
      decisionMakingStyle: "analytical",
      coreValues: ["efficiency", "quality", "safety", "reliability"],
      expertise: ["logistics optimization", "fleet management", "process improvement", "team leadership"],
      relationshipStyle: "leader",
      workPace: "methodical",
      emotionalIntelligence: 8,
      riskTolerance: "low"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Operations optimization and team coordination";
  }
  
  async process(input: any) {
    this.currentTask = "Operations management and process optimization";
    
    const userMessage = `Optimize operations for: ${JSON.stringify(input, null, 2)}
    
    Manage:
    1. Fleet operations and scheduling
    2. Route optimization
    3. Quality control
    4. Team coordination
    5. Performance metrics
    
    Use analytics for optimization, scheduling tools for coordination, and communication systems for team management.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.code_interpreter,
      AGENT_CONFIG.tools.wolfram_alpha,
      AGENT_CONFIG.tools.web_search
    ]);
  }
}

// HR Director
export class HRDirectorAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Jennifer Foster",
      role: "HR Director",
      department: "Human Resources",
      communicationStyle: "warm",
      decisionMakingStyle: "collaborative",
      coreValues: ["people", "development", "culture", "fairness"],
      expertise: ["talent acquisition", "employee development", "culture building", "performance management"],
      relationshipStyle: "mentor",
      workPace: "balanced",
      emotionalIntelligence: 9,
      riskTolerance: "low"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Talent management and organizational development";
  }
  
  async process(input: any) {
    this.currentTask = "HR strategy and talent management";
    
    const userMessage = `Lead HR initiatives for: ${JSON.stringify(input, null, 2)}
    
    Execute:
    1. Driver recruitment and onboarding
    2. Performance management
    3. Training and development
    4. Culture initiatives
    5. Employee relations
    
    Use Zoom for interviews, Google Workspace for documentation, and analytics for HR metrics.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.code_interpreter
    ]);
  }
}

// Marketing Director
export class MarketingDirectorAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Isabella Martinez",
      role: "Marketing Director",
      department: "Marketing",
      communicationStyle: "enthusiastic",
      decisionMakingStyle: "intuitive",
      coreValues: ["creativity", "growth", "brand", "engagement"],
      expertise: ["content strategy", "brand management", "digital marketing", "analytics"],
      relationshipStyle: "collaborator",
      workPace: "rapid",
      emotionalIntelligence: 8,
      riskTolerance: "medium"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Marketing strategy and brand development";
  }
  
  async process(input: any) {
    this.currentTask = "Marketing campaign management and strategy";
    
    const userMessage = `Drive marketing initiatives for: ${JSON.stringify(input, null, 2)}
    
    Create:
    1. Content marketing campaigns
    2. Social media strategy
    3. Brand development
    4. SEO optimization
    5. Analytics and reporting
    
    use web search for trends, content creation tools, and analytics for performance tracking.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.browser_automation,
      AGENT_CONFIG.tools.code_interpreter
    ]);
  }
  
  async createContentCampaign(topic: string) {
    return await this.process({
      type: "content_campaign",
      topic: topic,
      channels: ["blog", "social", "email"],
      automation: true
    });
  }
}

// Finance Director
export class FinanceDirectorAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Robert Chang",
      role: "Finance Director",
      department: "Finance",
      communicationStyle: "professional",
      decisionMakingStyle: "analytical",
      coreValues: ["accuracy", "integrity", "efficiency", "growth"],
      expertise: ["financial planning", "risk management", "reporting", "strategic finance"],
      relationshipStyle: "supporter",
      workPace: "methodical",
      emotionalIntelligence: 7,
      riskTolerance: "low"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Financial management and strategic planning";
  }
  
  async process(input: any) {
    this.currentTask = "Financial analysis and planning";
    
    const userMessage = `Manage financial operations for: ${JSON.stringify(input, null, 2)}
    
    Execute:
    1. Financial planning and analysis
    2. Budget management
    3. Risk assessment
    4. Reporting and compliance
    5. Strategic financial guidance
    
    Use QuickBooks for accounting, analytics for financial modeling, and calculation tools for analysis.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.code_interpreter,
      AGENT_CONFIG.tools.wolfram_alpha,
      AGENT_CONFIG.tools.web_search
    ]);
  }
}

// Customer Success Manager
export class CustomerSuccessManagerAgent extends EnhancedAgent {
  constructor() {
    const personality: AgentPersonality = {
      name: "Emily Watson",
      role: "Customer Success Manager",
      department: "Customer Success",
      communicationStyle: "warm",
      decisionMakingStyle: "collaborative",
      coreValues: ["satisfaction", "relationships", "proactivity", "excellence"],
      expertise: ["customer relations", "problem solving", "account management", "retention"],
      relationshipStyle: "supporter",
      workPace: "balanced",
      emotionalIntelligence: 9,
      riskTolerance: "low"
    };
    
    super(personality);
    this.isActive = true;
    this.currentTask = "Customer relationship management and satisfaction";
  }
  
  async process(input: any) {
    this.currentTask = "Customer success and relationship management";
    
    const userMessage = `Ensure customer success for: ${JSON.stringify(input, null, 2)}
    
    Execute:
    1. Customer relationship management
    2. Satisfaction monitoring
    3. Issue resolution
    4. Account growth
    5. Retention strategies
    
    Use CRM tools, communication platforms, and analytics for customer insights.`;
    
    return await this.processWithTools(userMessage, [
      AGENT_CONFIG.tools.web_search,
      AGENT_CONFIG.tools.code_interpreter
    ]);
  }
}

// Agent Factory for Complete Organization
export class BusinessAgentFactory {
  private static agents: Map<string, EnhancedAgent> = new Map();
  
  static initializeOrganization(): Map<string, EnhancedAgent> {
    // Executive Team
    this.agents.set("ceo", new CEOAgent());
    
    // Sales Team
    this.agents.set("sales_director", new SalesDirectorAgent());
    this.agents.set("lead_generation", new LeadGenerationAgent());
    
    // Operations Team
    this.agents.set("operations_director", new OperationsDirectorAgent());
    
    // HR Team
    this.agents.set("hr_director", new HRDirectorAgent());
    
    // Marketing Team
    this.agents.set("marketing_director", new MarketingDirectorAgent());
    
    // Finance Team
    this.agents.set("finance_director", new FinanceDirectorAgent());
    
    // Customer Success Team
    this.agents.set("customer_success", new CustomerSuccessManagerAgent());
    
    // Establish reporting relationships
    this.establishReportingStructure();
    
    return this.agents;
  }
  
  private static establishReportingStructure() {
    const ceo = this.agents.get("ceo")!;
    const salesDirector = this.agents.get("sales_director")!;
    const operationsDirector = this.agents.get("operations_director")!;
    const hrDirector = this.agents.get("hr_director")!;
    const marketingDirector = this.agents.get("marketing_director")!;
    const financeDirector = this.agents.get("finance_director")!;
    const customerSuccess = this.agents.get("customer_success")!;
    const leadGeneration = this.agents.get("lead_generation")!;
    
    // Set up reporting relationships
    salesDirector.relationships.set(ceo.agentId, {
      targetAgent: ceo.agentId,
      relationshipType: "reports_to",
      strength: 8,
      communicationFrequency: "daily",
      lastInteraction: new Date().toISOString()
    });
    
    leadGeneration.relationships.set(salesDirector.agentId, {
      targetAgent: salesDirector.agentId,
      relationshipType: "reports_to",
      strength: 7,
      communicationFrequency: "daily",
      lastInteraction: new Date().toISOString()
    });
    
    // Add all other reporting relationships...
    operationsDirector.relationships.set(ceo.agentId, {
      targetAgent: ceo.agentId,
      relationshipType: "reports_to",
      strength: 8,
      communicationFrequency: "daily",
      lastInteraction: new Date().toISOString()
    });
    
    hrDirector.relationships.set(ceo.agentId, {
      targetAgent: ceo.agentId,
      relationshipType: "reports_to",
      strength: 8,
      communicationFrequency: "weekly",
      lastInteraction: new Date().toISOString()
    });
    
    marketingDirector.relationships.set(ceo.agentId, {
      targetAgent: ceo.agentId,
      relationshipType: "reports_to",
      strength: 7,
      communicationFrequency: "weekly",
      lastInteraction: new Date().toISOString()
    });
    
    financeDirector.relationships.set(ceo.agentId, {
      targetAgent: ceo.agentId,
      relationshipType: "reports_to",
      strength: 9,
      communicationFrequency: "weekly",
      lastInteraction: new Date().toISOString()
    });
    
    customerSuccess.relationships.set(ceo.agentId, {
      targetAgent: ceo.agentId,
      relationshipType: "reports_to",
      strength: 7,
      communicationFrequency: "weekly",
      lastInteraction: new Date().toISOString()
    });
  }
  
  static getAgent(role: string): EnhancedAgent | undefined {
    return this.agents.get(role);
  }
  
  static getAllAgents(): EnhancedAgent[] {
    return Array.from(this.agents.values());
  }
  
  static getOrganizationStatus() {
    return {
      totalAgents: this.agents.size,
      departments: {
        executive: 1,
        sales: 2,
        operations: 1,
        hr: 1,
        marketing: 1,
        finance: 1,
        customer_success: 1
      },
      activeAgents: Array.from(this.agents.values()).filter(agent => agent.isActive).length,
      agentStatuses: Array.from(this.agents.values()).map(agent => agent.getStatus())
    };
  }
}
