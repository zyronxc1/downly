'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedSectionProps {
  children: React.ReactNode;
  id: string;
  className?: string;
  delay?: number;
}

export default function AnimatedSection({ children, id, className = '', delay = 0 }: AnimatedSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Trigger fade-in after mount with stagger delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50 + delay); // Small base delay + custom delay

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`${className} transition-all duration-500 ease-out hover:shadow-md ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      }`}
    >
      {children}
    </section>
  );
}

