'use client';

import dynamic from 'next/dynamic';

// Lazy load CommandPalette — only loads JS when ⌘K is pressed
const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });
// Lazy load OnboardingTour — only loads when needed
const OnboardingTour = dynamic(() => import('./OnboardingTour'), { ssr: false });

/**
 * Global client-side providers and overlays.
 * Added to root layout.
 */
export default function GlobalProviders() {
  return (
    <>
      <CommandPalette />
      <OnboardingTour />
    </>
  );
}
