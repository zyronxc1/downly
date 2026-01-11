'use client';

import { useEffect, useState, useRef } from 'react';

interface TocItem {
  id: string;
  title: string;
  number: number;
}

interface TableOfContentsProps {
  sections: TocItem[];
}

export default function TableOfContents({ sections }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Guard against build-time execution (static export)
    if (typeof window === 'undefined') return;
    if (typeof document === 'undefined') return;

    // Create Intersection Observer to track visible sections
    const observerOptions = {
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    };

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the most visible entry
        let mostVisible = entries[0];
        entries.forEach((entry) => {
          if (entry.intersectionRatio > (mostVisible?.intersectionRatio || 0)) {
            mostVisible = entry;
          }
        });

        if (mostVisible && mostVisible.isIntersecting) {
          setActiveId(mostVisible.target.id);
        }
      },
      observerOptions
    );

    // Observe all sections
    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    // Set first section as active by default
    if (sections.length > 0 && !activeId) {
      setActiveId(sections[0].id);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [sections, activeId]);

  const handleClick = (id: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // Close mobile menu after clicking
      setIsOpen(false);
    }
  };

  if (sections.length === 0) return null;

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-blue-600 dark:bg-blue-500 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600 hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Toggle table of contents"
        aria-expanded={isOpen}
      >
        <svg
          className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* TOC Content */}
      <aside
        className={`${
          isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        } lg:translate-y-0 lg:opacity-100 lg:pointer-events-auto fixed lg:sticky bottom-0 lg:top-24 left-0 right-0 lg:left-auto lg:right-auto z-40 lg:z-10 transition-all duration-300 ease-in-out lg:transition-none`}
      >
        <div className="bg-white dark:bg-gray-800 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 shadow-lg lg:shadow-none rounded-t-xl lg:rounded-lg lg:bg-white/80 lg:dark:bg-gray-800/80 lg:backdrop-blur-sm h-auto max-h-[60vh] lg:max-h-[calc(100vh-8rem)] overflow-y-auto lg:overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 lg:p-5">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <h2 className="text-xs lg:text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                Contents
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="lg:hidden text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:rotate-90 transition-all duration-200"
                aria-label="Close table of contents"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <nav className="space-y-1" aria-label="Table of contents">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => handleClick(section.id, e)}
                  className={`block px-3 py-2 text-xs lg:text-sm rounded-md transition-all duration-200 hover:translate-x-1 ${
                    activeId === section.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium border-l-2 lg:border-l-2 border-blue-600 dark:border-blue-400 pl-2.5'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200 border-l-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 pl-2.5'
                  }`}
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className={`lg:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-30 transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}

