import { useEffect, useRef, useCallback } from 'react';

export function useFocusTrap(enabled: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => container.removeEventListener('keydown', handleTab);
  }, [enabled]);

  return containerRef;
}

export function useFocusRestore() {
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previousActiveRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    previousActiveRef.current?.focus();
  }, []);

  return { saveFocus, restoreFocus };
}

export function useFocusOnMount(condition: boolean = true) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (condition && ref.current) {
      ref.current.focus();
    }
  }, [condition]);

  return ref;
}

export function useArrowNavigation(
  itemsCount: number,
  onSelect: (index: number) => void,
  options: { vertical?: boolean; horizontal?: boolean; loop?: boolean } = {}
) {
  const { vertical = true, horizontal = false, loop = true } = options;
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (vertical && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        let newIndex = selectedIndex + delta;
        
        if (loop) {
          newIndex = (newIndex + itemsCount) % itemsCount;
        } else {
          newIndex = Math.max(0, Math.min(itemsCount - 1, newIndex));
        }
        setSelectedIndex(newIndex);
        onSelect(newIndex);
      }
      
      if (horizontal && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        let newIndex = selectedIndex + delta;
        
        if (loop) {
          newIndex = (newIndex + itemsCount) % itemsCount;
        } else {
          newIndex = Math.max(0, Math.min(itemsCount - 1, newIndex));
        }
        setSelectedIndex(newIndex);
        onSelect(newIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, itemsCount, onSelect, vertical, horizontal, loop]);

  return { selectedIndex, setSelectedIndex };
}

export function useAnnouncement() {
  const [announcement, setAnnouncement] = React.useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement('');
    setTimeout(() => {
      setAnnouncement(message);
    }, 50);
  }, []);

  return (
    <>
      <div
        role="status"
        aria-live={announcement ? 'polite' : 'off'}
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </>
  );
}

import React from 'react';