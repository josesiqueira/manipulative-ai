import { useEffect } from 'react';

/**
 * useUnsavedChanges — warn the user before they navigate away from a page
 * that has unsaved edits.
 *
 * While `isDirty` is true, the hook attaches a `beforeunload` listener that
 * triggers the browser's native "Leave site?" confirmation dialog.  As soon as
 * `isDirty` flips back to false (e.g. after a successful save), the listener
 * is removed and the warning disappears.
 *
 * Note: modern browsers ignore custom message strings supplied via
 * `returnValue` for security reasons — the dialog text is fixed by the
 * browser.  Setting `returnValue = ''` is still required to trigger the
 * prompt at all.
 */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required for the prompt to show in some browsers.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [isDirty]);
}
