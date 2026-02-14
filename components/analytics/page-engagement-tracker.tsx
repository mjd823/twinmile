"use client";

import * as React from "react";
import { analytics } from "@/lib/analytics";

interface PageEngagementTrackerProps {
  children: React.ReactNode;
  pagePath: string;
}

export function PageEngagementTracker({ children, pagePath }: PageEngagementTrackerProps) {
  const [startTime] = React.useState(Date.now());
  const [scrollDepth, setScrollDepth] = React.useState(0);
  const [interactions, setInteractions] = React.useState<string[]>([]);

  // Track scroll depth
  React.useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const currentScrollDepth = Math.round(((scrollTop + windowHeight) / documentHeight) * 100);
      
      if (currentScrollDepth > scrollDepth) {
        setScrollDepth(currentScrollDepth);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollDepth]);

  // Track interactions
  React.useEffect(() => {
    const handleInteraction = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const interactionType = getInteractionType(target);
      if (interactionType && !interactions.includes(interactionType)) {
        setInteractions(prev => [...prev, interactionType]);
      }
    };

    document.addEventListener('click', handleInteraction);
    return () => document.removeEventListener('click', handleInteraction);
  }, [interactions]);

  // Track page engagement on unmount
  React.useEffect(() => {
    return () => {
      const timeOnPage = Date.now() - startTime;
      
      analytics.trackPageEngagement(pagePath, {
        scrollDepth,
        timeOnPage: Math.round(timeOnPage / 1000), // Convert to seconds
        interactions,
      });
    };
  }, [pagePath, startTime, scrollDepth, interactions]);

  return <>{children}</>;
}

function getInteractionType(element: HTMLElement): string | null {
  const tagName = element.tagName.toLowerCase();
  const className = element.className;
  
  // Check for specific interaction types
  if (tagName === 'a') return 'link_click';
  if (tagName === 'button') return 'button_click';
  if (tagName === 'input' || tagName === 'textarea') return 'form_interaction';
  
  // Check for common CTA classes
  if (typeof className === 'string') {
    if (className.includes('cta') || className.includes('quote')) return 'cta_interaction';
    if (className.includes('nav')) return 'navigation_interaction';
    if (className.includes('contact')) return 'contact_interaction';
  }
  
  return null;
}

// Hook for manual engagement tracking
export function useEngagementTracking(pagePath: string) {
  const [interactions, setInteractions] = React.useState<string[]>([]);

  const trackInteraction = React.useCallback((interactionType: string) => {
    setInteractions(prev => {
      if (!prev.includes(interactionType)) {
        return [...prev, interactionType];
      }
      return prev;
    });
  }, []);

  const trackCustomEvent = React.useCallback((eventName: string, data: Record<string, any>) => {
    analytics.trackPageEngagement(pagePath, {
      scrollDepth: 0,
      timeOnPage: 0,
      interactions: [...interactions, `custom_${eventName}`],
      ...data,
    });
  }, [pagePath, interactions]);

  return {
    interactions,
    trackInteraction,
    trackCustomEvent,
  };
}
