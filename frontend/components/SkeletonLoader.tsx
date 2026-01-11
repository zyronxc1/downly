/**
 * Skeleton loader component for loading states
 */
export function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  );
}

/**
 * Format card skeleton loader
 */
export function FormatCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-600">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-600 rounded-md animate-pulse"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
          <div className="h-11 w-32 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
          <div className="h-11 w-20 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
          <div className="h-11 w-20 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Media info skeleton loader
 */
export function MediaInfoSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Thumbnail skeleton */}
      <div className="w-full aspect-video bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
      </div>
      
      {/* Content skeleton */}
      <div className="p-6 md:p-8">
        {/* Title skeleton */}
        <div className="h-10 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 animate-pulse"></div>
        
        {/* Duration skeleton */}
        <div className="flex items-center gap-2 mb-8">
          <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
        </div>
        
        {/* Tabs skeleton (if applicable) */}
        <div className="mb-8">
          <div className="inline-flex bg-gray-100 dark:bg-gray-700/50 p-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
            <div className="h-10 w-28 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
            <div className="h-10 w-28 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse ml-2"></div>
          </div>
        </div>
        
        {/* Format cards skeleton */}
        <div className="space-y-4">
          <FormatCardSkeleton />
          <FormatCardSkeleton />
          <FormatCardSkeleton />
        </div>
      </div>
    </div>
  );
}
