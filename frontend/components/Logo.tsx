'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className = '', showText = true, animated = true, size = 'md' }: LogoProps) {
  const gradientId = useId();
  
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const textSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const iconAnimation = animated ? {
    y: [0, -4, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  } : undefined;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Icon */}
      <motion.div
        animate={iconAnimation}
        className={`${sizeClasses[size]} flex-shrink-0`}
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Background circle with gradient */}
          <circle
            cx="32"
            cy="32"
            r="30"
            fill={`url(#${gradientId})`}
            className="dark:opacity-90"
          />
          
          {/* Download arrow */}
          <path
            d="M32 20L32 44M32 44L24 36M32 44L40 36"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Small circle at bottom */}
          <circle
            cx="32"
            cy="48"
            r="3"
            fill="white"
          />
          
          {/* Gradient definition */}
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
      
      {/* Logo Text */}
      {showText && (
        <span className={`font-bold ${textSizeClasses[size]} bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent`}>
          Downly
        </span>
      )}
    </div>
  );
}

