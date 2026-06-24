// Agent Dashboard Data — tool descriptions, agent-action maps, and tooltip content

export const TOOL_DESCRIPTIONS: Record<string, { name: string; description: string; agentUsage: Record<string, string> }> = {
  web_search: {
    name: "Web Search",
    description: "Search the web for real-time information, market data, and business intelligence.",
    agentUsage: {
      ceo: "Researches market trends, competitive intelligence, and strategic opportunities.",
      sales: "Finds prospect information, company data, and sales opportunities.",
      operations: "Looks up route conditions, carrier rates, and logistics data.",
      hr: "Searches for candidate backgrounds, salary benchmarks, and recruitment channels.",
      marketing: "Monitors brand mentions, competitor campaigns, and industry news.",
      finance: "Pulls market rates, economic indicators, and financial benchmarks.",
      customer_success: "Researches customer industries and finds retention best practices.",
      lead_generation: "Prospects new companies, finds decision-makers, and gathers contact data.",
    },
  },
  code_interpreter: {
    name: "Code Interpreter",
    description: "Run code for data analysis, financial modeling, scoring algorithms, and reporting.",
    agentUsage: {
      ceo: "Builds executive dashboards and strategic forecasting models.",
      sales: "Analyzes pipeline performance and revenue forecasting.",
      operations: "Calculates route optimization and fuel cost analysis.",
      hr: "Generates HR metrics, turnover analysis, and hiring funnel reports.",
      marketing: "Analyzes campaign ROI, engagement metrics, and audience segmentation.",
      finance: "Runs financial models, P&L analysis, and budget projections.",
      lead_generation: "Scores leads with weighted algorithms and builds prospect lists.",
    },
  },
  browser_automation: {
    name: "Browser Automation",
    description: "Automate web browsing for outreach, data extraction, and monitoring tasks.",
    agentUsage: {
      ceo: "Monitors competitor websites and industry publications.",
      marketing: "Schedules social posts, monitors brand pages, and tracks campaigns.",
      lead_generation: "Automates LinkedIn outreach, scrapes directories, and fills forms.",
    },
  },
  wolfram_alpha: {
    name: "Wolfram Alpha",
    description: "Complex mathematical calculations, statistical analysis, and scientific computing.",
    agentUsage: {
      ceo: "Runs complex business scenario modeling and probability analysis.",
      operations: "Calculates optimal routes, fuel efficiency, and load distributions.",
      finance: "Performs compound interest, depreciation, and tax calculations.",
    },
  },
  visit_website: {
    name: "Visit Website",
    description: "Visit and extract structured data from specific web pages.",
    agentUsage: {
      customer_success: "Checks customer websites for updates, reviews, and service needs.",
    },
  },
};

export const AGENT_ACTIONS: Record<string, { action: string; label: string; description: string; icon: string; time?: string }> = {
  ceo: {
    action: "strategic_review",
    label: "Strategic Review",
    description: "Run a full strategic analysis of current business performance.",
    icon: "Crown",
    time: "Mon 6:00 AM",
  },
  sales: {
    action: "check_revenue",
    label: "Check Revenue",
    description: "Pull live revenue data, pipeline status, and sales forecasts.",
    icon: "DollarSign",
    time: "9:00 AM",
  },
  operations: {
    action: "schedule_deliveries",
    label: "Schedule & Dispatch",
    description: "Plan routes, assign drivers, and ensure on-time deliveries.",
    icon: "Truck",
    time: "10:00 AM",
  },
  hr: {
    action: "hire_drivers",
    label: "Hire Drivers",
    description: "Review applications and handle onboarding process.",
    icon: "UserCheck",
    time: "11:00 AM",
  },
  marketing: {
    action: "send_marketing",
    label: "Marketing Outreach",
    description: "Run campaigns, follow up on inbound leads, and nurture prospects.",
    icon: "Megaphone",
    time: "Mon 8:00 AM",
  },
  finance: {
    action: "check_revenue",
    label: "Finance Review",
    description: "Reconcile payments, update forecasts, and flag any discrepancies.",
    icon: "Calculator",
    time: "12:00 PM",
  },
  customer_success: {
    action: "customer_support",
    label: "Customer Success",
    description: "Support active customers, handle escalations, and track satisfaction.",
    icon: "Heart",
    time: "9:30 AM + 2:00 PM",
  },
  lead_generation: {
    action: "find_customers",
    label: "Find Customers",
    description: "Identify and qualify new prospects from multiple sources.",
    icon: "Search",
    time: "8:00 AM",
  },
};

