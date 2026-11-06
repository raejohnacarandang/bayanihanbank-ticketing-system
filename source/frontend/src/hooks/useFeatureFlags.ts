import React, { useState, useEffect } from 'react';

export type FeatureFlag = {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number;
  targetRoles?: string[];
  targetUsers?: string[];
};

interface FeatureFlagsConfig {
  flags: Record<string, FeatureFlag>;
  defaults: Record<string, boolean>;
}

const defaultFlags: Record<string, FeatureFlag> = {
  'kanban-board': {
    key: 'kanban-board',
    name: 'Kanban Board View',
    description: 'Visual drag-and-drop ticket board',
    enabled: true,
    rolloutPercentage: 100,
  },
  'command-palette': {
    key: 'command-palette',
    name: 'Command Palette',
    description: 'Ctrl+K global search and actions',
    enabled: true,
    rolloutPercentage: 100,
  },
  'onboarding-tour': {
    key: 'onboarding-tour',
    name: 'Onboarding Tour',
    description: 'Interactive guided tour for new users',
    enabled: true,
    rolloutPercentage: 100,
  },
  'drag-drop': {
    key: 'drag-drop',
    name: 'Drag & Drop',
    description: 'Drag tickets between statuses',
    enabled: true,
    rolloutPercentage: 100,
  },
  'bulk-actions': {
    key: 'bulk-actions',
    name: 'Bulk Actions',
    description: 'Select multiple tickets for bulk operations',
    enabled: true,
    rolloutPercentage: 100,
  },
  'real-time-indicators': {
    key: 'real-time-indicators',
    name: 'Real-time Indicators',
    description: 'Live typing indicators and presence',
    enabled: false,
    rolloutPercentage: 0,
  },
  'smart-notifications': {
    key: 'smart-notifications',
    name: 'Smart Notifications',
    description: 'Grouped, prioritized notifications with grouping',
    enabled: true,
    rolloutPercentage: 100,
  },
  'dashboard-customization': {
    key: 'dashboard-customization',
    name: 'Dashboard Customization',
    description: 'Drag-to-rearrange dashboard widgets',
    enabled: false,
    rolloutPercentage: 0,
  },
  'advanced-search': {
    key: 'advanced-search',
    name: 'Advanced Search',
    description: 'Saved filters, date ranges, boolean operators',
    enabled: true,
    rolloutPercentage: 100,
  },
  'time-tracking': {
    key: 'time-tracking',
    name: 'Time Tracking',
    description: 'Start/stop timer on tickets with SLA countdown',
    enabled: false,
    rolloutPercentage: 0,
  },
  'pwa-support': {
    key: 'pwa-support',
    name: 'PWA Support',
    description: 'Installable app with offline support',
    enabled: true,
    rolloutPercentage: 100,
  },
  'keyboard-shortcuts': {
    key: 'keyboard-shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'Global keyboard shortcuts for power users',
    enabled: true,
    rolloutPercentage: 100,
  },
  'micro-interactions': {
    key: 'micro-interactions',
    name: 'Micro-interactions',
    description: 'Enhanced button states, hover effects, transitions',
    enabled: true,
    rolloutPercentage: 100,
  },
  'accessibility-enhanced': {
    key: 'accessibility-enhanced',
    name: 'Enhanced Accessibility',
    description: 'WCAG 2.1 AA compliance, screen reader support',
    enabled: true,
    rolloutPercentage: 100,
  },
  'reduced-motion': {
    key: 'reduced-motion',
    name: 'Reduced Motion',
    description: 'Respect prefers-reduced-motion preference',
    enabled: true,
    rolloutPercentage: 100,
  },
  'focus-management': {
    key: 'focus-management',
    name: 'Focus Management',
    description: 'Focus trapping, restoration, visible focus rings',
    enabled: true,
    rolloutPercentage: 100,
  },
  'loading-skeletons': {
    key: 'loading-skeletons',
    name: 'Loading Skeletons',
    description: 'Content-shaped loading placeholders',
    enabled: true,
    rolloutPercentage: 100,
  },
  'empty-states': {
    key: 'empty-states',
    name: 'Enhanced Empty States',
    description: 'Illustrated empty states with actionable CTAs',
    enabled: true,
    rolloutPercentage: 100,
  },
  'toast-undo': {
    key: 'toast-undo',
    name: 'Toast Undo Actions',
    description: 'Toast notifications with undo capability',
    enabled: true,
    rolloutPercentage: 100,
  },
};

