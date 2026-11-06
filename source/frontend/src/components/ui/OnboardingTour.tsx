import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';

interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
  actionLabel?: string;
}

interface TourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  storageKey?: string;
  showSkip?: boolean;
}

export function OnboardingTour({ 
  steps, 
  isOpen, 
  onClose, 
  onComplete,
  storageKey = 'onboarding-completed',
  showSkip = true
}: TourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const current = steps[currentStep];

  useEffect(() => {
    if (!isOpen) return;

    const completed = localStorage.getItem(storageKey);
    if (completed === 'true') {
      onClose();
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, storageKey]);

  const updateTargetRect = useCallback(() => {
    if (!current) return;
    const element = document.querySelector(current.target);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [current]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect]);

  const goToNext = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem(storageKey, 'true');
      onComplete?.();
      onClose();
    }
    
    setTimeout(() => setIsAnimating(false), 300);
  }, [currentStep, steps.length, onClose, onComplete, storageKey]);

  const goToPrev = useCallback(() => {
    if (isAnimating || currentStep === 0) return;
    setIsAnimating(true);
    setCurrentStep(currentStep - 1);
    setTimeout(() => setIsAnimating(false), 300);
  }, [currentStep]);

  if (!isOpen || !current) return null;

  const getPositionStyles = () => {
    if (!targetRect || current.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '420px',
      };
    }

    const { top, left, right, bottom, width, height } = targetRect;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = 420;
    const tooltipHeight = 200;
    const gap = 12;

    let tooltipTop = 0;
    let tooltipLeft = 0;

    switch (current.position) {
      case 'top':
        tooltipTop = top - tooltipHeight - gap;
        tooltipLeft = left + width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        tooltipTop = bottom + gap;
        tooltipLeft = left + width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        tooltipTop = top + height / 2 - tooltipHeight / 2;
        tooltipLeft = left - tooltipWidth - gap;
        break;
      case 'right':
        tooltipTop = top + height / 2 - tooltipHeight / 2;
        tooltipLeft = right + gap;
        break;
    }

    tooltipTop = Math.max(16, Math.min(tooltipTop, viewportHeight - tooltipHeight - 16));
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, viewportWidth - tooltipWidth - 16));

    return {
      top: `${tooltipTop}px`,
      left: `${tooltipLeft}px`,
      transform: 'none',
      maxWidth: `${tooltipWidth}px`,
    };
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={getPositionStyles()}
          className={`
            fixed z-50 w-full max-w-[420px] bg-white rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] 
            border border-slate-200 overflow-hidden pointer-events-auto
          `}
        >
          <div className="flex items-start justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{current.title}</h3>
                <p className="text-sm text-slate-500">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
            </div>
            <button type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition flex-shrink-0"
              aria-label="Skip tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5">
            <p className="text-slate-700 leading-relaxed mb-5">{current.content}</p>
            
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {steps.map((_, i) => (
                  <motion.button type="button"
                    key={i}
                    onClick={() => { setCurrentStep(i); setIsAnimating(false); }}
                    disabled={i === currentStep}
                    className={`
                      w-2.5 h-2.5 rounded-full transition-all duration-200
                      ${i === currentStep ? 'bg-emerald-500' : 'bg-slate-200 hover:bg-slate-300'}
                    `}
                    aria-label={`Go to step ${i + 1}`}
                    aria-current={i === currentStep ? 'step' : undefined}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {currentStep > 0 && (
                  <button type="button"
                    onClick={goToPrev}
                    disabled={isAnimating}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </button>
                )}
                
                <motion.button type="button"
                  onClick={goToNext}
                  disabled={isAnimating}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 inline mr-1" />
                      Get Started
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {showSkip && (
            <div className="p-4 border-t border-slate-100 text-center">
              <button type="button"
                onClick={onClose}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                Skip tour
              </button>
            </div>
          )}
        </motion.div>

        {targetRect && current.position !== 'center' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            style={{
              position: 'fixed',
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
              pointerEvents: 'none',
              zIndex: 45,
            }}
            className="rounded-lg border-2 border-emerald-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
          >
            <motion.div
              animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.5)', '0 0 0 8px rgba(16,185,129,0)'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-lg border-2 border-emerald-500/50"
            />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function useOnboardingTour(storageKey: string = 'onboarding-completed') {
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    setHasCompleted(completed === 'true');
  }, [storageKey]);

  const complete = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setHasCompleted(true);
  }, [storageKey]);

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasCompleted(false);
  }, [storageKey]);

  return { hasCompleted, complete, reset };
}

export const defaultOnboardingSteps: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    title: 'Welcome to Bayanihan Bank IT Service Desk',
    content: 'Welcome! This quick tour will show you the key features to help you get started.',
    position: 'center',
  },
  {
    id: 'dashboard',
    target: '[data-tour="dashboard"]',
    title: 'Dashboard Overview',
    content: 'Your dashboard shows ticket status, branch health, and quick actions. Click any card to dive deeper.',
    position: 'bottom',
  },
  {
    id: 'new-ticket',
    target: '[data-tour="new-ticket"]',
    title: 'Create a Ticket',
    content: 'Click here to submit a new IT request. Fill in the details and we\'ll route it to the right team.',
    position: 'bottom',
  },
  {
    id: 'branch-monitor',
    target: '[data-tour="branch-monitor"]',
    title: 'Branch System Monitoring',
    content: 'Monitor the health of all branch systems in real-time. Red indicators need attention.',
    position: 'right',
  },
  {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    title: 'Notifications',
    content: 'Bell icon shows your alerts. Click to view all or mark as read.',
    position: 'left',
  },
  {
    id: 'profile',
    target: '[data-tour="profile"]',
    title: 'Your Profile',
    content: 'Manage your account settings, password, and preferences here.',
    position: 'left',
  },
];