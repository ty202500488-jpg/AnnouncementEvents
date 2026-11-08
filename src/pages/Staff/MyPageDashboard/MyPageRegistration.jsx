import { useState, useEffect, useCallback } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';

export default function MyPageRegistration({ onSwitchToStaffDashboard }) {
  // Stats & Event Options State
  const [summary, setSummary] = useState({ total_registrations: 0, total_events_with_registrations: 0 });
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  // Table & Registrants Data State
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState({ totalPages: 1, totalRecords: 0 });

  // Detail Inspection Modal
  const [selectedRegistrant, setSelectedRegistrant] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Authentication Headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  };

  // 1. Fetch Summary Totals
  const fetchSummary = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/mypage/registrations/summary', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to load summary stats:', err);
    }
  };

  // 2. Fetch Accessible Events Dropdown
  const fetchEvents = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/mypage/registrations/events', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const eventList = data.events || [];
        setEvents(eventList);
        if (eventList.length > 0 && !selectedEventId) {
          setSelectedEventId(eventList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError('Unable to fetch accessible event list.');
    }
  };

  // 3. Fetch Registrants for Selected Event with Search & Pagination
  const fetchRegistrations = useCallback(async () => {
    if (!selectedEventId) {
      setLoading(false);
      setRegistrations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        search: searchTerm,
        status: statusFilter,
        page: currentPage,
        limit: 10
      });

      const res = await fetch(`http://localhost:5000/api/mypage/registrations/events/${selectedEventId}/students?${params}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to fetch student registrations.');
      }

      const data = await res.json();
      setRegistrations(data.registrations || []);
      setPaginationInfo(data.pagination || { totalPages: 1, totalRecords: 0 });
    } catch (err) {
      setError(err.message);
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, searchTerm, statusFilter, currentPage]);

  useEffect(() => {
    fetchSummary();
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Load Single Registration Details
  const handleViewDetails = async (registrationId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/mypage/registrations/events/${selectedEventId}/students/${registrationId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRegistrant(data);
      }
    } catch (err) {
      console.error('Failed to load detail modal:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // CSV Export
  const handleExportCSV = async () => {
    if (!selectedEventId) return;

    try {
      const response = await fetch(`http://localhost:5000/api/mypage/registrations/events/${selectedEventId}/export`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event_${selectedEventId}_registrations.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Failed to export CSV: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (String(status).toLowerCase()) {
      case 'cancelled':
        return { label: 'Cancelled', bg: 'var(--rose-100, #ffe4e6)', color: 'var(--rose-600, #e11d48)', icon: 'fa-circle-xmark' };
      case 'registered':
      default:
        return { label: 'Registered', bg: 'var(--emerald-100, #d1fae5)', color: 'var(--emerald-700, #047857)', icon: 'fa-circle-check' };
    }
  };

  return (
    <MyPageDashboardLayout activeTab="registrations" onSwitchToStaffDashboard={onSwitchToStaffDashboard}>
      <main className="lg-col-6 space-y-6">
        
        {/* PAGE HEADER & SUMMARY STATS CARD */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                Event Registrations
              </h1>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                View and manage students registered for your events.
              </p>
            </div>

            <button
              type="button"
              className="btn-nav"
              disabled={!selectedEventId || registrations.length === 0}
              onClick={handleExportCSV}
              style={{
                opacity: selectedEventId && registrations.length > 0 ? 1 : 0.6,
                cursor: selectedEventId && registrations.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              <i className="fa-solid fa-file-csv" style={{ marginRight: '0.5rem' }}></i> Export CSV
            </button>
          </div>

          {/* SUMMARY STATS GRID */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--slate-100)'
            }}
          >
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--slate-50)', borderRadius: '0.5rem', border: '1px solid var(--slate-100)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 500 }}>Total Scope Registrations</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                {summary.total_registrations}
              </div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--slate-50)', borderRadius: '0.5rem', border: '1px solid var(--slate-100)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 500 }}>Events With Registrations</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                {summary.total_events_with_registrations}
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS CARD */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            
            {/* Event Selector */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', display: 'block', marginBottom: '4px' }}>
                SELECT EVENT
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => { setSelectedEventId(e.target.value); setCurrentPage(1); }}
                className="search-input"
                style={{ padding: '0.45rem 0.6rem', borderRadius: '0.5rem', backgroundColor: 'var(--slate-50)' }}
              >
                {events.length === 0 && <option value="">No events available</option>}
                {events.map(evt => (
                  <option key={evt.id} value={evt.id}>{evt.title} ({evt.registration_count})</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', display: 'block', marginBottom: '4px' }}>
                REGISTRATION STATUS
              </label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="search-input"
                style={{ padding: '0.45rem 0.6rem', borderRadius: '0.5rem', backgroundColor: 'var(--slate-50)' }}
              >
                <option value="all">All Statuses</option>
                <option value="registered">Registered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Search Field */}
          <div className="search-wrapper">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              className="search-input"
              placeholder="Search by student name, ID, or email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        {/* REGISTRATIONS TABLE CARD */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {error && (
            <div style={{ padding: '1rem', color: 'var(--rose-600)', backgroundColor: 'var(--rose-50)', fontSize: '0.8125rem' }}>
              {error}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)', color: 'var(--slate-600)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Student</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Student ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>College / Program</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Registration Date</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-400)' }}>
                      Loading registration records...
                    </td>
                  </tr>
                ) : registrations.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-400)' }}>
                      No student registrations found for this selection.
                    </td>
                  </tr>
                ) : (
                  registrations.map((reg) => {
                    const badge = getStatusBadge(reg.status);
                    return (
                      <tr
                        key={reg.id}
                        style={{ borderBottom: '1px solid var(--slate-100)', transition: 'background-color 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--slate-50)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{reg.student_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--slate-400)' }}>{reg.email}</div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', color: 'var(--slate-600)' }}>
                          {reg.student_id || 'N/A'}
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ color: 'var(--slate-800)' }}>{reg.program || 'N/A'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--slate-400)' }}>{reg.college || ''}</div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', color: 'var(--slate-500)', fontSize: '0.75rem' }}>
                          {reg.registered_at ? new Date(reg.registered_at).toLocaleDateString() : 'N/A'}
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              backgroundColor: badge.bg,
                              color: badge.color,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            <i className={`fa-solid ${badge.icon}`} style={{ fontSize: '9px' }}></i>
                            {badge.label}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => handleViewDetails(reg.id)}
                            style={{ border: '1px solid var(--slate-200)', borderRadius: '0.375rem', padding: '0.25rem 0.625rem' }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {paginationInfo.totalPages > 1 && (
            <div
              style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--slate-200)',
                fontSize: '0.8125rem'
              }}
            >
              <span style={{ color: 'var(--slate-500)' }}>
                Page {paginationInfo.currentPage} of {paginationInfo.totalPages} ({paginationInfo.totalRecords} records)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="action-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  style={{
                    border: '1px solid var(--slate-200)',
                    padding: '0.25rem 0.625rem',
                    opacity: currentPage === 1 ? 0.5 : 1,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="action-btn"
                  disabled={currentPage === paginationInfo.totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  style={{
                    border: '1px solid var(--slate-200)',
                    padding: '0.25rem 0.625rem',
                    opacity: currentPage === paginationInfo.totalPages ? 0.5 : 1,
                    cursor: currentPage === paginationInfo.totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DETAILS MODAL */}
        {selectedRegistrant && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              className="card"
              style={{
                maxWidth: '480px',
                width: '100%',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--slate-900)' }}>
                  Registration Details
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedRegistrant(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--slate-400)', cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {detailLoading ? (
                <p style={{ color: 'var(--slate-400)', fontSize: '0.8125rem' }}>Loading details...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--slate-50)', borderRadius: '0.5rem', border: '1px solid var(--slate-100)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.975rem', color: 'var(--slate-800)' }}>
                      {selectedRegistrant.student_name}
                    </div>
                    <div style={{ color: 'var(--slate-500)', fontSize: '0.75rem', marginTop: '2px' }}>
                      ID: {selectedRegistrant.student_id || 'N/A'} • {selectedRegistrant.email}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ color: 'var(--slate-400)', display: 'block', fontSize: '11px' }}>COLLEGE</span>
                      <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}>{selectedRegistrant.college || 'N/A'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--slate-400)', display: 'block', fontSize: '11px' }}>PROGRAM & YEAR</span>
                      <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}>
                        {selectedRegistrant.program || 'N/A'} {selectedRegistrant.year_level ? `(${selectedRegistrant.year_level})` : ''}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: 'var(--slate-400)', display: 'block', fontSize: '11px' }}>EVENT</span>
                    <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{selectedRegistrant.event_title}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--slate-400)', display: 'block', fontSize: '11px' }}>REGISTRATION DATE</span>
                    <span style={{ color: 'var(--slate-700)' }}>
                      {selectedRegistrant.registered_at ? new Date(selectedRegistrant.registered_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--slate-400)', display: 'block', fontSize: '11px' }}>STATUS</span>
                    <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{selectedRegistrant.status}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </MyPageDashboardLayout>
  );
}