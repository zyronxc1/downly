/**
 * Platform detection and utility functions
 * Detects platform from URL and provides platform-specific UI hints
 */

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'vimeo' | 'dailymotion' | 'unknown';

export type InstagramContentType = 'reel' | 'post' | 'story' | null;

export interface PlatformInfo {
  platform: Platform;
  name: string;
  icon: string; // SVG path data
  color: string; // Tailwind color class
  instagramContentType?: InstagramContentType;
  isVerticalVideo?: boolean;
}

/**
 * Detects platform from URL
 */
export function detectPlatform(url: string): Platform {
  if (!url) return 'unknown';

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (lowerUrl.includes('instagram.com')) {
    return 'instagram';
  }
  if (lowerUrl.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'twitter';
  }
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com') || lowerUrl.includes('fb.watch')) {
    return 'facebook';
  }
  if (lowerUrl.includes('vimeo.com')) {
    return 'vimeo';
  }
  if (lowerUrl.includes('dailymotion.com')) {
    return 'dailymotion';
  }

  return 'unknown';
}

/**
 * Detects Instagram content type from URL
 */
export function detectInstagramContentType(url: string): InstagramContentType {
  if (!url) return null;

  const lowerUrl = url.toLowerCase();

  // Instagram Reels: /reel/ or /reels/
  if (lowerUrl.includes('/reel/') || lowerUrl.includes('/reels/')) {
    return 'reel';
  }

  // Instagram Stories: /stories/ or /story/
  if (lowerUrl.includes('/stories/') || lowerUrl.includes('/story/')) {
    return 'story';
  }

  // Instagram Posts: /p/ or /tv/ (IGTV)
  if (lowerUrl.includes('/p/') || lowerUrl.includes('/tv/')) {
    return 'post';
  }

  return null;
}

/**
 * Detects if video is likely vertical (9:16 aspect ratio)
 * This is a heuristic - TikTok videos are typically vertical
 */
export function isLikelyVerticalVideo(platform: Platform, url: string): boolean {
  if (platform === 'tiktok') {
    return true; // TikTok videos are almost always vertical
  }
  if (platform === 'instagram') {
    const contentType = detectInstagramContentType(url);
    // Instagram Reels and Stories are typically vertical
    return contentType === 'reel' || contentType === 'story';
  }
  return false;
}

/**
 * Gets platform-specific information
 */
export function getPlatformInfo(url: string): PlatformInfo {
  const platform = detectPlatform(url);
  const instagramContentType = platform === 'instagram' ? detectInstagramContentType(url) : null;
  const isVerticalVideo = isLikelyVerticalVideo(platform, url);

  const platformConfigs: Record<Platform, Omit<PlatformInfo, 'platform' | 'instagramContentType' | 'isVerticalVideo'>> = {
    youtube: {
      name: 'YouTube',
      icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
      color: 'text-red-600 dark:text-red-400',
    },
    instagram: {
      name: 'Instagram',
      icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.266.07 1.646.07 4.85 0 3.204-.012 3.584-.07 4.85-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.646.07-4.85.07-3.204 0-3.584-.012-4.85-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.266-.07-1.647-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.646-.069 4.85-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
      color: 'text-pink-600 dark:text-pink-400',
    },
    tiktok: {
      name: 'TikTok',
      icon: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z',
      color: 'text-black dark:text-white',
    },
    twitter: {
      name: 'Twitter',
      icon: 'M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z',
      color: 'text-blue-400 dark:text-blue-500',
    },
    facebook: {
      name: 'Facebook',
      icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
      color: 'text-blue-600 dark:text-blue-400',
    },
    vimeo: {
      name: 'Vimeo',
      icon: 'M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.011 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.01.01z',
      color: 'text-blue-500 dark:text-blue-400',
    },
    dailymotion: {
      name: 'Dailymotion',
      icon: 'M13.456 0H2.544A2.544 2.544 0 0 0 0 2.544v10.912A2.544 2.544 0 0 0 2.544 16h10.912A2.544 2.544 0 0 0 16 13.456V2.544A2.544 2.544 0 0 0 13.456 0zM9.6 10.4L6.4 8l3.2-2.4v4.8z',
      color: 'text-blue-600 dark:text-blue-400',
    },
    unknown: {
      name: 'Media',
      icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
      color: 'text-gray-600 dark:text-gray-400',
    },
  };

  const config = platformConfigs[platform];

  return {
    platform,
    ...config,
    instagramContentType,
    isVerticalVideo,
  };
}

/**
 * Gets platform-specific format emphasis hints
 */
export function getPlatformFormatHints(platform: Platform): {
  showResolution: boolean;
  showCodec: boolean;
  showVerticalIndicator: boolean;
} {
  switch (platform) {
    case 'youtube':
      return {
        showResolution: true,
        showCodec: true,
        showVerticalIndicator: false,
      };
    case 'tiktok':
      return {
        showResolution: true,
        showCodec: false,
        showVerticalIndicator: true,
      };
    case 'instagram':
      return {
        showResolution: true,
        showCodec: false,
        showVerticalIndicator: false,
      };
    default:
      return {
        showResolution: true,
        showCodec: false,
        showVerticalIndicator: false,
      };
  }
}

/**
 * Gets Instagram content type label
 */
export function getInstagramContentTypeLabel(contentType: InstagramContentType): string {
  switch (contentType) {
    case 'reel':
      return 'Reel';
    case 'post':
      return 'Post';
    case 'story':
      return 'Story';
    default:
      return '';
  }
}

