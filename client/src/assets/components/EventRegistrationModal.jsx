import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { normalizeEventRequirements } from './PortalShellElements';

function compressImageFile(file, maxWidth = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        if (img.width <= maxWidth && file.size <= 900 * 1024) {
          resolve(dataUrl);
          return;
        }
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function EventRegistrationModal({ event, onClose, onSuccess }) {
  const eventId = event?.id || event?.post_id || event?.event_id;
  const rawRequirements = event?.registration_requirements;
  const requirements = useMemo(
    () => normalizeEventRequirements(rawRequirements),
    [rawRequirements]
  );
  const registrationMode =
    String(event?.registration_mode || 'first_come').toLowerCase() === 'manual_approval'
      ? 'manual_approval'
      : 'first_come';
  const capacity = event?.max_capacity || event?.capacity;
  const registeredCount = event?.registered_count ?? event?.current_registered ?? 0;

  const [prefill, setPrefill] = useState(null);
  const [loadingPrefill, setLoadingPrefill] = useState(() => Boolean(localStorage.getItem('token') && eventId));
  const [values, setValues] = useState({});
  const [useProfileImage, setUseProfileImage] = useState({ student_id: false, cor: false });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!eventId || !token) return;
    let active = true;

    (async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/users/events/${eventId}/registration-prefill`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        const pf = data.prefill || {};
        setPrefill(pf);

        const initialValues = {};
        const initialProfileToggles = { student_id: false, cor: false };

        for (const req of requirements) {
          if (req.id === 'full_name') {
            initialValues[req.id] = pf.full_name || '';
          } else if (req.id === 'school_email') {
            initialValues[req.id] = pf.email || '';
          } else if (req.id === 'course_and_year') {
            initialValues[req.id] = pf.course_and_year || '';
          } else if (req.id === 'student_id' && pf.has_saved_student_id_image) {
            initialProfileToggles.student_id = true;
          } else if (req.id === 'cor' && pf.has_saved_cor_image) {
            initialProfileToggles.cor = true;
          }
        }
        setValues(initialValues);
        setUseProfileImage(initialProfileToggles);
      } catch (err) {
        console.error('Failed to load prefill:', err);
      } finally {
        if (active) setLoadingPrefill(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [eventId, requirements]);

  if (!event) return null;

  const handleImageUpload = async (reqId, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Image must be 8MB or smaller.');
      return;
    }
    setErrorMsg('');
    try {
      const compressed = await compressImageFile(file);
      setValues((prev) => ({ ...prev, [reqId]: compressed }));
      if (reqId === 'student_id' || reqId === 'cor') {
        setUseProfileImage((prev) => ({ ...prev, [reqId]: false }));
      }
    } catch {
      setErrorMsg('Could not process selected image.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const token = localStorage.getItem('token');
    if (!token) {
      setErrorMsg('Please sign in to register.');
      return;
    }

    const submissionData = {};
    for (const req of requirements) {
      if (req.fieldType === 'image') {
        if ((req.id === 'student_id' || req.id === 'cor') && useProfileImage[req.id]) {
          submissionData[req.id] = { useProfileImage: true };
        } else if (values[req.id]) {
          submissionData[req.id] = values[req.id];
        } else {
          setErrorMsg(`Please provide: ${req.label}.`);
          return;
        }
      } else {
        const val = String(values[req.id] || '').trim();
        if (!val) {
          setErrorMsg(`Please complete: ${req.label}.`);
          return;
        }
        submissionData[req.id] = val;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/users/events/${eventId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ submission_data: submissionData }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.message || 'Failed to submit registration.');
        return;
      }
      onSuccess?.(data, eventId);
    } catch {
      setErrorMsg('Network error while submitting registration.');
    } finally {
      setSubmitting(false);
    }
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
      onClick={() => !submitting && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.24)',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            backgroundColor: '#fafafa',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '0.18rem 0.55rem',
                  borderRadius: '9999px',
                  backgroundColor: registrationMode === 'manual_approval' ? '#fef3c7' : '#d1fae5',
                  color: registrationMode === 'manual_approval' ? '#b45309' : '#047857',
                }}
              >
                {registrationMode === 'manual_approval' ? 'Requires Organizer Approval' : 'First Come, First Serve'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                <i className="fa-solid fa-users" style={{ marginRight: '0.25rem' }}></i>
                {registeredCount} / {capacity || 'Unlimited'} Slots
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#0f172a' }}>
              Register for {event.title || event.event_title}
            </h3>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '9999px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Close registration modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {event.registration_status === 'Rejected' && event.rejection_reason && (
            <div style={{ padding: '0.75rem 0.875rem', borderRadius: '0.625rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', fontSize: '0.8125rem' }}>
              <strong>Previous Decline Reason:</strong> {event.rejection_reason}
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: '0.7rem 0.875rem', borderRadius: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8125rem', fontWeight: 600 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.4rem' }}></i>
              {errorMsg}
            </div>
          )}

          {loadingPrefill ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#881337', marginRight: '0.5rem' }}></i>
              Loading your account details...
            </div>
          ) : requirements.length === 0 ? (
            <div style={{ padding: '0.875rem 1rem', borderRadius: '0.625rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
              {registrationMode === 'manual_approval'
                ? 'No extra documents are required. Click Submit Request below to send your registration for organizer approval.'
                : 'No extra documents are required. Click Confirm Registration below to reserve your slot immediately.'}
            </div>
          ) : (
            requirements.map((req) => {
              if (req.fieldType === 'image') {
                const canUseSaved =
                  (req.id === 'student_id' && prefill?.has_saved_student_id_image) ||
                  (req.id === 'cor' && prefill?.has_saved_cor_image);
                const savedUrl =
                  req.id === 'student_id' ? prefill?.student_id_image_url : prefill?.cor_image_url;
                const usingSaved = Boolean(useProfileImage[req.id]);
                const previewUrl = usingSaved ? savedUrl : values[req.id];

                return (
                  <div key={req.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.875rem', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                        {req.label} <span style={{ color: '#e11d48' }}>*</span>
                      </label>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '0.12rem 0.5rem', borderRadius: '9999px' }}>
                        Image Upload
                      </span>
                    </div>

                    {canUseSaved && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8125rem', fontWeight: 600, color: '#881337', cursor: 'pointer', marginBottom: '0.625rem' }}>
                        <input
                          type="checkbox"
                          checked={usingSaved}
                          onChange={(e) => setUseProfileImage((prev) => ({ ...prev, [req.id]: e.target.checked }))}
                          style={{ accentColor: '#881337' }}
                        />
                        <span>Use saved {req.id === 'cor' ? 'COR' : 'Student ID'} from my profile</span>
                      </label>
                    )}

                    {!usingSaved && (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(req.id, e.target.files?.[0])}
                          style={{ fontSize: '0.8125rem', color: '#334155', width: '100%' }}
                        />
                      </div>
                    )}

                    {previewUrl && (
                      <div style={{ marginTop: '0.625rem', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #cbd5e1', maxHeight: '160px', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'center' }}>
                        <img src={previewUrl} alt={req.label} style={{ maxHeight: '160px', width: 'auto', objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>
                );
              }

              const isLocked = Boolean(req.locked);
              return (
                <div key={req.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                      {req.label} <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    {isLocked && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#047857' }}>
                        <i className="fa-solid fa-lock" style={{ marginRight: '0.25rem' }}></i>
                        Auto-filled from profile
                      </span>
                    )}
                  </div>
                  <input
                    type={req.id === 'school_email' ? 'email' : 'text'}
                    value={values[req.id] || ''}
                    readOnly={isLocked}
                    required
                    placeholder={`Enter ${req.label.toLowerCase()}...`}
                    onChange={(e) => {
                      if (isLocked) return;
                      setValues((prev) => ({ ...prev, [req.id]: e.target.value }));
                    }}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: isLocked ? '#f1f5f9' : '#ffffff',
                      color: isLocked ? '#475569' : '#0f172a',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              );
            })
          )}

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingPrefill}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: '#881337',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: submitting || loadingPrefill ? 'not-allowed' : 'pointer',
                opacity: submitting || loadingPrefill ? 0.65 : 1,
              }}
            >
              {submitting
                ? 'Submitting...'
                : registrationMode === 'manual_approval'
                  ? 'Submit for Approval'
                  : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