// Ordered workflow steps for each agent — what they do in the lead pipeline
export interface WorkflowStep {
  step: number;
  label: string;
  description: string;
  leadTypes: ('quote' | 'driver')[];
  tools?: string[];
}

export const AGENT_WORKFLOWS: Record<string, WorkflowStep[]> = {
  lead_generation: [
    { step: 1, label: "Receive Incoming Lead", description: "Capture lead data from website form, referral, or outbound prospecting campaign.", leadTypes: ["quote", "driver"] },
    { step: 2, label: "Score & Qualify", description: "Run weighted scoring algorithm: service type, location, experience, authority status, urgency.", leadTypes: ["quote", "driver"], tools: ["code_interpreter"] },
    { step: 3, label: "Categorize Lead Type", description: "Classify as quote (freight/hotshot/flatbed/last-mile) or driver (owner-op/company/lease).", leadTypes: ["quote", "driver"] },
    { step: 4, label: "Route to Team", description: "Premium → CEO, Driver → HR/Recruiting, Freight → Sales Director, Nurture → Marketing.", leadTypes: ["quote", "driver"] },
    { step: 5, label: "Trigger Auto-Response", description: "Send immediate acknowledgement email/SMS to the lead based on priority level.", leadTypes: ["quote", "driver"], tools: ["browser_automation"] },
    { step: 6, label: "Log to Pipeline", description: "Record lead, score, and routing decision in MongoDB for tracking.", leadTypes: ["quote", "driver"] },
  ],
  ceo: [
    { step: 1, label: "Receive Premium Escalation", description: "Get notified when a lead scores 85+ (premium quality) from Lead Gen.", leadTypes: ["quote", "driver"] },
    { step: 2, label: "Strategic Review", description: "Analyze lead's business value, strategic fit, and long-term potential.", leadTypes: ["quote", "driver"], tools: ["web_search", "code_interpreter"] },
    { step: 3, label: "Approve / Redirect", description: "Approve for fast-track onboarding or redirect to appropriate department head.", leadTypes: ["quote", "driver"] },
    { step: 4, label: "Set Priority & Resources", description: "Allocate resources, set SLA timelines, and assign account ownership.", leadTypes: ["quote", "driver"] },
    { step: 5, label: "Monitor Outcome", description: "Track conversion and revenue impact, feed results back to strategy.", leadTypes: ["quote", "driver"], tools: ["wolfram_alpha"] },
  ],
  sales: [
    { step: 1, label: "Receive Qualified Quote Lead", description: "Get freight/hotshot/flatbed leads that scored medium-to-high from Lead Gen.", leadTypes: ["quote"] },
    { step: 2, label: "Research Prospect", description: "Look up company info, shipping history, and decision-makers.", leadTypes: ["quote"], tools: ["web_search"] },
    { step: 3, label: "Build Custom Quote", description: "Calculate pricing based on route, load type, urgency, and market rates.", leadTypes: ["quote"], tools: ["code_interpreter"] },
    { step: 4, label: "Present & Negotiate", description: "Send quote proposal, handle objections, negotiate terms.", leadTypes: ["quote"] },
    { step: 5, label: "Close & Hand Off", description: "Finalize contract, hand off to Operations for scheduling and Customer Success for onboarding.", leadTypes: ["quote"] },
  ],
  hr: [
    { step: 1, label: "Receive Driver Application", description: "Get scored driver leads routed from Lead Gen.", leadTypes: ["driver"] },
    { step: 2, label: "Review Application", description: "Verify CDL, endorsements, experience, and authority status.", leadTypes: ["driver"], tools: ["web_search"] },
    { step: 3, label: "Background & Compliance", description: "Run background check, verify MVR, check FMCSA compliance.", leadTypes: ["driver"], tools: ["web_search"] },
    { step: 4, label: "Interview & Assess", description: "Conduct screening interview, assess cultural fit and reliability.", leadTypes: ["driver"] },
    { step: 5, label: "Onboard Driver", description: "Process paperwork, assign to Operations for fleet placement, set up payroll with Finance.", leadTypes: ["driver"], tools: ["code_interpreter"] },
  ],
  operations: [
    { step: 1, label: "Receive Closed Deal / New Driver", description: "Get handoff from Sales (new load) or HR (new driver) for scheduling.", leadTypes: ["quote", "driver"] },
    { step: 2, label: "Route Planning", description: "Calculate optimal route, fuel stops, and delivery timeline.", leadTypes: ["quote"], tools: ["wolfram_alpha", "code_interpreter"] },
    { step: 3, label: "Fleet Assignment", description: "Match available truck + driver to the load based on location and equipment.", leadTypes: ["quote", "driver"], tools: ["code_interpreter"] },
    { step: 4, label: "Schedule & Dispatch", description: "Set pickup/delivery windows, dispatch driver, send BOL.", leadTypes: ["quote"] },
    { step: 5, label: "Track & Monitor", description: "Real-time GPS tracking, ETA updates, exception handling.", leadTypes: ["quote"], tools: ["web_search"] },
  ],
  finance: [
    { step: 1, label: "Receive Pricing Request / Payroll Setup", description: "Get request from Sales (quote pricing) or HR (new driver payroll).", leadTypes: ["quote", "driver"] },
    { step: 2, label: "Cost Analysis", description: "Calculate fuel, tolls, insurance, driver pay, and margin for the load.", leadTypes: ["quote"], tools: ["wolfram_alpha", "code_interpreter"] },
    { step: 3, label: "Generate Invoice", description: "Create and send invoice to customer after delivery confirmation.", leadTypes: ["quote"], tools: ["code_interpreter"] },
    { step: 4, label: "Process Payment", description: "Track payment status, handle collections, reconcile accounts.", leadTypes: ["quote"] },
    { step: 5, label: "Driver Payroll", description: "Calculate driver settlements, deductions, and process weekly pay.", leadTypes: ["driver"], tools: ["code_interpreter", "wolfram_alpha"] },
  ],
  marketing: [
    { step: 1, label: "Receive Nurture Leads", description: "Get low/medium-scored leads that need warming before they convert.", leadTypes: ["quote", "driver"] },
    { step: 2, label: "Segment & Target", description: "Categorize leads by industry, service need, and engagement level.", leadTypes: ["quote", "driver"], tools: ["code_interpreter"] },
    { step: 3, label: "Launch Drip Campaign", description: "Set up automated email/SMS sequence with relevant content.", leadTypes: ["quote", "driver"], tools: ["browser_automation"] },
    { step: 4, label: "Monitor Engagement", description: "Track open rates, clicks, and re-score leads based on engagement.", leadTypes: ["quote", "driver"], tools: ["code_interpreter"] },
    { step: 5, label: "Re-qualify & Escalate", description: "When engagement threshold is met, re-score and route back to Lead Gen as warm lead.", leadTypes: ["quote", "driver"] },
  ],
  customer_success: [
    { step: 1, label: "Receive New Customer", description: "Get handoff from Sales after contract is signed.", leadTypes: ["quote"] },
    { step: 2, label: "Onboarding Call", description: "Welcome call, set expectations, gather preferences, and create account profile.", leadTypes: ["quote"] },
    { step: 3, label: "Monitor Delivery", description: "Track first load delivery, ensure smooth experience, handle any issues.", leadTypes: ["quote"], tools: ["visit_website", "web_search"] },
    { step: 4, label: "Follow-Up & Feedback", description: "Post-delivery satisfaction check, gather feedback, resolve complaints.", leadTypes: ["quote"] },
    { step: 5, label: "Retention & Upsell", description: "Identify repeat-shipping opportunities, propose volume contracts, prevent churn.", leadTypes: ["quote"], tools: ["web_search"] },
  ],
};

