'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface LoadingButtonProps {
  children: ReactNode;
  isLoading?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Professional button component with loading, success, and error states
 */
export function LoadingButton({
  children,
  isLoading = false,
  isSuccess = false,
  isError = false,
  disabled = false,
  onClick,
  className = '',
  variant = 'primary',
  size = 'md',
}: LoadingButtonProps) {
  const isDisabled = disabled || isLoading;

  const baseClasses = 'relative font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 overflow-hidden';
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 sm:px-6 py-2.5 sm:py-3 text-sm',
    lg: 'px-6 sm:px-8 py-3 sm:py-4 text-base',
  };

  const variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white focus:ring-primary-500 disabled:bg-gray-400',
    secondary: 'bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white focus:ring-gray-500 disabled:bg-gray-400',
    success: 'bg-success-600 hover:bg-success-700 active:bg-success-800 text-white focus:ring-success-500 disabled:bg-gray-400',
    error: 'bg-error-600 hover:bg-error-700 active:bg-error-800 text-white focus:ring-error-500 disabled:bg-gray-400',
  };

  const stateClasses = isDisabled
    ? 'opacity-50 cursor-not-allowed hover:scale-100 active:scale-100'
    : 'hover:scale-[1.02] active:scale-[0.98] hover:shadow-md active:shadow-sm';

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${stateClasses} ${className}`}
    >
      {/* Loading Overlay */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-current/20"
        >
          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </motion.div>
      )}

      {/* Success Overlay */}
      {isSuccess && !isLoading && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-success-600"
        >
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}

      {/* Error Overlay */}
      {isError && !isLoading && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-error-600"
        >
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.div>
      )}

      {/* Content */}
      <span className={`relative flex items-center justify-center transition-opacity duration-300 ${
        isLoading || isSuccess || isError ? 'opacity-0' : 'opacity-100'
      }`}>
        {children}
      </span>
    </button>
  );
}

