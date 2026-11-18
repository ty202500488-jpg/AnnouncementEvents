import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const API_BASE = 'http://localhost:5000';

export function getDashboardPathForRole(roleName) {
  const norm = String(roleName || '').toLowerCase();
  if (norm === 'admin') return '/admin/dashboard';
  if (norm === 'staff') return '/staff/dashboard';
  return '/student/dashboard';
}

export async function performSecureLogout() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      await fetch(`${API_BASE}/api/users/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
    } catch (_) {
      /* best-effort token revocation */
    }
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('pendingEmail');
  sessionStorage.removeItem('pendingEmail');
}

export function ProtectedRoute({ allowedRoles = [], children }) {
  const location = useLocation();
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    role: null
  });

  useEffect(() => {
    let isMounted = true;
    const verifyBackendSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (isMounted) {
          setAuthState({ loading: false, authenticated: false, role: null });
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (isMounted) {
            setAuthState({ loading: false, authenticated: false, role: null });
          }
          return;
        }

        const data = await res.json();
        const backendUser = data?.user;
        const authoritativeRole = String(
          backendUser?.role_name || backendUser?.role || ''
        ).toLowerCase();

        if (!backendUser || !authoritativeRole) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (isMounted) {
            setAuthState({ loading: false, authenticated: false, role: null });
          }
          return;
        }

        // Overwrite any tampered localStorage values with the authoritative backend identity
        try {
          const existingRaw = localStorage.getItem('user');
          const existing = existingRaw ? JSON.parse(existingRaw) : {};
          const syncedUser = {
            ...existing,
            ...backendUser,
            id: backendUser.user_id || backendUser.id,
            user_id: backendUser.user_id || backendUser.id,
            role: authoritativeRole,
            role_name: authoritativeRole
          };
          localStorage.setItem('user', JSON.stringify(syncedUser));
        } catch (_) {
          localStorage.setItem('user', JSON.stringify(backendUser));
        }

        if (isMounted) {
          setAuthState({
            loading: false,
            authenticated: true,
            role: authoritativeRole
          });
        }
      } catch (_) {
        // Fallback if backend is temporarily unreachable during initial paint:
        // still never allow missing token or unparsed user
        try {
          const storedRaw = localStorage.getItem('user');
          const stored = storedRaw ? JSON.parse(storedRaw) : null;
          const fallbackRole = String(stored?.role_name || stored?.role || '').toLowerCase();
          if (stored && fallbackRole && isMounted) {
            setAuthState({
              loading: false,
              authenticated: true,
              role: fallbackRole
            });
            return;
          }
        } catch (_) {}

        if (isMounted) {
          setAuthState({ loading: false, authenticated: false, role: null });
        }
      }
    };

    verifyBackendSession();
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600 text-sm font-medium">
          <div className="w-5 h-5 border-2 border-red-800 border-t-transparent rounded-full animate-spin" />
          <span>Verifying session security...</span>
        </div>
      </div>
    );
  }

  if (!authState.authenticated) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase());
  if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(authState.role)) {
    return <Navigate to={getDashboardPathForRole(authState.role)} replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const [checkState, setCheckState] = useState({
    loading: true,
    authenticated: false,
    role: null
  });

  useEffect(() => {
    let isMounted = true;
    const checkExistingSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (isMounted) {
          setCheckState({ loading: false, authenticated: false, role: null });
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (isMounted) {
            setCheckState({ loading: false, authenticated: false, role: null });
          }
          return;
        }
        const data = await res.json();
        const role = String(data?.user?.role_name || data?.user?.role || '').toLowerCase();
        if (role && isMounted) {
          setCheckState({ loading: false, authenticated: true, role });
          return;
        }
      } catch (_) {}

      if (isMounted) {
        setCheckState({ loading: false, authenticated: false, role: null });
      }
    };

    checkExistingSession();
    return () => {
      isMounted = false;
    };
  }, []);

  if (checkState.loading) {
    return null;
  }

  if (checkState.authenticated && checkState.role) {
    return <Navigate to={getDashboardPathForRole(checkState.role)} replace />;
  }

  return children;
}

export default ProtectedRoute;
