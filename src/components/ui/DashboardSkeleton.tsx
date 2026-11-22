import React from 'react';
import { Skeleton } from './Skeleton';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-6 w-36" />
          <Skeleton variant="text" className="h-4 w-52" />
        </div>
        <Skeleton variant="rectangular" className="h-9 w-28 rounded-md" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3.5 rounded-lg bg-surface border border-line space-y-2"
          >
            <Skeleton variant="text" className="h-3 w-16" />
            <Skeleton variant="text" className="h-6 w-12" />
          </div>
        ))}
      </div>

      {/* Cards list skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg bg-surface border border-line space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton variant="text" className="h-4 w-20" />
              <Skeleton variant="rectangular" className="h-5 w-16 rounded" />
            </div>
            <Skeleton variant="text" className="h-5 w-48" />
            <Skeleton variant="text" className="h-4 w-32" />
            <div className="flex items-center justify-between pt-2 border-t border-line">
              <Skeleton variant="rectangular" className="h-8 w-24 rounded-md" />
              <Skeleton variant="rectangular" className="h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
