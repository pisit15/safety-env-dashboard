'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ea-she-onboarding-done';

/**
 * Hook to manage onboarding tour state.
 * Tracks whether the user has completed the tour using sessionStorage.
 */
export function useOnboarding() {
  const [hasCompleted, setHasCompleted] = useState(true); // default true to prevent flash
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const done = sessionStorage.getItem(STORAGE_KEY);
      setHasCompleted(done === 'true');
    } catch {
      setHasCompleted(false);
    }
    setIsReady(true);
  }, []);

  const markCompleted = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* ignore */ }
    setHasCompleted(true);
  }, []);

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    setHasCompleted(false);
  }, []);

  return { hasCompleted, isReady, markCompleted, reset };
}
