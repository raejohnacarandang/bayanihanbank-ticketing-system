import React from 'react';
import { AlertTriangle, HelpCircle, PlayCircle, RefreshCw } from 'lucide-react';

interface PrototypeBannerProps {
  onOpenRequirements: () => void;
  onOpenDemoGuide: () => void;
  onResetData: () => void;
}

export const PrototypeBanner: React.FC<PrototypeBannerProps> = ({
  onOpenRequirements,
  onOpenDemoGuide,
  onResetData,
}) => {
  return (
    <div className="bg-amber-950 text-amber-100 px-4 py-2 text-xs border-b border-amber-800 shadow-inner flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 font-medium">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase tracking-wider text-[11px] shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
          PROTOTYPE — FOR INTERNAL REVIEW
        </span>
        <span className="hidden md:inline text-amber-200/90">
          Bayanihan Bank IT Service Desk Initial UI/UX Demonstration (August 2026)
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        <button
          onClick={onOpenDemoGuide}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-amber-300 font-bold transition shadow-sm cursor-pointer border border-emerald-600"
          title="Start Step-by-Step Scenario Demo"
        >
          <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Demo Scenario</span>
        </button>

        <button
          onClick={onOpenRequirements}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-800 hover:bg-amber-700 text-amber-100 font-medium transition cursor-pointer"
          title="View Confirmed vs TBD Requirements"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>TBD / Requirements</span>
        </button>

        <button
          onClick={() => {
            if (confirm('Reset all tickets, comments, and notifications to original demo state?')) {
              onResetData();
            }
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
          title="Reset local storage data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset Data</span>
        </button>
      </div>
    </div>
  );
};
