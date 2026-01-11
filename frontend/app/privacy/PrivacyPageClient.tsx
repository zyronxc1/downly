'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import TableOfContents from '@/components/TableOfContents';
import AnimatedSection from '@/components/AnimatedSection';

const privacySections = [
  { id: 'section-1', title: 'Information We Collect', number: 1 },
  { id: 'section-2', title: 'How We Use Information', number: 2 },
  { id: 'section-3', title: 'Data Storage', number: 3 },
  { id: 'section-4', title: 'Third-Party Services', number: 4 },
  { id: 'section-5', title: 'Cookies and Tracking', number: 5 },
  { id: 'section-6', title: 'Data Security', number: 6 },
  { id: 'section-7', title: 'Your Rights', number: 7 },
  { id: 'section-8', title: 'Children\'s Privacy', number: 8 },
  { id: 'section-9', title: 'Changes to Privacy Policy', number: 9 },
  { id: 'section-10', title: 'Contact', number: 10 },
];

export default function PrivacyPageClient() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Sticky Header */}
      <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-md border-b border-gray-200 dark:border-gray-700' 
          : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto py-3 sm:py-4">
            <nav className="flex items-center space-x-2 text-sm sm:text-base" aria-label="Breadcrumb">
              <Link
                href="/"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 font-medium hover:underline decoration-2 underline-offset-2"
              >
                Home
              </Link>
              <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 dark:text-gray-400 font-medium">Privacy Policy</span>
            </nav>
          </div>
        </div>
      </header>

      {/* Sticky Back Button */}
      <div className="sticky top-14 sm:top-16 z-40 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sm:hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto py-3">
            <Link
              href="/"
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 font-medium text-sm hover:translate-x-[-2px] group"
            >
              <svg className="h-4 w-4 mr-2 transition-transform duration-200 group-hover:translate-x-[-2px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 lg:gap-12 items-start">
            {/* Table of Contents - Desktop Sidebar */}
            <div className="hidden lg:block">
              <TableOfContents sections={privacySections} />
            </div>
            
            {/* Main Content */}
            <div className="max-w-3xl mx-auto lg:mx-0">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 sm:p-8 lg:p-10">
            {/* Desktop Back Button */}
            <Link
              href="/"
              className="hidden sm:inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 mb-6 font-medium hover:translate-x-[-2px] group"
            >
              <svg className="h-5 w-5 mr-2 transition-transform duration-200 group-hover:translate-x-[-2px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>

            <div className={`mb-8 sm:mb-10 transition-all duration-500 ease-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 tracking-tight">
                Privacy Policy
              </h1>
              <p className={`text-sm sm:text-base text-gray-500 dark:text-gray-400 transition-opacity duration-500 delay-100 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="space-y-4">
              <AnimatedSection id="section-1" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={0}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  1. Information We Collect
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4 sm:mb-5 leading-relaxed text-sm sm:text-base">
                  Downly is designed with privacy in mind. We collect minimal information necessary for the service to function:
                </p>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 sm:space-y-3 mb-0 leading-relaxed text-sm sm:text-base pl-2 sm:pl-4">
                  <li><strong className="font-semibold text-gray-900 dark:text-white">IP Address:</strong> Collected for rate limiting and security purposes</li>
                  <li><strong className="font-semibold text-gray-900 dark:text-white">URLs:</strong> The media URLs you submit for processing</li>
                  <li><strong className="font-semibold text-gray-900 dark:text-white">Usage Data:</strong> Basic request logs for service maintenance</li>
                </ul>
              </AnimatedSection>

              <AnimatedSection id="section-2" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={50}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  2. How We Use Information
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4 sm:mb-5 leading-relaxed text-sm sm:text-base">
                  We use the collected information solely for:
                </p>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 sm:space-y-3 mb-0 leading-relaxed text-sm sm:text-base pl-2 sm:pl-4">
                  <li>Processing your media download and conversion requests</li>
                  <li>Implementing rate limiting to prevent abuse</li>
                  <li>Ensuring service security and stability</li>
                  <li>Improving service performance</li>
                </ul>
              </AnimatedSection>

              <AnimatedSection id="section-3" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={100}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  3. Data Storage
                </h2>
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 rounded-r-lg p-3 sm:p-4 mb-4 sm:mb-5" role="note" aria-label="Important information">
                  <div className="flex items-start">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1 text-sm sm:text-base">No Permanent Storage</p>
                      <p className="text-blue-800 dark:text-blue-200 text-xs sm:text-sm leading-relaxed">
                        We do not permanently store your media files or personal information. Media files are streamed directly and not saved on our servers.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  Logs are retained only for security and debugging purposes and are automatically purged.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-4" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={150}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  4. Third-Party Services
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  This service uses yt-dlp and FFmpeg to process media. These tools may access external platforms to retrieve content. We are not responsible for the privacy practices of these third-party platforms.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-5" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={200}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  5. Cookies and Tracking
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  We do not use cookies or tracking technologies. The service operates without persistent user tracking.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-6" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={250}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  6. Data Security
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  We implement security measures including rate limiting, URL validation, and request monitoring to protect against abuse and ensure service stability.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-7" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={300}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  7. Your Rights
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  Since we do not store personal information, there is no personal data to access, modify, or delete. If you have concerns about your usage data, please contact us.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-8" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={350}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  8. Children&apos;s Privacy
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  This service is not intended for children under 13. We do not knowingly collect information from children.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-9" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={400}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  9. Changes to Privacy Policy
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-10" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={450}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  10. Contact
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  If you have questions about this Privacy Policy, please contact us through the appropriate channels.
                </p>
              </AnimatedSection>
            </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table of Contents - Mobile (overlay) */}
        <div className="lg:hidden">
          <TableOfContents sections={privacySections} />
        </div>
      </div>
    </div>
  );
}
