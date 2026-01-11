/**
 * Disclaimer Component
 * Displays legal disclaimer about the service
 */
export function Disclaimer() {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c1.36 2.42-.87 5.381-3.486 5.381H6.163c-2.616 0-4.846-2.961-3.486-5.381l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
            Legal Disclaimer
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
            This service is for educational purposes only. Users are responsible for ensuring they have the right to download and use any content. Please respect copyright laws and platform terms of service.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <a
              href="/terms"
              className="text-yellow-800 dark:text-yellow-200 hover:underline font-medium"
            >
              Terms of Service
            </a>
            <span className="text-yellow-600 dark:text-yellow-400">•</span>
            <a
              href="/privacy"
              className="text-yellow-800 dark:text-yellow-200 hover:underline font-medium"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