// The master pipeline — shows the full flow across agents for each lead type
export interface PipelineStep {
  agentId: string;
  agentName: string;
  role: string;
  color: string;
  action: string;
  description: string;
}

export const QUOTE_PIPELINE: PipelineStep[] = [
  { agentId: "lead_generation", agentName: "Sofia Rodriguez", role: "Lead Gen", color: "bg-cyan-500", action: "Score & Route", description: "Qualify incoming quote, score it, and route to the right team." },
  { agentId: "ceo", agentName: "Alexandra Sterling", role: "CEO", color: "bg-purple-500", action: "Premium Review", description: "Review premium-scored leads for strategic fit (if score ≥ 85)." },
  { agentId: "sales", agentName: "Marcus Chen", role: "Sales Director", color: "bg-blue-500", action: "Quote & Close", description: "Build custom quote, negotiate, and close the deal." },
  { agentId: "finance", agentName: "Robert Chang", role: "Finance", color: "bg-yellow-500", action: "Price & Invoice", description: "Cost analysis, pricing approval, and invoicing." },
  { agentId: "operations", agentName: "David Kumar", role: "Operations", color: "bg-green-500", action: "Schedule & Dispatch", description: "Route planning, fleet assignment, and dispatch." },
  { agentId: "customer_success", agentName: "Emily Watson", role: "Customer Success", color: "bg-red-500", action: "Onboard & Retain", description: "Customer onboarding, delivery monitoring, and retention." },
  { agentId: "marketing", agentName: "Isabella Martinez", role: "Marketing", color: "bg-pink-500", action: "Nurture (if needed)", description: "Drip campaigns for leads that aren't ready to convert yet." },
];

