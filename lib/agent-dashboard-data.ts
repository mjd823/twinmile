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

export const AGENT_ACTIONS: Record<string, { action: string; label: string; description: string; icon: string }> = {
  ceo: {
    action: "strategic_review",
    label: "Strategic Review",
    description: "Run a full strategic analysis of current business performance.",
    icon: "Crown",
  },
  sales: {
    action: "check_revenue",
    label: "Check Revenue",
    description: "Pull live revenue data, pipeline status, and sales forecasts.",
    icon: "DollarSign",
  },
  operations: {
    action: "schedule_deliveries",
    label: "Schedule Deliveries",
    description: "Optimize routes and manage active load scheduling.",
    icon: "Truck",
  },
  hr: {
    action: "hire_drivers",
    label: "Hire Drivers",
    description: "Review driver applications and manage the recruitment pipeline.",
    icon: "UserCheck",
  },
  marketing: {
    action: "send_marketing",
    label: "Launch Marketing",
    description: "Execute marketing campaigns and content distribution.",
    icon: "Megaphone",
  },
  finance: {
    action: "check_revenue",
    label: "Financial Report",
    description: "Generate financial reports, revenue tracking, and budget analysis.",
    icon: "DollarSign",
  },
  customer_success: {
    action: "customer_support",
    label: "Customer Support",
    description: "Monitor customer accounts and handle support escalations.",
    icon: "Heart",
  },
  lead_generation: {
    action: "find_customers",
    label: "Find Customers",
    description: "Prospect new leads and execute outreach campaigns.",
    icon: "Target",
  },
};

export const AGENT_DEPARTMENTS: Record<string, string> = {
  ceo: "Executive",
  sales: "Sales",
  operations: "Operations",
  hr: "Human Resources",
  marketing: "Marketing",
  finance: "Finance",
  customer_success: "Customer Success",
  lead_generation: "Sales",
};
