import { useState, useEffect, useCallback } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import { RegistrationSubmissionPreview } from '../../../assets/components/EventRegistrationsManagerModal';

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

  // Detail Inspection & Status Review Modal
  const [selectedRegistrant, setSelectedRegistrant] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reasonPrompt, setReasonPrompt] = useState(null); // { reg, action: 'reject' | 'remove' }
  const [reasonText, setReasonText] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

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

  const handleReviewStatus = async (reg, action, reason = '') => {
    if (!selectedEventId || !reg || reviewSaving) return;
    if ((action === 'reject' || action === 'remove') && !reason.trim()) {
      alert('Please provide a reason.');
      return;
    }
    setReviewSaving(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/mypage/registrations/events/${selectedEventId}/students/${reg.id}/status`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ action, reason: reason.trim() }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Failed to update registration status.');
        return;
      }
      setReasonPrompt(null);
      setReasonText('');
      setSelectedRegistrant((prev) =>
        prev && prev.id === reg.id
          ? {
              ...prev,
              status: action === 'approve' ? 'Registered' : 'Rejected',
              rejection_reason: action === 'approve' ? null : reason.trim(),
            }
          : prev
      );
      await Promise.all([fetchSummary(), fetchEvents(), fetchRegistrations()]);
    } catch {
      alert('Network error while updating registration.');
    } finally {
      setReviewSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (String(status).toLowerCase()) {
      case 'pending':
        return { label: 'Pending', bg: '#fef3c7', color: '#b45309', icon: 'fa-clock' };
      case 'rejected':
        return { label: 'Rejected', bg: '#ffe4e6', color: '#be123c', icon: 'fa-circle-xmark' };
      case 'cancelled':
        return { label: 'Cancelled', bg: '#f1f5f9', color: '#64748b', icon: 'fa-ban' };
      case 'registered':
      default:
        return { label: 'Accepted', bg: 'var(--emerald-100, #d1fae5)', color: 'var(--emerald-700, #047857)', icon: 'fa-circle-check' };
    }
  };

  return (
    <MyPageDashboardLayout activeTab="registrations" onSwitchToStaffDashboard={onSwitchToStaffDashboard}>
      <main className="lg-col-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* PAGE HEADER & SUMMARY STATS CARD */}
        <div className="card" style={{ borderRadius: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                Event Registrations
              </h1>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', margin: '4px 0 0 0' }}>
                View and manage students registered for your events.
              </p>
            </div>

            <button
              type="button"
              disabled={!selectedEventId || registrations.length === 0}
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: '#881337',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                opacity: selectedEventId && registrations.length > 0 ? 1 : 0.55,
                cursor: selectedEventId && registrations.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              <i className="fa-solid fa-file-csv"></i>
              <span>Export CSV</span>
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
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', borderRadius: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            
            {/* Event Selector */}
            <div>
              <label htmlFor="reg-event-select" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', display: 'block', marginBottom: '4px' }}>
                SELECT EVENT
              </label>
              <select
                id="reg-event-select"
                value={selectedEventId}
                onChange={(e) => { setSelectedEventId(e.target.value); setCurrentPage(1); }}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                {events.length === 0 && <option value="">No events available</option>}
                {events.map(evt => (
                  <option key={evt.id} value={evt.id}>{evt.title} ({evt.registration_count})</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="reg-status-select" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', display: 'block', marginBottom: '4px' }}>
                REGISTRATION STATUS
              </label>
              <select
                id="reg-status-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Approval</option>
                <option value="registered">Accepted / Registered</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Search Field */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', backgroundColor: '#ffffff' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: '#64748b', fontSize: '0.875rem' }}></i>
            <input
              type="text"
              placeholder="Search by student name, ID, or email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                color: '#0f172a',
                fontSize: '0.875rem',
                fontFamily: 'inherit'
              }}
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
                justifyContent: 'space-between',
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
                maxWidth: '580px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.8125rem' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--slate-50)', borderRadius: '0.5rem', border: '1px solid var(--slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.975rem', color: 'var(--slate-800)' }}>
                        {selectedRegistrant.student_name}
                      </div>
                      <div style={{ color: 'var(--slate-500)', fontSize: '0.75rem', marginTop: '2px' }}>
                        ID: {selectedRegistrant.student_id || 'N/A'} • {selectedRegistrant.email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {String(selectedRegistrant.status).toLowerCase() === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={reviewSaving}
                            onClick={() => handleReviewStatus(selectedRegistrant, 'approve')}
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '0.45rem', border: 'none', backgroundColor: '#059669', color: '#ffffff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={reviewSaving}
                            onClick={() => { setReasonPrompt({ reg: selectedRegistrant, action: 'reject' }); setReasonText(''); }}
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '0.45rem', border: 'none', backgroundColor: '#e11d48', color: '#ffffff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {String(selectedRegistrant.status).toLowerCase() === 'registered' && (
                        <button
                          type="button"
                          disabled={reviewSaving}
                          onClick={() => { setReasonPrompt({ reg: selectedRegistrant, action: 'remove' }); setReasonText(''); }}
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '0.45rem', border: '1px solid #fecdd3', backgroundColor: '#fff1f2', color: '#be123c', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          Remove Registration
                        </button>
                      )}
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ color: 'var(--slate-400)', display: 'block', fontSize: '11px' }}>REGISTRATION DATE</span>
                      <span style={{ color: 'var(--slate-700)' }}>
                        {selectedRegistrant.registered_at ? new Date(selectedRegistrant.registered_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--slate-400)', display: 'block', fontSize: '11px' }}>STATUS</span>
                      <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>{selectedRegistrant.status}</span>
                    </div>
                  </div>

                  {selectedRegistrant.rejection_reason && (
                    <div style={{ padding: '0.65rem', borderRadius: '0.5rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239' }}>
                      <strong>Decline / Removal Reason:</strong> {selectedRegistrant.rejection_reason}
                    </div>
                  )}

                  <div>
                    <span style={{ color: 'var(--slate-400)', display: 'block', fontSize: '11px', marginBottom: '0.4rem' }}>SUBMITTED REQUIREMENTS</span>
                    <RegistrationSubmissionPreview
                      submissionData={selectedRegistrant.submission_data}
                      requirements={selectedRegistrant.registration_requirements || []}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {reasonPrompt && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
            onClick={() => !reviewSaving && setReasonPrompt(null)}
          >
            <div
              style={{ backgroundColor: '#ffffff', borderRadius: '1rem', maxWidth: '420px', width: '100%', padding: '1.25rem', boxShadow: '0 20px 40px rgba(15,23,42,0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                {reasonPrompt.action === 'remove' ? 'Remove Registration' : 'Reject Registration'}
              </h4>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#475569' }}>
                Enter the reason for <strong>{reasonPrompt.reg.student_name}</strong>. It will be sent to their notifications.
              </p>
              <textarea
                rows="3"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Reason..."
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.875rem' }}>
                <button
                  type="button"
                  disabled={reviewSaving}
                  onClick={() => setReasonPrompt(null)}
                  style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reviewSaving || !reasonText.trim()}
                  onClick={() => handleReviewStatus(reasonPrompt.reg, reasonPrompt.action, reasonText)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#e11d48', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', opacity: !reasonText.trim() ? 0.6 : 1 }}
                >
                  {reviewSaving ? 'Sending...' : 'Confirm & Notify'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </MyPageDashboardLayout>
  );
}