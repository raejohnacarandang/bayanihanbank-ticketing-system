import React from "react";

interface SkeletonProps {
  className?: string;
}

export const SkeletonLine: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`skeleton h-4 ${className}`} />
);

export const SkeletonCircle: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`skeleton rounded-full ${className}`} />
);

export const SkeletonCard: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 p-5 ${className}`}>
    <div className="flex items-center gap-4 mb-4">
      <SkeletonCircle className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="w-1/3" />
        <SkeletonLine className="w-1/2 opacity-60" />
      </div>
    </div>
    <div className="space-y-2">
      <SkeletonLine className="w-full" />
      <SkeletonLine className="w-4/5" />
      <SkeletonLine className="w-3/5" />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
    <div className="bg-slate-100 px-6 py-3">
      <div className="flex gap-4">
        <SkeletonLine className="w-20" />
        <SkeletonLine className="w-32" />
        <SkeletonLine className="w-24" />
        <SkeletonLine className="w-16" />
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="px-6 py-4 border-t border-slate-100 flex gap-4 items-center"
      >
        <SkeletonLine className="w-20" />
        <SkeletonLine className="w-32" />
        <SkeletonLine className="w-24" />
        <SkeletonLine className="w-16" />
      </div>
    ))}
  </div>
);
