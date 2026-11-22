import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatPostTimestamp } from '../../utils/dateUtils';

export function RegistrationSubmissionPreview({ submissionData, requirements = [] }) {
  const entries = submissionData && typeof submissionData === 'object' ? Object.values(submissionData) : [];
  const [zoomedImage, setZoomedImage] = useState(null);

  if (entries.length === 0) {
    return (
      <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.8125rem' }}>
        {requirements.length > 0
          ? 'No requirement answers attached to this registration.'
          : 'No extra registration requirements were configured for this event.'}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {entries.map((entry, idx) => {
          const key = entry.id || idx;
          if (entry.fieldType === 'image') {
            return (
              <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: '0.625rem', padding: '0.75rem', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {entry.label || key}
                  </span>
                  {entry.source === 'profile' && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#047857', backgroundColor: '#d1fae5', padding: '0.12rem 0.45rem', borderRadius: '9999px' }}>
                      From Student Profile
                    </span>
                  )}
                </div>
                <div
                  onClick={() => setZoomedImage({ src: entry.value, label: entry.label || key })}
                  style={{
                    cursor: 'zoom-in',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '0.5rem',
                    maxHeight: '190px',
                  }}
                  title="Click to enlarge"
                >
                  <img src={entry.value} alt={entry.label || 'Requirement'} style={{ maxHeight: '170px', width: 'auto', maxWidth: '100%', objectFit: 'contain', borderRadius: '0.25rem' }} />
                </div>
              </div>
            );
          }

          return (
            <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: '0.625rem', padding: '0.75rem', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {entry.label || key}
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginTop: '0.25rem', wordBreak: 'break-word' }}>
                {entry.value || '—'}
              </div>
            </div>
          );
        })}
      </div>

      {zoomedImage && createPortal(
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1450,
            padding: '1.5rem',
          }}
        >
          <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
            {zoomedImage.label}
          </div>
          <img
            src={zoomedImage.src}
            alt={zoomedImage.label}
            style={{ maxWidth: '92vw', maxHeight: '82vh', borderRadius: '0.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
          />
          <button
            type="button"
            onClick={() => setZoomedImage(null)}
            style={{
              marginTop: '1rem',
              padding: '0.45rem 1rem',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(255,255,255,0.12)',
              color: '#ffffff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close Preview
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

export default function EventRegistrationsManagerModal({ event, onClose, onUpdated }) {
  const eventId = event?.id || event?.post_id || event?.event_id;
  const [statusTab, setStatusTab] = useState(
    String(event?.registration_mode || '').toLowerCase() === 'manual_approval' || (event?.pending_registration_count || 0) > 0
      ? 'pending'
      : 'all'
  );
  const [search, setSearch] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [eventMeta, setEventMeta] = useState(event);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inspectReg, setInspectReg] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Reject / Remove reason prompt state
  const [reasonModal, setReasonModal] = useState(null); // { reg, action: 'reject' | 'remove' }
  const [reasonText, setReasonText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  }, [onUpdated]);

  const loadRegistrations = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        status: statusTab,
        search: search.trim(),
        limit: '100',
      });
      const res = await fetch(`http://localhost:5000/api/mypage/registrations/events/${eventId}/students?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Failed to load registrations.');
        setRegistrations([]);
        return;
      }
      setRegistrations(data.registrations || []);
      if (data.event) {
        setEventMeta(data.event);
        onUpdatedRef.current?.(eventId, {
          registered_count: data.event.accepted_count ?? 0,
          pending_registration_count: data.event.pending_count ?? 0,
        });
      }
      setInspectReg((prev) => {
        if (!prev) return null;
        return (data.registrations || []).find((r) => r.id === prev.id) || null;
      });
    } catch {
      setError('Network error while loading registrations.');
    } finally {
      setLoading(false);
    }
  }, [eventId, statusTab, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusTab, search]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  if (!event) return null;

  const handleStatusChange = async (reg, action, reason = '') => {
    if (!reg || actionLoading) return;
    if ((action === 'reject' || action === 'remove') && !reason.trim()) {
      setError('Please enter a reason before rejecting or removing a registration.');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:5000/api/mypage/registrations/events/${eventId}/students/${reg.id}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action, reason: reason.trim() }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Failed to update registration status.');
        return;
      }
      setReasonModal(null);
      setReasonText('');
      await loadRegistrations();
    } catch {
      setError('Network error while updating registration.');
    } finally {
      setActionLoading(false);
    }
  };

  const acceptedCount = eventMeta?.accepted_count ?? eventMeta?.registered_count ?? 0;
  const pendingCount = eventMeta?.pending_count ?? eventMeta?.pending_registration_count ?? 0;
  const rejectedCount = eventMeta?.rejected_count ?? 0;
  const capacity = eventMeta?.capacity || eventMeta?.max_capacity;
  const regMode = String(eventMeta?.registration_mode || 'first_come').toLowerCase();

  const totalPages = Math.max(1, Math.ceil(registrations.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedRegistrations = registrations.slice(startIndex, startIndex + PAGE_SIZE);

  const getBadgeStyle = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return { label: 'Pending', bg: '#fef3c7', color: '#b45309' };
    if (s === 'rejected') return { label: 'Rejected', bg: '#ffe4e6', color: '#be123c' };
    if (s === 'cancelled') return { label: 'Cancelled', bg: '#f1f5f9', color: '#64748b' };
    return { label: 'Accepted', bg: '#d1fae5', color: '#047857' };
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: '1rem',
      }}
      onClick={() => !actionLoading && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '1040px',
          height: 'min(85vh, 680px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', backgroundColor: '#ffffff' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Registrations
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {eventMeta?.title || event?.title || event?.event_title}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '9999px', backgroundColor: regMode === 'manual_approval' ? '#fef3c7' : '#d1fae5', color: regMode === 'manual_approval' ? '#b45309' : '#047857', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {regMode === 'manual_approval' ? 'Manual Approval' : 'First Come, First Serve'}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>
              {acceptedCount} / {capacity || 'Unlimited'} Slots
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{ width: '2rem', height: '2rem', borderRadius: '9999px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.25rem' }}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Filter Tabs + Search */}
        <div style={{ padding: '0.65rem 1.25rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem', borderRadius: '0.625rem', backgroundColor: '#e2e8f0', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: `Pending (${pendingCount})` },
              { id: 'registered', label: `Accepted (${acceptedCount})` },
              { id: 'rejected', label: `Rejected (${rejectedCount})` },
            ].map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.45rem',
                    border: 'none',
                    backgroundColor: active ? '#7B0D1E' : 'transparent',
                    color: active ? '#ffffff' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '280px' }}>
            <i
              className="fa-solid fa-magnifying-glass"
              style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.78rem', pointerEvents: 'none' }}
            ></i>
            <input
              type="search"
              placeholder="Search student name, ID, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.42rem 0.75rem 0.42rem 2.1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.8125rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {error && (
          <div style={{ margin: '0.75rem 1.25rem 0', padding: '0.65rem 0.875rem', borderRadius: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8125rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Table Body */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#7B0D1E', marginRight: '0.5rem' }}></i>
              Loading registrations...
            </div>
          ) : registrations.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              No registrations found in this tab.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
              <thead>
                <tr style={{ backgroundColor: '#7B0D1E', color: '#ffffff', textAlign: 'left', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Student Information</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Email Address</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Program / College</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Submitted</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRegistrations.map((reg) => {
                  const badge = getBadgeStyle(reg.status);
                  const normStatus = String(reg.status || '').toLowerCase();
                  return (
                    <tr
                      key={reg.id}
                      style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}
                    >
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                        #{reg.id}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>{reg.student_name}</div>
                        {reg.student_id && reg.student_id !== 'N/A' && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>{reg.student_id}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8125rem', color: '#475569' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <i className="fa-regular fa-envelope" style={{ color: '#94a3b8', fontSize: '0.8rem' }}></i>
                          <span>{reg.email || '—'}</span>
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#334155' }}>
                        <div>{reg.program}{reg.year_level ? ` (${reg.year_level})` : ''}</div>
                        {reg.college && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.1rem' }}>{reg.college}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatPostTimestamp(reg.registered_at)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', backgroundColor: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.45rem',
                            borderRadius: '9999px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setInspectReg(reg)}
                            title="View submitted requirements"
                            style={{
                              width: '1.85rem',
                              height: '1.85rem',
                              borderRadius: '9999px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.85rem',
                            }}
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>

                          {normStatus === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleStatusChange(reg, 'approve')}
                                title="Approve registration"
                                style={{
                                  width: '1.85rem',
                                  height: '1.85rem',
                                  borderRadius: '9999px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  color: '#059669',
                                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.9rem',
                                }}
                              >
                                <i className="fa-solid fa-circle-check"></i>
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => { setReasonModal({ reg, action: 'reject' }); setReasonText(''); }}
                                title="Reject registration"
                                style={{
                                  width: '1.85rem',
                                  height: '1.85rem',
                                  borderRadius: '9999px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  color: '#e11d48',
                                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.9rem',
                                }}
                              >
                                <i className="fa-solid fa-circle-xmark"></i>
                              </button>
                            </>
                          )}

                          {normStatus === 'registered' && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => { setReasonModal({ reg, action: 'remove' }); setReasonText(''); }}
                              title="Remove registration"
                              style={{
                                width: '1.85rem',
                                height: '1.85rem',
                                borderRadius: '9999px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#e11d48',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.85rem',
                              }}
                            >
                              <i className="fa-solid fa-ban"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && registrations.length > 0 && (
          <div
            style={{
              padding: '0.65rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
              Showing <strong style={{ color: '#0f172a' }}>{startIndex + 1}</strong>–
              <strong style={{ color: '#0f172a' }}>{Math.min(startIndex + PAGE_SIZE, registrations.length)}</strong> of{' '}
              <strong style={{ color: '#0f172a' }}>{registrations.length}</strong>
            </span>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '0.32rem 0.65rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: safePage <= 1 ? '#94a3b8' : '#334155',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isActive = pageNum === safePage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      minWidth: '1.85rem',
                      padding: '0.32rem 0.5rem',
                      borderRadius: '0.4rem',
                      border: isActive ? '1px solid #7B0D1E' : '1px solid #cbd5e1',
                      backgroundColor: isActive ? '#7B0D1E' : '#ffffff',
                      color: isActive ? '#ffffff' : '#334155',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '0.32rem 0.65rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: safePage >= totalPages ? '#94a3b8' : '#334155',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Requirement Inspection Modal */}
      {inspectReg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1350,
            padding: '1rem',
          }}
          onClick={() => setInspectReg(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(15, 23, 42, 0.25)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', backgroundColor: '#fafafa' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{inspectReg.student_name}</h4>
                  {(() => {
                    const selBadge = getBadgeStyle(inspectReg.status);
                    return (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px', backgroundColor: selBadge.bg, color: selBadge.color }}>
                        {selBadge.label}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>{inspectReg.email}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                  {inspectReg.college} • {inspectReg.program} ({inspectReg.year_level})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectReg(null)}
                style={{ width: '2rem', height: '2rem', borderRadius: '9999px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                aria-label="Close details"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '1.15rem 1.25rem 1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {inspectReg.rejection_reason && (
                <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', fontSize: '0.8125rem' }}>
                  <strong>Decline / Removal Reason:</strong> {inspectReg.rejection_reason}
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                  Submitted Requirements
                </div>
                <RegistrationSubmissionPreview
                  submissionData={inspectReg.submission_data}
                  requirements={eventMeta?.registration_requirements || []}
                />
              </div>

              {(String(inspectReg.status).toLowerCase() === 'pending' || String(inspectReg.status).toLowerCase() === 'registered') && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                  {String(inspectReg.status).toLowerCase() === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange(inspectReg, 'approve')}
                        style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#059669', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-check" style={{ marginRight: '0.35rem' }}></i>
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => { setReasonModal({ reg: inspectReg, action: 'reject' }); setReasonText(''); }}
                        style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#e11d48', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-xmark" style={{ marginRight: '0.35rem' }}></i>
                        Reject
                      </button>
                    </>
                  )}
                  {String(inspectReg.status).toLowerCase() === 'registered' && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => { setReasonModal({ reg: inspectReg, action: 'remove' }); setReasonText(''); }}
                      style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #fecdd3', backgroundColor: '#fff1f2', color: '#be123c', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-user-minus" style={{ marginRight: '0.35rem' }}></i>
                      Remove Registration
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject / Remove Reason Prompt Modal */}
      {reasonModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            padding: '1rem',
          }}
          onClick={() => !actionLoading && setReasonModal(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '420px',
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              {reasonModal.action === 'remove' ? 'Remove Registration' : 'Reject Registration'}
            </h4>
            <p style={{ margin: '0 0 0.875rem 0', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
              Provide a reason for <strong>{reasonModal.reg.student_name}</strong>. This message will be sent directly to their notifications.
            </p>
            <textarea
              rows="3"
              placeholder="e.g. Uploaded proof of payment is blurry / Duplicate registration..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setReasonModal(null)}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !reasonText.trim()}
                onClick={() => handleStatusChange(reasonModal.reg, reasonModal.action, reasonText)}
                style={{
                  padding: '0.5rem 1.1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: '#e11d48',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: actionLoading || !reasonText.trim() ? 'not-allowed' : 'pointer',
                  opacity: actionLoading || !reasonText.trim() ? 0.6 : 1,
                }}
              >
                {actionLoading ? 'Sending...' : 'Confirm & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
