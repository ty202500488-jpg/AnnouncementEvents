import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Reusable Searchable User Selector for Admin Workflows
 * (e.g., Granting Staff Access in UserManagement & Assigning Page Staff in PageManagement)
 *
 * Features:
 * - Live debounced search (300ms) querying /api/admin/users + instant local filtering
 * - Displays user full name, WMSU email, Student ID (if any), and role badge
 * - Clear Selected User indicator card with ability to clear/change selection
 * - Loading state & No-results state
 * - Prevents duplicate assignments via excludeUserIds
 */
const SearchableUserSelect = ({
  users = [],
  value = '',
  onChange,
  excludeUserIds = [],
  label = 'Select User',
  placeholder = 'Search by name, WMSU email, or ID...',
  required = false,
  disabled = false
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const excludedSet = useMemo(
    () => new Set((excludeUserIds || []).map((id) => String(id))),
    [excludeUserIds]
  );

  // Combine initial users list with any remotely searched users
  const mergedUsers = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      if (u && u.id !== undefined) map.set(String(u.id), u);
    }
    for (const u of remoteUsers) {
      if (u && u.id !== undefined && !map.has(String(u.id))) {
        map.set(String(u.id), u);
      }
    }
    return Array.from(map.values());
  }, [users, remoteUsers]);

  const selectedUser = useMemo(() => {
    if (!value) return null;
    return mergedUsers.find((u) => String(u.id) === String(value)) || null;
  }, [mergedUsers, value]);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Live backend search when administrator types a query
  useEffect(() => {
    if (!debouncedQuery) {
      setRemoteUsers([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    fetch(`/api/admin/users?tab=all&search=${encodeURIComponent(debouncedQuery)}&limit=20`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: controller.signal
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          setRemoteUsers(data.users);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('User search error:', err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Filtered matching users
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mergedUsers.slice(0, 30);
    return mergedUsers
      .filter((u) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''} ${u.full_name || ''}`.toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const studentId = String(u.student_id || '').toLowerCase();
        const role = String(u.role_name || u.role || '').toLowerCase();
        return (
          fullName.includes(q) ||
          email.includes(q) ||
          studentId.includes(q) ||
          role.includes(q)
        );
      })
      .slice(0, 30);
  }, [mergedUsers, query]);

  const handleSelect = (user) => {
    if (excludedSet.has(String(user.id))) return;
    if (onChange) onChange(String(user.id), user);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    if (onChange) onChange('', null);
    setQuery('');
    setIsOpen(true);
  };

  return (
    <div className="admin-user-select-wrap" ref={containerRef}>
      {label && (
        <label className="admin-user-select-label">
          {label} {required && <span className="required-star">*</span>}
        </label>
      )}

      {selectedUser ? (
        <div className="admin-user-selected-card">
          <div className="admin-user-selected-avatar">
            {(selectedUser.first_name?.[0] || selectedUser.full_name?.[0] || 'U').toUpperCase()}
          </div>
          <div className="admin-user-selected-info">
            <div className="admin-user-selected-name">
              {selectedUser.first_name
                ? `${selectedUser.first_name} ${selectedUser.last_name || ''}`
                : selectedUser.full_name}
              {(selectedUser.role_name || selectedUser.role) && (
                <span className="admin-user-role-pill">
                  {selectedUser.role_name || selectedUser.role}
                </span>
              )}
            </div>
            <div className="admin-user-selected-meta">
              <span>{selectedUser.email}</span>
              {selectedUser.student_id && <span> • ID: {selectedUser.student_id}</span>}
            </div>
          </div>
          <button
            type="button"
            className="admin-user-clear-btn"
            onClick={handleClear}
            disabled={disabled}
            title="Change selected user"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="admin-user-search-box">
          <i className="fa-solid fa-magnifying-glass admin-user-search-icon"></i>
          <input
            type="text"
            className="admin-user-search-input"
            placeholder={placeholder}
            value={query}
            disabled={disabled}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            aria-label={label}
          />
          {query && (
            <button
              type="button"
              className="admin-user-input-clear"
              onClick={() => setQuery('')}
              aria-label="Clear user search"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      )}

      {/* Hidden input for native form required validation */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1, pointerEvents: 'none' }}
        />
      )}

      {isOpen && !selectedUser && (
        <div className="admin-user-dropdown-list" role="listbox">
          {loading && (
            <div className="admin-user-dropdown-status">
              <i className="fa-solid fa-spinner fa-spin"></i> Searching users...
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="admin-user-dropdown-status">
              No matching eligible users found.
            </div>
          )}

          {filteredUsers.map((u) => {
            const isExcluded = excludedSet.has(String(u.id));
            const displayName = u.first_name
              ? `${u.first_name} ${u.last_name || ''}`
              : u.full_name || 'User';
            return (
              <button
                key={u.id}
                type="button"
                role="option"
                disabled={isExcluded}
                className={`admin-user-dropdown-item ${isExcluded ? 'is-disabled' : ''}`}
                onClick={() => handleSelect(u)}
              >
                <div className="admin-user-item-main">
                  <span className="admin-user-item-name">{displayName}</span>
                  <span className="admin-user-item-sub">
                    {u.email}
                    {u.student_id ? ` • ID: ${u.student_id}` : ''}
                  </span>
                </div>
                <div className="admin-user-item-badges">
                  {isExcluded ? (
                    <span className="admin-user-assigned-badge">Already Assigned</span>
                  ) : (
                    (u.role_name || u.role) && (
                      <span className="admin-user-role-pill">{u.role_name || u.role}</span>
                    )
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchableUserSelect;
