import { useEffect, useRef } from 'react';

/**
 * Cross-tab session guard hook.
 *
 * When another browser tab logs in with a different account and writes new
 * auth data to localStorage, the `storage` event fires in *this* tab.
 * We compare the incoming user ID with the one captured at mount time and,
 * if they differ, redirect to the auth page with a warning.
 *
 * NOTE: The `storage` event only fires in tabs OTHER than the one that made
 * the change — so the newly-logged-in tab is never affected.
 */
export default function useSessionGuard() {
  const initialUserIdRef = useRef(null);

  useEffect(() => {
    // Capture the current user's identity when the layout first mounts
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        initialUserIdRef.current = parsed.user_id || parsed.id || null;
      }
    } catch (_) {
      /* ignore parse errors */
    }

    const handleStorageChange = (e) => {
      // Only react to auth-related key changes
      if (e.key !== 'token' && e.key !== 'user') return;

      let newUserId = null;
      try {
        const newUser = localStorage.getItem('user');
        if (newUser) {
          const parsed = JSON.parse(newUser);
          newUserId = parsed.user_id || parsed.id || null;
        }
      } catch (_) {
        /* ignore */
      }

      // If the stored user changed (or was removed), this tab's session is stale
      if (newUserId !== initialUserIdRef.current) {
        // Do NOT clear localStorage — the other tab's session is the valid one.
        alert(
          'You have been signed out because another account logged in from a different tab.'
        );
        window.location.href = '/';
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}
