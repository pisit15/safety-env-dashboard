'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ea-she-onboarding-done';

/**
 * Hook to manage onboarding tour state.
 * Tracks whether the user has completed the tour using localStorage
 * (persists across sessions — previously sessionStorage caused the tour
 * to reappear on every new visit).
 */
export function useOnboarding() {
  const [hasCompleted, setHasCompleted] = useState(true); // default true to prevent flash
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      setHasCompleted(done === 'true');
    } catch {
      setHasCompleted(false);
    }
    setIsReady(true);
  }, []);

  const markCompleted = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* ignore */ }
    setHasCompleted(true);
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    setHasCompleted(false);
  }, []);

  return { hasCompleted, isReady, markCompleted, reset };
}
