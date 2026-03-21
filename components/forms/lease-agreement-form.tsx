"use client";

import * as React from "react";
import { Upload, X, FileText, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success" }
  | { state: "error"; message: string };

type FileState = {
  file: File | null;
  preview: string | null;
  error: string | null;
};

const REQUIRED_DOCUMENTS = [
  { key: "cdl", label: "Driver's License / CDL", accept: ".pdf,.jpg,.jpeg,.png,.webp" },
  { key: "coi", label: "Certificate of Insurance (COI)", accept: ".pdf,.jpg,.jpeg,.png,.webp" },
  { key: "registration", label: "Vehicle Registration", accept: ".pdf,.jpg,.jpeg,.png,.webp" },
  { key: "w9", label: "W-9 Form", accept: ".pdf,.jpg,.jpeg,.png,.webp" },
  { key: "dotPhysical", label: "DOT Physical", accept: ".pdf,.jpg,.jpeg,.png,.webp" },
] as const;

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

export function LeaseAgreementForm() {
  const [status, setStatus] = React.useState<Status>({ state: "idle" });
  const [files, setFiles] = React.useState<Record<string, FileState>>({});

  const fieldClassName =
    "h-10 border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 placeholder:text-xs transition-shadow focus-visible:border-primary/60 focus-visible:ring-primary/70 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";

  function handleFileChange(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setFiles((prev) => ({ ...prev, [key]: { file: null, preview: null, error: null } }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFiles((prev) => ({
        ...prev,
        [key]: { file: null, preview: null, error: "File exceeds 3MB limit." },
      }));
      return;
    }

    setFiles((prev) => ({
      ...prev,
      [key]: { file, preview: file.name, error: null },
    }));
  }

  function removeFile(key: string) {
    setFiles((prev) => ({ ...prev, [key]: { file: null, preview: null, error: null } }));
    const input = document.getElementById(`file-${key}`) as HTMLInputElement;
    if (input) input.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ state: "submitting" });

    // Validate all required files are present
    for (const doc of REQUIRED_DOCUMENTS) {
      if (!files[doc.key]?.file) {
        setStatus({ state: "error", message: `${doc.label} is required.` });
        return;
      }
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Append files to FormData
    for (const doc of REQUIRED_DOCUMENTS) {
      const fileState = files[doc.key];
      if (fileState?.file) {
        formData.set(doc.key, fileState.file);
      }
    }

    try {
      const res = await fetch("/api/lease-agreement", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.ok) {
        setStatus({ state: "error", message: data.error || "Something went wrong." });
        return;
      }

      setStatus({ state: "success" });
    } catch {
      setStatus({
        state: "error",
        message: "Network error. Please check your connection and try again.",
      });
    }
  }

  if (status.state === "success") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h3 className="mt-4 text-xl font-semibold text-foreground">Agreement Submitted</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you. Your Lease-On Agreement and documents have been submitted successfully. Our
          team will review your submission and contact you within 1-2 business days.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Questions? Call us at{" "}
          <a href="tel:+12817107787" className="font-medium text-primary hover:underline">
            (281) 710-7787
          </a>{" "}
          or email{" "}
          <a href="mailto:admin@twinmile.com" className="font-medium text-primary hover:underline">
            admin@twinmile.com
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {/* Carrier Info — Pre-filled, read-only */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
        <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-wide mb-3">
          Carrier Information
        </h3>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Carrier Name</span>
            <span className="font-medium text-foreground">Twin Mile LLC</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">MC Number</span>
            <span className="font-medium text-foreground">MC1790263</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Address</span>
            <span className="font-medium text-foreground">Houston, TX 77002</span>
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-wide mb-3">
          Required Documents
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Upload PDF, JPEG, or PNG files. Maximum 3MB per file.
        </p>
        <div className="grid gap-3">
          {REQUIRED_DOCUMENTS.map((doc) => {
            const fileState = files[doc.key];
            return (
              <div key={doc.key}>
                <label
                  className="text-sm font-semibold text-foreground/95"
                  htmlFor={`file-${doc.key}`}
                >
                  {doc.label}
                  <span className="text-destructive ml-0.5">*</span>
                </label>
                <div className="mt-1.5">
                  {fileState?.file ? (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1 truncate text-sm text-foreground">
                        {fileState.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(fileState.file.size / 1024).toFixed(0)}KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(doc.key)}
                        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label={`Remove ${doc.label}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor={`file-${doc.key}`}
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/80 bg-background/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Upload or drag file here</span>
                    </label>
                  )}
                  <input
                    type="file"
                    id={`file-${doc.key}`}
                    accept={doc.accept}
                    className="sr-only"
                    onChange={(e) => handleFileChange(doc.key, e)}
                  />
                </div>
                {fileState?.error && (
                  <p className="mt-1 text-xs text-destructive">{fileState.error}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Owner-Operator Info */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-wide mb-3">
          Owner-Operator Information
        </h3>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground/95" htmlFor="operatorName">
              Owner-Operator Name
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Input
              id="operatorName"
              name="operatorName"
              placeholder="Full name or company name"
              className={fieldClassName}
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground/95" htmlFor="operatorMcNumber">
              Owner-Operator MC Number
              <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="operatorMcNumber"
              name="operatorMcNumber"
              placeholder="MC-XXXXXXX"
              className={fieldClassName}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground/95" htmlFor="operatorEmail">
              Email Address
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Input
              id="operatorEmail"
              name="operatorEmail"
              type="email"
              placeholder="you@example.com"
              className={fieldClassName}
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground/95" htmlFor="operatorPhone">
              Phone Number
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Input
              id="operatorPhone"
              name="operatorPhone"
              type="tel"
              placeholder="(555) 555-5555"
              className={fieldClassName}
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground/95" htmlFor="operatorAddress">
              Owner-Operator Address
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Input
              id="operatorAddress"
              name="operatorAddress"
              placeholder="Full address"
              className={fieldClassName}
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground/95" htmlFor="operatorDate">
              Date
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Input
              id="operatorDate"
              name="operatorDate"
              type="date"
              className={fieldClassName}
              defaultValue={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
        By submitting this form, you acknowledge that you have read and agree to the terms and
        conditions of the Lease-On Agreement above. This constitutes your electronic signature.
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={status.state === "submitting"}
        className="shadow-lg shadow-primary/20"
      >
        {status.state === "submitting" ? "Submitting Agreement…" : "Submit Lease-On Agreement"}
      </Button>

      {status.state === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status.message}
        </div>
      )}
    </form>
  );
}
