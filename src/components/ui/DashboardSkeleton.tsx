import React from 'react';
import { Skeleton } from './Skeleton';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-6 w-36" />
          <Skeleton variant="text" className="h-4 w-52" />
        </div>
        <Skeleton variant="rectangular" className="h-9 w-28 rounded-xl" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E2DDD4] dark:border-[#2C2C2C] space-y-2"
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
            className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-[#E2DDD4] dark:border-[#2C2C2C] space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton variant="text" className="h-4 w-20" />
              <Skeleton variant="rectangular" className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton variant="text" className="h-5 w-48" />
            <Skeleton variant="text" className="h-4 w-32" />
            <div className="flex items-center justify-between pt-2 border-t border-[#E2DDD4] dark:border-[#2C2C2C]">
              <Skeleton variant="rectangular" className="h-8 w-24 rounded-lg" />
              <Skeleton variant="rectangular" className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
