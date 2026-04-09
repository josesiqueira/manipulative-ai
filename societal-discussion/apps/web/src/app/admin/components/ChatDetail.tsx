'use client';

/**
 * ChatDetail — right-hand panel showing the full record for one conversation.
 *
 * Sections (rendered when a chat is loaded):
 *   1. Header — ID (truncated), date, duration, TopicBadge, BlockBadge, language
 *   2. Few-shot priming — collapsible <details> showing injected synthetic turns
 *   3. Transcript — chat bubbles following COMPONENTS.md § ChatBubble conventions
 *   4. Survey results — perceived vs. actual block, correct/incorrect indicator,
 *      three SurveyRating bars (persuasiveness, naturalness, confidence)
 *   5. Participant demographics — compact 2-column grid
 *
 * Empty / loading states follow COMPONENTS.md conventions:
 *   - null chat + not loading → centered "Select a conversation" placeholder
 *   - isLoading → gray animate-pulse skeleton rectangles
 *
 * All time formatting uses Intl.DateTimeFormat so no external date library is
 * needed and output adapts to the browser locale for the time portion.
 */

import { ChatDetailResponse } from '../lib/types';
import BlockBadge from './BlockBadge';
import TopicBadge from './TopicBadge';

interface ChatDetailProps {
  chat: ChatDetailResponse | null;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/**
 * Formats an ISO timestamp to HH:MM using 24-hour en-GB notation.
 * Used for per-message timestamps inside the transcript.
 */
function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

/**
 * Formats an ISO timestamp to a human-readable date + time for the header.
 * Example output: "31/03/2026, 14:22"
 */
function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

/**
 * Computes duration between two ISO timestamps and formats it as "Xm" or
 * "Xh Ym".  Returns null when either argument is missing.
 */
function formatDuration(startStr: string, endStr: string | null): string | null {
  if (!endStr) return null;
  const diffMs = new Date(endStr).getTime() - new Date(startStr).getTime();
  if (diffMs <= 0) return null;
  const totalMinutes = Math.round(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// ---------------------------------------------------------------------------
// SurveyRating sub-component (COMPONENTS.md § SurveyRating)
// ---------------------------------------------------------------------------

/**
 * Horizontal bar visualising a 1–5 rating as a proportional fill.
 * Returns null when value is null so callers don't need to guard.
 * Follows COMPONENTS.md exactly: h-1.5 bar, bg-blue-600 fill, font-mono value.
 */
function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-200 rounded-full h-1.5">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-[width]"
          style={{ width: `${(value / 5) * 100}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={1}
          aria-valuemax={5}
        />
      </div>
      <span className="text-sm font-mono font-semibold text-slate-900 w-8 text-right tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading helper (COMPONENTS.md § Section heading — h2 with divider)
// ---------------------------------------------------------------------------

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <h2 className="text-base font-semibold text-slate-700 whitespace-nowrap">{title}</h2>
      <hr className="flex-1 border-slate-200" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

/**
 * Placeholder shown while the detail response is in-flight.
 * Uses gray animate-pulse rectangles sized to match real content areas
 * (COMPONENTS.md: single gray rectangle per area, no spinners).
 */
function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-busy="true" aria-label="Loading conversation">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-5 w-20 bg-slate-100 animate-pulse rounded" />
        <div className="h-5 w-36 bg-slate-100 animate-pulse rounded" />
        <div className="h-5 w-12 bg-slate-100 animate-pulse rounded" />
        <div className="h-5 w-16 bg-slate-100 animate-pulse rounded" />
        <div className="h-5 w-20 bg-slate-100 animate-pulse rounded" />
      </div>

      {/* Few-shot skeleton */}
      <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />

      {/* Transcript skeleton — 4 alternating bubbles */}
      <div className="space-y-4">
        {[72, 55, 80, 60].map((w, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            <div
              className="bg-slate-100 animate-pulse rounded-lg h-12"
              style={{ width: `${w}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatDetail({ chat, isLoading = false }: ChatDetailProps) {
  // --- Empty state ---
  if (!chat && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 select-none">
        <p className="text-sm">Select a conversation</p>
      </div>
    );
  }

  // --- Loading state ---
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // TypeScript narrowing: at this point chat is guaranteed non-null.
  // The above guards cover null+loading=false and loading=true cases.
  if (!chat) return null;

  const duration = formatDuration(chat.created_at, chat.completed_at);
  const hasSurvey = chat.survey.perceived_leaning !== null;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">

      {/* ------------------------------------------------------------------ */}
      {/* 1. Header                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Chat ID — first 8 chars in monospace so columns align visually */}
        <span className="font-mono text-sm text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {chat.id.slice(0, 8)}
        </span>

        {/* Creation date */}
        <span className="text-sm text-slate-500">
          {formatDate(chat.created_at)}
        </span>

        {/* Duration — only shown for completed chats */}
        {duration && (
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            {duration}
          </span>
        )}

        <TopicBadge topic={chat.topic_category} />
        <BlockBadge block={chat.political_block} />

        {/* Language badge — neutral slate, same visual weight as TopicBadge */}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 uppercase">
          {chat.language}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Few-shot priming section (collapsible)                          */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <SectionHeading title="Injected Examples" />

        {chat.few_shot_examples === null ? (
          <p className="text-sm text-slate-400 italic">
            No few-shot examples cached for this chat.
          </p>
        ) : (
          /*
           * Native <details>/<summary> is used here instead of React state
           * because it requires zero JS event handling and is collapsed by
           * default.  The design system calls for this pattern explicitly.
           */
          <details className="border border-slate-200 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg select-none">
              Injected Examples (
              {chat.few_shot_examples.example_ids?.length ?? 0} statements from dataset)
            </summary>

            <div className="px-4 pb-4 space-y-2">
              {chat.few_shot_examples.turns.map((turn, i) => (
                /*
                 * Synthetic turns use the design system's "synthetic" bubble
                 * variant: muted opacity, italic, labelled [Synthetic User/Bot].
                 */
                <div
                  key={i}
                  className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'} mb-2 opacity-60`}
                >
                  <div className="max-w-[72%] bg-slate-50 border border-slate-200 text-slate-600 rounded-lg px-4 py-2 text-sm italic">
                    <span className="text-xs font-medium not-italic text-slate-400 block mb-1">
                      {turn.role === 'user' ? '[Synthetic User]' : '[Synthetic Bot]'}
                    </span>
                    {turn.content}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Conversation transcript                                          */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <SectionHeading title="Transcript" />

        {chat.messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No messages in this conversation.
          </p>
        ) : (
          <div className="space-y-3">
            {chat.messages.map((msg) =>
              msg.role === 'user' ? (
                /* User bubble — right-aligned, dark background (COMPONENTS.md § ChatBubble) */
                <div key={msg.id} className="flex justify-end mb-3">
                  <div className="max-w-[72%] bg-slate-900 text-white rounded-lg px-4 py-2.5">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-slate-400 mt-1 text-right">
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              ) : (
                /* Assistant bubble — left-aligned, light background (COMPONENTS.md § ChatBubble) */
                <div key={msg.id} className="flex justify-start mb-3">
                  <div className="max-w-[72%] bg-slate-100 text-slate-700 rounded-lg px-4 py-2.5">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-400">{formatTime(msg.created_at)}</p>
                      {/* Token count — shown only when non-null per design rules */}
                      {msg.token_count !== null && (
                        <p className="text-xs text-slate-400 font-mono">
                          {msg.token_count} tok
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Survey results (only when survey data exists)                   */}
      {/* ------------------------------------------------------------------ */}
      {hasSurvey && (
        <div>
          <SectionHeading title="Survey Results" />

          <div className="space-y-4">
            {/* Perceived vs. actual block + correct/incorrect indicator */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-slate-600">
                Participant guessed:{' '}
                <span className="font-medium text-slate-800">
                  {chat.survey.perceived_leaning}
                </span>
              </span>
              <span className="text-slate-400 text-sm">→</span>
              <span className="text-sm text-slate-600">Actual:</span>
              <BlockBadge block={chat.political_block} />

              {/* Correct/incorrect indicator with explicit iconography */}
              {chat.survey.correct_guess === true && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {/* Unicode heavy check mark */}
                  ✓ Correct
                </span>
              )}
              {chat.survey.correct_guess === false && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  {/* Unicode multiplication sign — clear X without emoji */}
                  ✕ Incorrect
                </span>
              )}
            </div>

            {/* Rating bars (COMPONENTS.md § SurveyRating) — stacked with space-y-3 */}
            <div className="space-y-3">
              <RatingBar label="Persuasiveness" value={chat.survey.persuasiveness} />
              <RatingBar label="Naturalness" value={chat.survey.naturalness} />
              <RatingBar label="Confidence" value={chat.survey.confidence} />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. Participant demographics                                         */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <SectionHeading title="Participant Demographics" />

        {/*
         * Compact 2-column grid for label/value pairs.
         * Only rows with non-null values are rendered to avoid empty clutter;
         * null values within rendered rows show an em-dash per convention.
         */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          {chat.participant.age_group !== null && (
            <>
              <dt className="text-xs text-slate-500">Age group</dt>
              <dd className="text-xs text-slate-700 font-medium">
                {chat.participant.age_group ?? '—'}
              </dd>
            </>
          )}
          {chat.participant.gender !== null && (
            <>
              <dt className="text-xs text-slate-500">Gender</dt>
              <dd className="text-xs text-slate-700 font-medium">
                {chat.participant.gender ?? '—'}
              </dd>
            </>
          )}
          {chat.participant.education !== null && (
            <>
              <dt className="text-xs text-slate-500">Education</dt>
              <dd className="text-xs text-slate-700 font-medium">
                {chat.participant.education ?? '—'}
              </dd>
            </>
          )}
          {chat.participant.political_leaning !== null && (
            <>
              <dt className="text-xs text-slate-500">Political leaning</dt>
              <dd className="text-xs font-mono text-slate-700 font-medium tabular-nums">
                {chat.participant.political_leaning ?? '—'}
              </dd>
            </>
          )}
          {chat.participant.political_knowledge !== null && (
            <>
              <dt className="text-xs text-slate-500">Political knowledge</dt>
              <dd className="text-xs font-mono text-slate-700 font-medium tabular-nums">
                {chat.participant.political_knowledge ?? '—'}
              </dd>
            </>
          )}
        </dl>

        {/* Graceful fallback when the participant row has no demographics at all */}
        {Object.values(chat.participant).every((v) => v === null) && (
          <p className="text-sm text-slate-400 italic">No demographic data available.</p>
        )}
      </div>

    </div>
  );
}