export const DRIVER_PIPELINE: PipelineStep[] = [
  { agentId: "lead_generation", agentName: "Sofia Rodriguez", role: "Lead Gen", color: "bg-cyan-500", action: "Score & Route", description: "Qualify driver application, score experience, and route." },
  { agentId: "ceo", agentName: "Alexandra Sterling", role: "CEO", color: "bg-purple-500", action: "Premium Approval", description: "Approve premium driver candidates (if score ≥ 85)." },
  { agentId: "hr", agentName: "Jennifer Foster", role: "HR Director", color: "bg-orange-500", action: "Review & Onboard", description: "Application review, background check, interview, and onboarding." },
  { agentId: "operations", agentName: "David Kumar", role: "Operations", color: "bg-green-500", action: "Fleet Assignment", description: "Assign driver to truck, set routes, and schedule." },
  { agentId: "finance", agentName: "Robert Chang", role: "Finance", color: "bg-yellow-500", action: "Payroll Setup", description: "Set up driver payroll, settlements, and deductions." },
  { agentId: "marketing", agentName: "Isabella Martinez", role: "Marketing", color: "bg-pink-500", action: "Nurture (if needed)", description: "Re-engage drivers who didn't complete application." },
];

export const AGENT_DEPARTMENTS: Record<string, string> = {
  ceo: "Executive",
  sales: "Sales",
  operations: "Operations",
  hr: "Human Resources",
  marketing: "Marketing",
  finance: "Finance",
  customer_success: "Customer Success",
  lead_generation: "Sales",
  supervisor: "Management",
};

// Agent work schedules — "shifts" for the timesheet + nighttime prep
export const AGENT_SHIFTS: Record<string, { start: string; end: string; days: string[]; prep: { start: string; end: string; task: string } | null }> = {
  "Sofia Rodriguez": { start: "08:00", end: "17:00", days: ["Mon","Tue","Wed","Thu","Fri"], prep: { start: "22:00", end: "23:00", task: "Nighttime prep — review today's prospecting results, prepare search strategies for tomorrow" } },
  "Marcus Chen": { start: "09:00", end: "17:00", days: ["Mon","Tue","Wed","Thu","Fri"], prep: { start: "21:00", end: "22:00", task: "Nighttime prep — review qualified leads, draft outreach messages for morning" } },
  "David Kumar": { start: "10:00", end: "18:00", days: ["Mon","Tue","Wed","Thu","Fri"], prep: { start: "20:00", end: "21:00", task: "Nighttime prep — review load board trends, plan dispatch capacity" } },
  "Jennifer Foster": { start: "11:00", end: "19:00", days: ["Mon","Tue","Wed","Thu","Fri"], prep: { start: "21:00", end: "22:00", task: "Nighttime prep — review onboarding progress, prepare compliance checklists" } },
  "Robert Chang": { start: "12:00", end: "20:00", days: ["Mon","Tue","Wed","Thu","Fri"], prep: { start: "22:00", end: "23:00", task: "Nighttime prep — review invoices, prepare financial summary" } },
  "Emily Watson": { start: "09:30", end: "17:30", days: ["Mon","Tue","Wed","Thu","Fri"], prep: { start: "20:00", end: "21:00", task: "Nighttime prep — review customer feedback, prepare follow-up plans" } },
  "Isabella Martinez": { start: "08:00", end: "16:00", days: ["Mon"], prep: null },
  "Alexandra Sterling": { start: "06:00", end: "14:00", days: ["Mon"], prep: { start: "19:00", end: "20:00", task: "Nighttime prep — compile weekly review, set strategic priorities for the week" } },
  "Team Lead": { start: "01:00", end: "03:00", days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], prep: null },
};
