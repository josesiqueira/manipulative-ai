'use client';

/**
 * SaveButton — reusable async-aware save button.
 *
 * Renders a primary action button that disables itself and shows a spinner
 * while `isLoading` is true.  Using a controlled `isLoading` prop (rather than
 * managing state internally) means the parent owns the request lifecycle, which
 * makes error recovery straightforward: the parent simply sets isLoading=false
 * and the button becomes interactive again.
 */

interface SaveButtonProps {
  /** Whether an in-flight save request is pending. Disables the button and shows spinner. */
  isLoading: boolean;
  /** Button label shown in the idle state. Defaults to 'Save'. */
  label?: string;
  /** Called when the user clicks the button (only fires when not loading). */
  onClick: () => void;
}

export default function SaveButton({ isLoading, label = 'Save', onClick }: SaveButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          {/* Accessible spinner — hidden from screen readers because the label change conveys state */}
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Saving...
        </span>
      ) : (
        label
      )}
    </button>
  );
}
