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
      isComplete: true,
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Owner-Operator Onboarding</h1>
              <p className="text-sm text-muted-foreground mt-1">Complete all 7 steps to start driving with Twin Mile</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{Math.round(progress)}%</div>
              <div className="text-sm text-muted-foreground">{completeCount} of {steps.length} steps complete</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-2 mb-6">
            <Progress value={progress} className="h-2" />
            <div className="absolute top-0 left-0 right-0 flex justify-between">
              {steps.map((step, i) => (
                <div
                  key={step.key}
                  className="flex flex-col items-center"
                  style={{ left: `${(i / (steps.length - 1)) * 100}%`, transform: 'translateX(-50%)' }}
                >
                  <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                    step.isComplete ? 'bg-green-500 border-green-500' :
                    step.isActive ? 'bg-primary border-primary' :
                    'bg-muted border-border'
                  }`} />
                  <span className="text-[9px] text-center mt-1 text-muted-foreground w-20 truncate">
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {steps.map((step, i) => (
              <div key={step.key} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 mb-1 ${
                  step.isComplete ? 'bg-green-500 border-green-500 text-white' :
                  step.isActive ? 'bg-primary border-primary text-white' :
                  'border-border bg-background'
                }`}>
                  {step.isComplete ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                </div>
                <span className="text-center truncate w-24">{step.label}</span>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${step.isComplete ? 'bg-green-500' : 'bg-border'}`} />
                )}
              </div>
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

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
        <h3 className="font-medium mb-2">Lease-On Agreement</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Review the agreement below. Your electronic signature below constitutes acceptance.
        </p>
        <div className="rounded-lg border border-border/60 bg-background p-4 max-h-64 overflow-y-auto text-sm">
          <p className="mb-2"><strong>LEASE-ON AGREEMENT</strong></p>
          <p className="mb-2">This Agreement is made between Twin Mile LLC (Carrier, MC1790263) and {formData.firstName} {formData.lastName} (Owner-Operator).</p>
          <p className="mb-2"><strong>Terms:</strong> 20% gross revenue (10% MC usage + 3% factoring + 7% dispatch). Weekly direct deposit. 7-day termination notice.</p>
          <p className="mb-2"><strong>Requirements:</strong> Valid CDL, DOT Physical, COI with Twin Mile as certificate holder, Annual DOT inspection, ELD compliance.</p>
          <p className="mb-2"><strong>Insurance:</strong> Owner-Operator's insurance is primary. Twin Mile listed as certificate holder.</p>
          <p className="mb-2"><strong>Termination:</strong> 7-day written notice. Automatic for failed DOT inspection, double brokering, unauthorized MC use.</p>
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-sm font-medium">Your Signature (type full name)</label>
        <Input
          value={signature}
          onChange={e => setSignature(e.target.value)}
          placeholder="Type your full legal name to sign"
          className="font-medium"
        />
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="esign-consent"
            checked={signed}
            onChange={e => setSigned(e.target.checked)}
            className="w-4 h-4 rounded border-border/80 text-primary focus:ring-primary"
          />
          <label htmlFor="esign-consent" className="text-sm">
            I agree to the terms above and provide my electronic signature
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
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="truncate flex-1">{docState.file.name}</span>
                  <span className="text-muted-foreground">({(docState.file.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    onClick={() => setDocuments((prev: any) => { const n = {...prev}; delete n[doc.key]; return n; })}
                    className="text-destructive hover:text-destructive/70"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
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
