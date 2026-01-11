'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import TableOfContents from '@/components/TableOfContents';
import AnimatedSection from '@/components/AnimatedSection';

const termsSections = [
  { id: 'section-1', title: 'Acceptance of Terms', number: 1 },
  { id: 'section-2', title: 'Educational Purpose', number: 2 },
  { id: 'section-3', title: 'User Responsibilities', number: 3 },
  { id: 'section-4', title: 'Prohibited Uses', number: 4 },
  { id: 'section-5', title: 'Disclaimer of Warranties', number: 5 },
  { id: 'section-6', title: 'Limitation of Liability', number: 6 },
  { id: 'section-7', title: 'Rate Limiting', number: 7 },
  { id: 'section-8', title: 'Changes to Terms', number: 8 },
  { id: 'section-9', title: 'Contact', number: 9 },
];

export default function TermsPageClient() {
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
              <span className="text-gray-600 dark:text-gray-400 font-medium">Terms</span>
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
              <TableOfContents sections={termsSections} />
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
                Terms of Service
              </h1>
              <p className={`text-sm sm:text-base text-gray-500 dark:text-gray-400 transition-opacity duration-500 delay-100 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="space-y-4">
              <AnimatedSection id="section-1" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={0}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  1. Acceptance of Terms
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  By accessing and using Downly, you accept and agree to be bound by the terms and provision of this agreement.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-2" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={50}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  2. Educational Purpose
                </h2>
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 rounded-r-lg p-3 sm:p-4 mb-0" role="note" aria-label="Important information">
                  <div className="flex items-start">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1 text-sm sm:text-base">Educational Use Only</p>
                      <p className="text-blue-800 dark:text-blue-200 text-xs sm:text-sm leading-relaxed">
                        This service is provided for educational purposes only. Downly is a demonstration project and should not be used for commercial purposes or to violate any copyright laws or platform terms of service.
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>

              <AnimatedSection id="section-3" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={100}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  3. User Responsibilities
                </h2>
                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 dark:border-amber-400 rounded-r-lg p-3 sm:p-4 mb-4 sm:mb-5" role="alert" aria-label="Important notice">
                  <div className="flex items-start">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1 text-sm sm:text-base">Your Responsibility for Copyright</p>
                      <p className="text-amber-800 dark:text-amber-200 text-xs sm:text-sm leading-relaxed">
                        You are solely responsible for ensuring you have the legal right to download and use any content, and for complying with all applicable copyright laws and regulations.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-4 sm:mb-5 leading-relaxed text-sm sm:text-base">
                  You are solely responsible for:
                </p>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 sm:space-y-3 mb-0 leading-relaxed text-sm sm:text-base pl-2 sm:pl-4">
                  <li>Ensuring you have the legal right to download and use any content</li>
                  <li>Complying with all applicable copyright laws and regulations</li>
                  <li>Respecting the terms of service of the platforms from which you download content</li>
                  <li>Using the service in a lawful manner</li>
                </ul>
              </AnimatedSection>

              <AnimatedSection id="section-4" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={150}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  4. Prohibited Uses
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4 sm:mb-5 leading-relaxed text-sm sm:text-base">
                  You may not use this service to:
                </p>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 sm:space-y-3 mb-0 leading-relaxed text-sm sm:text-base pl-2 sm:pl-4">
                  <li>Download copyrighted content without permission</li>
                  <li>Violate any local, state, national, or international law</li>
                  <li>Infringe upon intellectual property rights</li>
                  <li>Use the service for commercial purposes</li>
                  <li>Attempt to abuse, overload, or harm the service</li>
                </ul>
              </AnimatedSection>

              <AnimatedSection id="section-5" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={200}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  5. Disclaimer of Warranties
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  The service is provided &quot;as is&quot; without warranties of any kind, either express or implied. We do not guarantee that the service will be uninterrupted, secure, or error-free.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-6" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={250}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  6. Limitation of Liability
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  In no event shall Downly or its operators be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-7" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={300}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  7. Rate Limiting
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  To ensure fair usage and prevent abuse, the service implements rate limiting. Excessive requests may result in temporary restrictions.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-8" className="bg-white dark:bg-gray-800/50 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={350}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  8. Changes to Terms
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
                </p>
              </AnimatedSection>

              <AnimatedSection id="section-9" className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 sm:p-6 lg:p-8 scroll-mt-20 sm:scroll-mt-24" delay={400}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-5 mt-0">
                  9. Contact
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-0 leading-relaxed text-sm sm:text-base">
                  If you have any questions about these Terms of Service, please contact us through the appropriate channels.
                </p>
              </AnimatedSection>
            </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table of Contents - Mobile (overlay) */}
        <div className="lg:hidden">
          <TableOfContents sections={termsSections} />
        </div>
      </div>
    </div>
  );
}