class FeatureFlags {
  private flags: Map<string, FeatureFlag> = new Map();
  private userContext: { userId?: string; roles?: string[] } = {};

  constructor(initialFlags?: Record<string, FeatureFlag>) {
    Object.entries(initialFlags || defaultFlags).forEach(([key, flag]) => {
      this.flags.set(key, { ...flag });
    });
  }

  setUserContext(userId?: string, roles?: string[]) {
    this.userContext = { userId, roles };
  }

  isEnabled(key: string): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    if (!flag.enabled) return false;

    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.getUserHash();
      if (hash > flag.rolloutPercentage) return false;
    }

    if (flag.targetRoles && flag.targetRoles.length > 0) {
      if (!this.userContext.roles?.some(r => flag.targetRoles!.includes(r))) {
        return false;
      }
    }

    if (flag.targetUsers && flag.targetUsers.length > 0) {
      if (!this.userContext.userId || !flag.targetUsers.includes(this.userContext.userId)) {
        return false;
      }
    }

    return true;
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getEnabledFlags(): FeatureFlag[] {
    return this.getAllFlags().filter(f => this.isEnabled(f.key));
  }

  setFlag(key: string, enabled: boolean): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.enabled = enabled;
    }
  }

  setRollout(key: string, percentage: number): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    }
  }

  private getUserHash(): number {
    if (!this.userContext.userId) return 50;
    let hash = 0;
    for (let i = 0; i < this.userContext.userId.length; i++) {
      hash = ((hash << 5) - hash) + this.userContext.userId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 100);
  }

  reset(): void {
    this.flags.clear();
    Object.entries(defaultFlags).forEach(([key, flag]) => {
      this.flags.set(key, { ...flag });
    });
  }

  getConfig() {
    return {
      flags: Object.fromEntries(this.flags),
      defaults: Object.fromEntries(
        Object.entries(defaultFlags).map(([k, v]) => [k, v.enabled])
      ),
    };
  }
}

export const featureFlags = new FeatureFlags();

export function useFeatureFlag(key: string): boolean {
  const [enabled, setEnabled] = React.useState(() => featureFlags.isEnabled(key));
  
  React.useEffect(() => {
    const check = () => setEnabled(featureFlags.isEnabled(key));
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [key]);

  return enabled;
}

export function useFeatureFlags(): Record<string, boolean> {
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  
  React.useEffect(() => {
    const allFlags = featureFlags.getAllFlags();
    const initial = Object.fromEntries(
      allFlags.map(f => [f.key, featureFlags.isEnabled(f.key)])
    );
    setFlags(initial);
    
    const interval = setInterval(() => {
      const updated = Object.fromEntries(
        featureFlags.getAllFlags().map(f => [f.key, featureFlags.isEnabled(f.key)])
      );
      setFlags(prev => {
        const changed = Object.keys(updated).some(k => prev[k] !== updated[k]);
        return changed ? updated : prev;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return flags;
}

export function FeatureGate({ 
  flag, 
  children, 
  fallback = null 
}: { 
  flag: string; 
  children: React.ReactNode; 
  fallback?: React.ReactNode | null;
}) {
  const enabled = useFeatureFlag(flag);
  return enabled ? React.createElement(React.Fragment, null, children) : React.createElement(React.Fragment, null, fallback);
}

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}