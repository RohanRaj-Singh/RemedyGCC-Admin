'use client';

// ── Dashboard header — page title + operational headline (PA4 polish) ──────
// Establishes the operator's place on the page and the current operational
// state. Hierarchy:
//
//   H1        Greeting · Date      — page identity (text-2xl)
//   Headline  One-line summary     — operational state (text-sm, gray-600)
//
// The headline uses `headlineFor()` from `lib/dashboard/grouping.ts` so
// the page never contradicts the attention queue. The Refresh button sits
// at the same baseline as the H1 so the operator can refresh without
// scanning the page.
//
// PA4 polish: tightened letter-spacing on the H1, a more deliberate
// dot separator, and a refined date format that reads like a real
// control center, not a marketing banner.

import { headlineFor } from '@/lib/dashboard/grouping';
import type { DashboardSummary } from '@/lib/dashboard/types';

interface DashboardHeaderProps {
  summary: DashboardSummary;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLine(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DashboardHeader({ summary }: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="text-[1.65rem] font-semibold tracking-tight text-gray-900 leading-tight sm:text-2xl">
        {greeting()}, Admin
        <span className="mx-2.5 font-normal text-gray-300" aria-hidden="true">·</span>
        <span className="font-normal text-gray-500">{todayLine()}</span>
      </h1>
      <p className="text-sm text-gray-600">{headlineFor(summary)}</p>
    </header>
  );
}
