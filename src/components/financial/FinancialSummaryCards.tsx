'use client';

// ── Financial summary cards ─────────────────────────────────────────────────
// Compact tile row used across the Super Admin's financial pages. Each card
// shows a label, a primary value, and an optional secondary line (count or
// trend). Colors are tone-driven and AA-compliant on the page background
// (white via the parent container or gray-50 for the page wrapper).

import { ReactNode } from 'react';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<Tone, { container: string; label: string; value: string; secondary: string }> = {
  neutral: {
    container: 'border-gray-200 bg-white',
    label: 'text-gray-500',
    value: 'text-gray-900',
    secondary: 'text-gray-500',
  },
  info: {
    container: 'border-blue-200 bg-blue-50',
    label: 'text-blue-700',
    value: 'text-blue-900',
    secondary: 'text-blue-700',
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50',
    label: 'text-emerald-700',
    value: 'text-emerald-900',
    secondary: 'text-emerald-700',
  },
  warning: {
    container: 'border-amber-200 bg-amber-50',
    label: 'text-amber-700',
    value: 'text-amber-900',
    secondary: 'text-amber-700',
  },
  danger: {
    container: 'border-red-200 bg-red-50',
    label: 'text-red-700',
    value: 'text-red-900',
    secondary: 'text-red-700',
  },
};

export interface FinancialSummaryCard {
  label: string;
  value: string;
  secondary?: string;
  tone?: Tone;
  icon?: ReactNode;
}

interface FinancialSummaryCardsProps {
  cards: FinancialSummaryCard[];
  columns?: 2 | 3 | 4 | 5;
}

export default function FinancialSummaryCards({ cards, columns }: FinancialSummaryCardsProps) {
  const n = cards.length;
  const gridCols =
    columns ??
    (n <= 2 ? 2 : n <= 3 ? 3 : n <= 4 ? 4 : 5);

  const gridClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
  }[gridCols];

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {cards.map((card, i) => {
        const tone = TONE_CLASSES[card.tone ?? 'neutral'];
        return (
          <div key={i} className={`rounded-xl border p-4 ${tone.container}`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs font-semibold uppercase tracking-wide ${tone.label}`}>
                {card.label}
              </p>
              {card.icon && <span className={tone.label}>{card.icon}</span>}
            </div>
            <p className={`mt-1 text-2xl font-bold ${tone.value}`}>{card.value}</p>
            {card.secondary && (
              <p className={`text-xs mt-0.5 ${tone.secondary}`}>{card.secondary}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}