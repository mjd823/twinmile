"use client";

import * as React from "react";
import {
  CheckCircle2, XCircle, AlertCircle, Loader2,
  User, Shield, FileText, Signature,
  CreditCard, Truck, UserCheck, Mail,
  ChevronRight, ChevronLeft, Eye, Download, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OnboardingStep {
  id: number;
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  isComplete: boolean;
  isActive: boolean;
  canProceed: boolean;
  color?: string;
}

interface Document {
  key: string;
  label: string;
  accept: string;
  file?: File;
  preview?: string;
  uploaded?: boolean;
  url?: string;
  required: boolean;
}

const REQUIRED_DOCS: Document[] = [
  { key: "cdl", label: "CDL / Driver's License", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "coi", label: "Certificate of Insurance (COI)", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "registration", label: "Vehicle Registration", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "w9", label: "W-9 Form", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "dotPhysical", label: "DOT Physical / Medical Card", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "mvR", label: "Motor Vehicle Record (MVR)", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "eld", label: "ELD Certification", accept: ".pdf,.jpg,.jpeg,.png", required: false },
];

export function OnboardingPortal() {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [formData, setFormData] = React.useState({
    // Identity
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    ssnLast4: "",
    // Address
    address: "",
    city: "",
    state: "",
    zip: "",
    // Vehicle
    truckYear: "",
    truckMake: "",
    truckModel: "",
    vin: "",
    plate: "",
    truckType: "dry_van",
    // Authority
    mcNumber: "",
    usdotNumber: "",
    authorityType: "own",
    // Documents
    documents: {} as Record<string, { file: File; preview: string }>,
  });
  const [documents, setDocuments] = React.useState<Record<string, { file: File; preview: string }>>({});
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState("");

  // Token-based session validation and resume
  const [sessionToken, setSessionToken] = React.useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);
  const [sessionError, setSessionError] = React.useState<string | null>(null);
  const [sessionName, setSessionName] = React.useState<string>("");

  React.useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setSessionLoading(false);
      setSessionError("No onboarding token found. You need a personal invitation link to access the onboarding portal. Check your email or contact us at (281) 710-7787.");
      return;
    }

    setSessionToken(token);

    // Validate token and load session
    fetch(`/api/onboarding/session?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.ok) {
          setSessionError(data.error || "Invalid onboarding link.");
          return;
        }

        if (data.alreadyCompleted) {
          setSessionError("You've already completed onboarding. You can sign in to your driver portal.");
          return;
        }

        // Pre-fill form data from session
        const pre = data.session?.preFilledData || {};
        const saved = data.session?.formData || {};
        setSessionName(data.session?.leadName || "");

        setFormData(prev => ({
          ...prev,
          firstName: pre.name?.split(" ")[0] || saved.firstName || "",
          lastName: pre.name?.split(" ").slice(1).join(" ") || saved.lastName || "",
          email: pre.email || saved.email || data.session?.leadEmail || "",
          phone: pre.phone || saved.phone || "",
          truckType: pre.truckType || saved.truckType || "dry_van",
          mcNumber: pre.mcNumber || saved.mcNumber || "",
          usdotNumber: pre.usdotNumber || saved.usdotNumber || "",
          authorityType: pre.authorityStatus || saved.authorityType || "own",
          city: pre.city || saved.city || "",
          state: pre.state || saved.state || "",
          ...saved,
        }));

        // Resume from saved step
        if (data.session?.currentStep && data.session.currentStep > 1) {
          setCurrentStep(data.session.currentStep);
        }

        setSessionLoading(false);
      })
      .catch(() => {
        setSessionError("Failed to load onboarding session. Please try again or contact support.");
        setSessionLoading(false);
      });
  }, []);

  // Save progress when step changes (debounced)
  const saveProgress = React.useCallback((step: number, data: any) => {
    if (!sessionToken) return;
    fetch(`/api/onboarding/session?token=${encodeURIComponent(sessionToken)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStep: step, formData: data }),
    }).catch(() => {}); // Silent fail — progress saving is best-effort
  }, [sessionToken]);

  // Auto-save on step change
  React.useEffect(() => {
    if (!sessionLoading && sessionToken) {
      const timer = setTimeout(() => saveProgress(currentStep, formData), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, formData, sessionToken, sessionLoading, saveProgress]);

  const steps: OnboardingStep[] = [
    {
      id: 1,
      key: "identity",
      label: "Identity Verification",
      description: "Verify your identity with personal information",
      icon: <User className="h-5 w-5" />,
      component: <IdentityStep formData={formData} setFormData={setFormData} />,
      isComplete: false,
      isActive: currentStep === 1,
      canProceed: !!formData.firstName && !!formData.lastName && !!formData.email && !!formData.phone,
    },
    {
      id: 2,
      key: "fmcsa",
      label: "FMCSA Verification",
      description: "Verify your operating authority and safety record",
      icon: <Shield className="h-5 w-5" />,
      component: <FMCAStep formData={formData} setFormData={setFormData} />,
      isComplete: false,
      isActive: currentStep === 2,
      canProceed: !!formData.mcNumber || !!formData.usdotNumber,
    },
    {
      id: 3,
      key: "background",
      label: "Background Check",
      description: "Consent to background and MVR check",
      icon: <FileText className="h-5 w-5" />,
      component: <BackgroundStep formData={formData} setFormData={setFormData} />,
      isComplete: false,
      isActive: currentStep === 3,
      canProceed: true,
    },
    {
      id: 4,
      key: "esign",
      label: "E-Sign Agreement",
      description: "Review and electronically sign the Lease-On Agreement",
      icon: <Signature className="h-5 w-5" />,
      component: <ESignStep formData={formData} setFormData={setFormData} />,
      isComplete: false,
      isActive: currentStep === 4,
      canProceed: true,
    },
    {
      id: 5,
      key: "documents",
      label: "Upload Documents",
      description: "Upload all 7 required documents",
      icon: <FileText className="h-5 w-5" />,
      component: <DocumentsStep documents={documents} setDocuments={setDocuments} />,
      isComplete: Object.keys(documents).filter(k => REQUIRED_DOCS.find(d => d.key === k)?.required).every(k => documents[k]?.file),
      isActive: currentStep === 5,
      canProceed: Object.keys(documents).filter(k => REQUIRED_DOCS.find(d => d.key === k)?.required).every(k => documents[k]?.file),
    },
    {
      id: 6,
      key: "insurance",
      label: "Insurance Verification",
      description: "Verify insurance coverage and certificate holder",
      icon: <CreditCard className="h-5 w-5" />,
      component: <InsuranceStep formData={formData} setFormData={setFormData} />,
      isComplete: false,
      isActive: currentStep === 6,
      canProceed: true,
    },
    {
      id: 7,
      key: "complete",
      label: "Account Created",
      description: "Your account is ready. Welcome to Twin Mile!",
      icon: <CheckCircle2 className="h-5 w-5" />,
      component: <CompleteStep />,
      isComplete: currentStep === 7, // Only complete when actually on this step
      isActive: currentStep === 7,
      canProceed: false,
    },
  ];

  const completeCount = steps.filter(s => s.isComplete).length;
  const progress = (completeCount / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length && steps[currentStep - 1].canProceed) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setStatus("submitting");
    try {
      const formPayload = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (k !== 'documents') {
            formPayload.append(k, String(v));
        }
      });

      Object.entries(documents).forEach(([k, v]) => {
        if (v.file) formPayload.append(k, v.file);
      });

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        body: formPayload,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");

      setStatus("success");
      setCurrentStep(7);

    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  if (status === "success") {
    setCurrentStep(7);
  }

  // Show loading state while validating token
  if (sessionLoading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
        <h2 className="text-xl font-semibold">Loading your onboarding portal...</h2>
        <p className="text-sm text-muted-foreground mt-2">Validating your invitation link</p>
      </div>
    );
  }

  // Show error state if no valid token
  if (sessionError) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Onboarding Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{sessionError}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="mailto:admin@twinmile.com" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Contact Support
            </a>
            <a href="tel:+12817107787" className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent">
              Call (281) 710-7787
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Resume Banner */}
      {sessionToken && currentStep > 1 && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="text-muted-foreground">
            Welcome back{sessionName ? `, ${sessionName}` : ""}! Your progress is saved. Continue from step {currentStep} of 7.
          </span>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                MC-1790263 • Houston, TX • Power-Only Program
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Welcome{formData.firstName ? `, ${formData.firstName}` : ""}! Let&rsquo;s get you on the road.
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                Complete all 7 steps to join Twin Mile&rsquo;s power-only program.
                80% gross • Weekly direct deposit • 100% fuel surcharge.
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="relative w-28 h-28 md:w-32 md:h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                  <circle
                    cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6"
                    className="text-primary transition-all duration-500"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>
                  <span className="text-[10px] text-muted-foreground">{completeCount}/{steps.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Progress Bar */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-1 md:gap-2">
            {steps.map((step, i) => (
              <React.Fragment key={step.key}>
                <button
                  onClick={() => step.isComplete && setCurrentStep(step.id)}
                  className={`flex flex-col items-center gap-1.5 flex-1 group ${step.isComplete ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl border-2 transition-all duration-300 ${
                    step.isComplete ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-500/30 group-hover:scale-110' :
                    step.isActive ? 'bg-primary border-primary text-white shadow-md shadow-primary/30 scale-110' :
                    'border-border bg-background text-muted-foreground'
                  }`}>
                    {step.isComplete ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                  </div>
                  <span className={`text-[10px] md:text-xs text-center font-medium leading-tight transition-colors ${
                    step.isComplete ? 'text-foreground' : step.isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 min-w-[8px] rounded-full transition-colors duration-300 ${
                    step.isComplete ? 'bg-green-500' : 'bg-border'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${steps[currentStep - 1].color} flex items-center justify-center text-white`}>
              {steps[currentStep - 1].icon}
            </div>
            <div>
              <h2 className="text-xl font-bold">{steps[currentStep - 1].label}</h2>
              <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {steps[currentStep - 1].component}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t border-border/60">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {currentStep < steps.length ? (
              <Button onClick={handleNext} disabled={!steps[currentStep - 1].canProceed || status === "submitting"}>
                {status === "submitting" ? (
                  <> <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting... </>
                ) : currentStep === steps.length - 1 ? (
                  <> Complete Onboarding <ChevronRight className="h-4 w-4 ml-2" /> </>
                ) : (
                  <> Next <ChevronRight className="h-4 w-4 ml-2" /> </>
                )}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => window.location.href = "/driver/login"}>
                Go to Driver Portal
              </Button>
            )}
          </div>

          {status === "error" && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {errorMessage || "An error occurred. Please try again."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sidebar - Summary */}
      <div className="hidden lg:block">
        <Card className="border-border/60 sticky top-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.key}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  step.isComplete ? 'bg-green-500/10 border-green-500/20' :
                  step.isActive ? 'bg-primary/10 border-primary/20' :
                  'bg-muted/30'
                } border`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  step.isComplete ? 'bg-green-500 text-white' :
                  step.isActive ? 'bg-primary text-white' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {step.isComplete ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{step.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {step.isComplete ? "Complete" : step.isActive ? "In Progress" : "Pending"}
                  </p>
                </div>
                {step.isComplete && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Step Components
function IdentityStep({ formData, setFormData }: { formData: any; setFormData: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium">First Name *</label>
          <Input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="John" required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Last Name *</label>
          <Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="Doe" required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Email *</label>
          <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="john@email.com" required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Phone *</label>
          <Input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(555) 555-5555" required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Date of Birth *</label>
          <Input type="date" value={formData.dateOfBirth} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">SSN (Last 4) *</label>
          <Input type="text" value={formData.ssnLast4} onChange={e => setFormData({...formData, ssnLast4: e.target.value})} placeholder="1234" maxLength={4} required />
        </div>
      </div>
      {/* Address */}
      <div className="border-t border-border/60 pt-4 space-y-4">
        <h3 className="font-medium">Address</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <label className="text-sm font-medium">Street Address *</label>
            <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="123 Main St" required />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">City *</label>
            <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Houston" required />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">State *</label>
            <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} placeholder="TX" maxLength={2} required />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">ZIP *</label>
            <Input value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} placeholder="77002" maxLength={5} required />
          </div>
        </div>
      </div>
    </div>
  );
}

function FMCAStep({ formData, setFormData }: { formData: any; setFormData: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium">MC Number *</label>
          <Input value={formData.mcNumber} onChange={e => setFormData({...formData, mcNumber: e.target.value})} placeholder="MC-123456" />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">USDOT Number *</label>
          <Input value={formData.usdotNumber} onChange={e => setFormData({...formData, usdotNumber: e.target.value})} placeholder="1234567" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <label className="text-sm font-medium">Authority Type *</label>
          <select value={formData.authorityType} onChange={e => setFormData({...formData, authorityType: e.target.value})} className="h-10 border-border/80 bg-background/70 rounded-md px-3 text-sm">
            <option value="own">Own Authority</option>
            <option value="lease">Lease Onto Twin Mile (MC1790263)</option>
          </select>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          We'll verify your authority status with FMCSA. If you're leasing onto Twin Mile,
          you'll operate under our MC1790263 authority.
        </p>
      </div>
    </div>
  );
}

function BackgroundStep({ formData, setFormData }: { formData: any; setFormData: any }) {
  const [consent, setConsent] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
        <h3 className="font-medium mb-2">Background Check Consent</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Twin Mile requires a background check and Motor Vehicle Record (MVR) review for all
          owner-operators. This includes:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Criminal background check (7-year lookback)</li>
          <li>Motor Vehicle Record (MVR) - 3 year history</li>
          <li>FMCSA PSP report (Pre-Employment Screening Program)</li>
          <li>Drug & alcohol testing compliance (DOT)</li>
        </ul>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="bg-consent"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="w-4 h-4 rounded border-border/80 text-primary focus:ring-primary"
        />
        <label htmlFor="bg-consent" className="text-sm text-foreground">
          I authorize Twin Mile LLC to conduct a background check and MVR review as described above.
        </label>
      </div>
    </div>
  );
}

function ESignStep({ formData, setFormData }: { formData: any; setFormData: any }) {
  const [signed, setSigned] = React.useState(false);
  const [signature, setSignature] = React.useState("");
  const [showFullAgreement, setShowFullAgreement] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base">Lease-On Agreement</h3>
          <Badge variant="secondary" className="text-xs">MC-1790263</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Review the agreement below. Your electronic signature constitutes legal acceptance.
        </p>

        {/* Summary Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border border-border/60 bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Payment Structure</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>MC Usage Fee:</span> <strong>10%</strong></div>
              <div className="flex justify-between"><span>Factoring Fee:</span> <strong>3%</strong></div>
              <div className="flex justify-between"><span>Dispatching Fee:</span> <strong>7%</strong></div>
              <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Total Sign-On:</span> <strong className="text-primary">20%</strong></div>
              <div className="text-xs text-muted-foreground mt-1">Weekly direct deposit by Tuesday</div>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Requirements</p>
            <div className="text-xs space-y-1 text-muted-foreground">
              <div>• Valid CDL with endorsements</div>
              <div>• DOT Medical Examiner Certificate</div>
              <div>• Annual DOT truck inspection</div>
              <div>• COI with Twin Mile as certificate holder</div>
              <div>• ELD compliance (FMCSA regs)</div>
              <div>• Clean MVR on request</div>
            </div>
          </div>
        </div>

        {/* Penalties Warning */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 mb-4">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase mb-2">⚠ Penalties & Termination</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-muted-foreground">
            <div>• Failed DOT inspection: $1,000 fine + termination</div>
            <div>• Unreported DOT inspection: $1,000 fine</div>
            <div>• Unauthorized MC use: $1,000 + termination</div>
            <div>• Double brokering: $2,000 + termination</div>
            <div>• Driver change without notice: $500</div>
            <div>• 7-day written termination notice</div>
          </div>
        </div>

        {/* Full Agreement Toggle */}
        <button
          onClick={() => setShowFullAgreement(!showFullAgreement)}
          className="text-sm text-primary hover:underline mb-3 flex items-center gap-1"
        >
          {showFullAgreement ? "Hide" : "Read"} full 8-section agreement
          <ChevronRight className={`w-3 h-3 transition-transform ${showFullAgreement ? "rotate-90" : ""}`} />
        </button>

        {showFullAgreement && (
          <div className="rounded-lg border border-border/60 bg-background p-4 max-h-80 overflow-y-auto text-sm space-y-3">
            <p className="font-semibold">This Lease-On Agreement is made between <strong>Twin Mile LLC</strong> (Carrier, MC-1790263, Houston, TX) and <strong>{formData.firstName || "[Owner-Operator]"} {formData.lastName || ""}</strong> (Owner-Operator).</p>
            <div>
              <p className="font-semibold mb-1">1. Purpose</p>
              <p className="text-xs text-muted-foreground">Carrier leases Owner-Operator's vehicle(s) for interstate property transportation under Carrier's FMCSA authority.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">2. Term</p>
              <p className="text-xs text-muted-foreground">Commences on signing. 7-day termination notice. Renewable by written agreement.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">3. Compliance</p>
              <p className="text-xs text-muted-foreground">DOT physical, annual inspection, CDL, HOS, ELD, MVR. Report violations immediately.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">4. Financial Terms</p>
              <p className="text-xs text-muted-foreground">20% total (10% MC + 3% factoring + 7% dispatch). Weekly payout by Tuesday. Expedited payment TBD.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">5. Liability</p>
              <p className="text-xs text-muted-foreground">Owner-Operator insurance is primary. At-fault accident may result in termination.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">6. Termination</p>
              <p className="text-xs text-muted-foreground">7-day notice, material breach, or automatic for violations per Section 4.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">7. Dispute Resolution</p>
              <p className="text-xs text-muted-foreground">Harris County, Texas law applies.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">8. Miscellaneous</p>
              <p className="text-xs text-muted-foreground">Texas governing law. Entire agreement. Written amendments only.</p>
            </div>
          </div>
        )}
      </div>

      {/* Signature */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Your Signature (type full legal name)</label>
        <Input
          value={signature}
          onChange={e => setSignature(e.target.value)}
          placeholder="Type your full legal name to sign"
          className="font-medium"
        />
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="esign-consent"
            checked={signed}
            onChange={e => setSigned(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-border/80 text-primary focus:ring-primary"
          />
          <label htmlFor="esign-consent" className="text-sm leading-relaxed">
            I agree to all terms above and provide my electronic signature.
            I certify the information provided is accurate and I authorize Twin Mile LLC to verify my credentials.
          </label>
        </div>
      </div>
    </div>
  );
}

function DocumentsStep({ documents, setDocuments }: { documents: Record<string, { file: File; preview: string }>; setDocuments: any }) {
  const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("File exceeds 3MB limit");
      return;
    }
    const preview = URL.createObjectURL(file);
    setDocuments({ ...documents, [key]: { file, preview } });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload all required documents. Max 3MB each. PDF, JPG, or PNG.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {REQUIRED_DOCS.map((doc) => {
          const docState = documents[doc.key];
          const isUploaded = !!docState?.file;

          return (
            <div key={doc.key} className={`rounded-lg border-2 p-3 transition-colors ${
              isUploaded ? 'border-green-500/30 bg-green-500/5' : 'border-dashed border-border/60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  {doc.label}
                  {doc.required && <span className="text-destructive">*</span>}
                </label>
                {isUploaded && (
                  <Badge variant="secondary" className="text-[10px] text-green-700 bg-green-500/10">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Uploaded
                  </Badge>
                )}
              </div>

              {isUploaded ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="truncate flex-1">{docState.file.name}</span>
                    <span className="text-muted-foreground text-xs">({(docState.file.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setDocuments((prev: any) => { const n = {...prev}; delete n[doc.key]; return n; })}
                      className="text-destructive hover:text-destructive/70 flex-shrink-0"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Document Preview */}
                  {docState.file.type.startsWith('image/') && (
                    <div className="relative rounded-lg overflow-hidden border border-border/60 bg-muted/20">
                      <img
                        src={docState.preview}
                        alt={doc.label}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1 shadow-md">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                  {docState.file.type === 'application/pdf' && (
                    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                      <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">PDF Document</span>
                      <a
                        href={docState.preview}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Preview
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5">
                  <Upload className="h-6 w-6" />
                  <span>Click or drag to upload</span>
                  <input
                    type="file"
                    accept={doc.accept}
                    className="sr-only"
                    onChange={e => handleFileChange(doc.key, e)}
                    required={doc.required}
                  />
                </label>
              )}

              {!doc.required && !isUploaded && (
                <span className="text-[10px] text-muted-foreground">Optional</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Required:</strong> CDL, COI, Registration, W-9, DOT Physical, MVR (6 docs)
          <br />
          <strong>Optional:</strong> ELD Certification
        </p>
      </div>
    </div>
  );
}

function InsuranceStep({ formData, setFormData }: { formData: any; setFormData: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
        <h3 className="font-medium mb-2">Insurance Verification</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Your Certificate of Insurance (COI) must list Twin Mile LLC as a certificate holder.
          Primary liability coverage must be $1,000,000 minimum.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Insurance Company</label>
          <Input value={formData.insuranceCompany} onChange={e => setFormData({...formData, insuranceCompany: e.target.value})} placeholder="Progressive, OOIDA, etc." />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Policy Number</label>
          <Input value={formData.policyNumber} onChange={e => setFormData({...formData, policyNumber: e.target.value})} placeholder="POL-123456" />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Expiration Date</label>
          <Input type="date" value={formData.policyExpiration} onChange={e => setFormData({...formData, policyExpiration: e.target.value})} />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Liability Coverage</label>
          <Input value={formData.liabilityCoverage} onChange={e => setFormData({...formData, liabilityCoverage: e.target.value})} placeholder="$1,000,000" />
        </div>
      </div>
    </div>
  );
}

function CompleteStep() {
  return (
    <div className="text-center py-12">
      <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Onboarding Complete!</h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Your account has been created successfully. You'll receive an email with your
        temporary login credentials within 24 hours.
      </p>
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 max-w-md mx-auto text-left">
        <h3 className="font-medium mb-2">What happens next:</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Admin reviews your submission (1-2 business days)</li>
          <li>Temporary password emailed to you</li>
          <li>Log in at <code>/driver/login</code></li>
          <li>Access dispatch board, settlements, and documents</li>
        </ul>
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <Button size="lg" onClick={() => window.location.href = "/driver/login"}>
          Go to Driver Portal
        </Button>
        <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
          View Dashboard
        </Button>
      </div>
    </div>
  );
}
