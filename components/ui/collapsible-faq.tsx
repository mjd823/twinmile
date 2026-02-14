"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleFAQProps {
  question: string;
  answer: string;
  className?: string;
}

export function CollapsibleFAQ({ question, answer, className = "" }: CollapsibleFAQProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={`group rounded-lg border border-border/40 bg-background/10 transition-all hover:border-primary/30 hover:bg-primary/5 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-3 p-4 text-left transition-colors"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${question.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60 group-hover:bg-primary transition-colors" />
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{question}</div>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        id={`faq-answer-${question.replace(/\s+/g, '-').toLowerCase()}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-96" : "max-h-0"
        }`}
      >
        <div className="px-4 pb-4 pl-8">
          <div className="text-sm text-muted-foreground leading-relaxed">{answer}</div>
        </div>
      </div>
    </div>
  );
}
