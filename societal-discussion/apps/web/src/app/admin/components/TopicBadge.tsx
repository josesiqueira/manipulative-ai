'use client';

/**
 * TopicBadge — neutral slate pill for topic category.
 *
 * Topics are NOT color-encoded; they share a single neutral style so that
 * the only colored pills in a row are BlockBadges.  The human-readable label
 * is resolved from the TOPIC_LABELS map defined in types.ts so this component
 * stays in sync with any future topic additions automatically.
 */

import { TOPIC_LABELS } from '../lib/types';

interface TopicBadgeProps {
  topic: string;
}

export default function TopicBadge({ topic }: TopicBadgeProps) {
  const label = TOPIC_LABELS[topic] ?? topic;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
      {label}
    </span>
  );
}
