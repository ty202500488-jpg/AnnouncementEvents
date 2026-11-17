import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EventRequirementsPicker, PostPageAvatar } from './PortalShellElements';

function getLocalDateTimeValue(hoursAhead = 0) {
  const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PostComposerModal({
  isOpen,
  onClose,
  onCreated,
  pageId,
  pageName = 'Organization Page',
  pageCode = 'WMSU',
  pageAvatarUrl = '',
  initialType = 'announcement',
}) {
  const [postType, setPostType] = useState(initialType);
  const [audience, setAudience] = useState('All Campus');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [requiresRegistration, setRequiresRegistration] = useState(true);
  const [registrationMode, setRegistrationMode] = useState('first_come');
  const [registrationRequirements, setRegistrationRequirements] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUniversityWide, setIsUniversityWide] = useState(false);
  const [spotlightExpiresAt, setSpotlightExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalPickerView, setModalPickerView] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('token');
    fetch('http://localhost:5000/api/categories', {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.categories) setCategories(data.categories);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setTitle('');
    setBody('');
    setEventDate('');
    setLocation('');
    setCapacity('');
    setRequiresRegistration(true);
    setRegistrationMode('first_come');
    setRegistrationRequirements([]);
    setCategoryId('');
    setImagePreview(null);
    setIsUniversityWide(false);
    setSpotlightExpiresAt('');
    onClose?.();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Selected image exceeds 10MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result;
      if (file.type === 'image/gif') {
        setImagePreview(rawDataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => setImagePreview(rawDataUrl);
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setImagePreview(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        setImagePreview(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || submitting) return;

    if (isUniversityWide) {
      const expMs = spotlightExpiresAt ? new Date(spotlightExpiresAt).getTime() : NaN;
      if (!spotlightExpiresAt || Number.isNaN(expMs) || expMs <= Date.now()) {
        alert('Please choose a valid future "Active Until" date and time for University-Wide Spotlight.');
        return;
      }
    }

    const token = localStorage.getItem('token');
    const spotlightPayload = {
      is_university_wide: isUniversityWide,
      expires_at: isUniversityWide && spotlightExpiresAt ? new Date(spotlightExpiresAt).toISOString() : null,
      require_approval: isUniversityWide,
    };

    setSubmitting(true);
    try {
      const endpoint =
        postType === 'event'
          ? 'http://localhost:5000/api/events'
          : 'http://localhost:5000/api/announcements';

      const payload =
        postType === 'event'
          ? {
              pageId,
              event_title: title.trim(),
              event_description: body.trim(),
              event_date: eventDate || new Date().toISOString().split('T')[0],
              location: location.trim() || 'TBD',
              capacity: capacity ? parseInt(capacity, 10) : null,
              category_id: categoryId ? parseInt(categoryId, 10) : null,
              audience,
              image_data: imagePreview || null,
              requires_registration: requiresRegistration,
              registration_mode: registrationMode,
              registration_requirements: requiresRegistration ? registrationRequirements : [],
              ...spotlightPayload,
            }
          : {
              pageId,
              title: title.trim(),
              content: body.trim(),
              description: body.trim(),
              category_id: categoryId ? parseInt(categoryId, 10) : null,
              audience,
              image_data: imagePreview || null,
              ...spotlightPayload,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Failed to publish post.');
        return;
      }

      const modStatus = data.announcement?.moderation_status || data.event?.moderation_status;
      window.dispatchEvent(new Event('spotlight:refresh'));
      onCreated?.(data, modStatus);
      resetAndClose();
    } catch {
      alert('Network error while publishing post.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={() => !submitting && resetAndClose()}
    >
      <div
        className="no-scrollbar"
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          maxWidth: '560px',
          borderRadius: '1rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {modalPickerView && (
            <button
              type="button"
              onClick={() => setModalPickerView(null)}
              aria-label="Back to Create Post"
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: 'none', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-arrow-left" style={{ fontSize: '0.9rem' }}></i>
            </button>
          )}
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', textAlign: 'center', width: '100%' }}>
            {modalPickerView === 'postType'
              ? 'Post Type'
              : modalPickerView === 'category'
                ? 'Select Category'
                : modalPickerView === 'audience'
                  ? 'Post Audience'
                  : 'Create Post'}
          </h3>
          <button
            type="button"
            disabled={submitting}
            onClick={() => { setModalPickerView(null); resetAndClose(); }}
            style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '1rem' }}></i>
          </button>
        </div>

        {modalPickerView ? (
          <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(modalPickerView === 'postType'
              ? [
                  { value: 'announcement', label: 'Announcement', desc: 'Share campus news, updates, or reminders.', icon: 'fa-solid fa-bullhorn' },
                  { value: 'event', label: 'Event', desc: 'Host an event with date, venue, and registration.', icon: 'fa-solid fa-calendar-days' },
                ]
              : modalPickerView === 'audience'
                ? [
                    { value: 'All Campus', label: 'Public', desc: 'Anyone on or off the portal can see this post.', icon: 'fa-solid fa-earth-americas' },
                    { value: 'University-Wide', label: 'University-Wide Spotlight', desc: 'Rotates in the Student & Staff Spotlight after Admin approval.', icon: 'fa-solid fa-bullhorn' },
                    { value: 'Followers Only', label: 'Followers', desc: 'Only users who follow your page can see this post.', icon: 'fa-solid fa-user-group' },
                    { value: 'Private', label: 'Private', desc: 'Only page admins and members can see this post.', icon: 'fa-solid fa-lock' },
                  ]
                : [
                    { value: '', label: 'General', desc: 'No specific category', icon: 'fa-solid fa-tag' },
                    ...categories.map((cat) => ({
                      value: String(cat.category_id),
                      label: cat.category_name,
                      desc: 'Announcement category',
                      icon: 'fa-solid fa-folder-open',
                    })),
                  ]
            ).map((opt) => {
              const currentVal =
                modalPickerView === 'postType'
                  ? postType
                  : modalPickerView === 'audience'
                    ? (isUniversityWide ? 'University-Wide' : audience)
                    : String(categoryId || '');
              const isSelected = currentVal === opt.value;
              return (
                <button
                  key={opt.value || 'general'}
                  type="button"
                  onClick={() => {
                    if (modalPickerView === 'postType') {
                      setPostType(opt.value);
                    } else if (modalPickerView === 'audience') {
                      if (opt.value === 'University-Wide') {
                        setIsUniversityWide(true);
                        setAudience('All Campus');
                        if (!spotlightExpiresAt) setSpotlightExpiresAt(getLocalDateTimeValue(24 * 7));
                      } else {
                        setIsUniversityWide(false);
                        setAudience(opt.value);
                      }
                    } else {
                      setCategoryId(opt.value);
                    }
                    setModalPickerView(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    width: '100%',
                    padding: '0.75rem 0.875rem',
                    borderRadius: '0.75rem',
                    border: `1.5px solid ${isSelected ? '#881337' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#fff1f2' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <span style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: isSelected ? '#881337' : '#f1f5f9', color: isSelected ? '#ffffff' : '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={opt.icon}></i>
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{opt.desc}</div>
                    </div>
                  </div>
                  {isSelected && <i className="fa-solid fa-circle-check" style={{ color: '#881337', fontSize: '1rem', flexShrink: 0 }}></i>}
                </button>
              );
            })}
          </div>
        ) : (
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PostPageAvatar avatarUrl={pageAvatarUrl} label={pageName} fallbackCode={pageCode} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a', marginBottom: '0.35rem' }}>
                {pageName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setModalPickerView('postType')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, color: '#881337', cursor: 'pointer' }}
                >
                  <i className={postType === 'event' ? 'fa-solid fa-calendar-days' : 'fa-solid fa-bullhorn'}></i>
                  <span>{postType === 'event' ? 'Event' : 'Announcement'}</span>
                  <i className="fa-solid fa-caret-down" style={{ fontSize: '0.7rem', color: '#64748b' }}></i>
                </button>

                {postType === 'announcement' && (
                  <button
                    type="button"
                    onClick={() => setModalPickerView('category')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-tag"></i>
                    <span>{categories.find((c) => String(c.category_id) === String(categoryId))?.category_name || 'General'}</span>
                    <i className="fa-solid fa-caret-down" style={{ fontSize: '0.7rem', color: '#64748b' }}></i>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setModalPickerView('audience')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', backgroundColor: isUniversityWide ? '#fff1f2' : '#f1f5f9', border: `1px solid ${isUniversityWide ? '#fecdd3' : '#e2e8f0'}`, borderRadius: '0.5rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: isUniversityWide ? '#881337' : '#334155', cursor: 'pointer' }}
                >
                  <i className={isUniversityWide ? 'fa-solid fa-bullhorn' : audience === 'Followers Only' ? 'fa-solid fa-user-group' : audience === 'Private' ? 'fa-solid fa-lock' : 'fa-solid fa-earth-americas'}></i>
                  <span>{isUniversityWide ? 'University-Wide Spotlight' : audience === 'Followers Only' ? 'Followers' : audience === 'Private' ? 'Private' : 'Public'}</span>
                  <i className="fa-solid fa-caret-down" style={{ fontSize: '0.7rem', color: '#64748b' }}></i>
                </button>
              </div>
            </div>
          </div>

          <input
            type="text"
            placeholder={postType === 'event' ? 'Event Title...' : 'Announcement Title...'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', fontWeight: 700, boxSizing: 'border-box' }}
          />

          {postType === 'event' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>EVENT DATE</label>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>LOCATION / VENUE</label>
                  <input type="text" placeholder="e.g. CCS Gym" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>CAPACITY</label>
                  <input type="number" placeholder="Max capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', boxSizing: 'border-box' }} />
                </div>
              </div>

              <EventRequirementsPicker
                requiresRegistration={requiresRegistration}
                onChangeRequiresRegistration={setRequiresRegistration}
                registrationMode={registrationMode}
                onChangeRegistrationMode={setRegistrationMode}
                requirements={registrationRequirements}
                onChangeRequirements={setRegistrationRequirements}
              />
            </>
          )}

          <textarea
            rows="4"
            placeholder="Write post description..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.9375rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />

          {imagePreview && (
            <div style={{ position: 'relative', width: '100%', maxHeight: '220px', overflow: 'hidden', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <img src={imagePreview} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          )}

          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#0f172a' }}>Add to your post</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.4rem 0.65rem', cursor: 'pointer', color: '#15803d', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <i className="fa-solid fa-image"></i> Photo
            </button>
          </div>

          {isUniversityWide && (
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.625rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#881337', textTransform: 'uppercase' }}>
                Spotlight Active Until (Required) *
              </label>
              <input
                type="datetime-local"
                value={spotlightExpiresAt}
                min={getLocalDateTimeValue(0)}
                onChange={(e) => setSpotlightExpiresAt(e.target.value)}
                required
                style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid #fda4af', backgroundColor: '#ffffff', fontSize: '0.8125rem', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', backgroundColor: '#881337', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting
              ? 'Publishing...'
              : isUniversityWide
                ? 'Submit University-Wide Spotlight Request'
                : !['Followers Only', 'Private'].includes(audience)
                  ? 'Submit for Admin Approval'
                  : 'Publish Post'}
          </button>
        </form>
        )}
      </div>
    </div>,
    document.body
  );
}
