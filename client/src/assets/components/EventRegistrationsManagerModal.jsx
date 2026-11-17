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
              <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: '0.625rem', padding: '0.75rem', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>{entry.label || key}</span>
                  {entry.source === 'profile' && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#047857', backgroundColor: '#d1fae5', padding: '0.12rem 0.45rem', borderRadius: '9999px' }}>
                      From Student Profile
                    </span>
                  )}
                </div>
                <div
                  onClick={() => setZoomedImage({ src: entry.value, label: entry.label || key })}
                  style={{ cursor: 'zoom-in', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'center', maxHeight: '180px' }}
                  title="Click to enlarge"
                >
                  <img src={entry.value} alt={entry.label || 'Requirement'} style={{ maxHeight: '180px', width: 'auto', objectFit: 'contain' }} />
                </div>
              </div>
            );
          }

          return (
            <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: '0.625rem', padding: '0.65rem 0.75rem', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {entry.label || key}
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginTop: '0.2rem', wordBreak: 'break-word' }}>
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
  const [selectedReg, setSelectedReg] = useState(null);

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
      setSelectedReg((prev) => {
        if (!prev) return (data.registrations || [])[0] || null;
        return (data.registrations || []).find((r) => r.id === prev.id) || (data.registrations || [])[0] || null;
      });
    } catch {
      setError('Network error while loading registrations.');
    } finally {
      setLoading(false);
    }
  }, [eventId, statusTab, search]);

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
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', backgroundColor: '#fafafa' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: regMode === 'manual_approval' ? '#fef3c7' : '#d1fae5', color: regMode === 'manual_approval' ? '#b45309' : '#047857', textTransform: 'uppercase' }}>
                {regMode === 'manual_approval' ? 'Manual Approval' : 'First Come, First Serve'}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                Slots: {acceptedCount} / {capacity || 'Unlimited'}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Registrations — {eventMeta?.title || event?.title || event?.event_title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: '2rem', height: '2rem', borderRadius: '9999px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Filter Tabs + Search */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
            {[
              { id: 'pending', label: `Pending (${pendingCount})` },
              { id: 'registered', label: `Accepted (${acceptedCount})` },
              { id: 'rejected', label: `Rejected (${rejectedCount})` },
              { id: 'all', label: 'All' },
            ].map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '9999px',
                    border: active ? '1px solid #881337' : '1px solid #e2e8f0',
                    backgroundColor: active ? '#881337' : '#ffffff',
                    color: active ? '#ffffff' : '#334155',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <input
            type="search"
            placeholder="Search student name, ID, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem', minWidth: '220px' }}
          />
        </div>

        {error && (
          <div style={{ margin: '0.75rem 1.25rem 0', padding: '0.65rem 0.875rem', borderRadius: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8125rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Split Body: Left List + Right Requirement Submission Detail */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(300px, 1.2fr)', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Registrant List */}
          <div style={{ borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '0.75rem' }}>
            {loading ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#881337', marginRight: '0.5rem' }}></i>
                Loading registrations...
              </div>
            ) : registrations.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No registrations found in this tab.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {registrations.map((reg) => {
                  const badge = getBadgeStyle(reg.status);
                  const isSelected = selectedReg?.id === reg.id;
                  return (
                    <div
                      key={reg.id}
                      onClick={() => setSelectedReg(reg)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.75rem',
                        border: isSelected ? '1.5px solid #881337' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#fff1f2' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {reg.student_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                            {reg.student_id !== 'N/A' ? `${reg.student_id} • ` : ''}{reg.program} ({reg.year_level})
                          </div>
                        </div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: badge.bg, color: badge.color, flexShrink: 0 }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                        Submitted {formatPostTimestamp(reg.registered_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Submission Inspection & Actions */}
          <div style={{ overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!selectedReg ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                Select a registration on the left to inspect submitted requirements.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{selectedReg.student_name}</h4>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>{selectedReg.email}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                      {selectedReg.college} • {selectedReg.program} ({selectedReg.year_level})
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {String(selectedReg.status).toLowerCase() === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleStatusChange(selectedReg, 'approve')}
                          style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#059669', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <i className="fa-solid fa-check" style={{ marginRight: '0.35rem' }}></i>
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => { setReasonModal({ reg: selectedReg, action: 'reject' }); setReasonText(''); }}
                          style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#e11d48', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <i className="fa-solid fa-xmark" style={{ marginRight: '0.35rem' }}></i>
                          Reject
                        </button>
                      </>
                    )}
                    {String(selectedReg.status).toLowerCase() === 'registered' && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => { setReasonModal({ reg: selectedReg, action: 'remove' }); setReasonText(''); }}
                        style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #fecdd3', backgroundColor: '#fff1f2', color: '#be123c', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-user-minus" style={{ marginRight: '0.35rem' }}></i>
                        Remove Registration
                      </button>
                    )}
                  </div>
                </div>

                {selectedReg.rejection_reason && (
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', fontSize: '0.8125rem' }}>
                    <strong>Decline / Removal Reason:</strong> {selectedReg.rejection_reason}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                    Submitted Requirements
                  </div>
                  <RegistrationSubmissionPreview
                    submissionData={selectedReg.submission_data}
                    requirements={eventMeta?.registration_requirements || []}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
