import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import HiddenPostCard from '../../../assets/components/HiddenPostCard';
import {
  PostPageAvatar,
  EventPostMeta,
  EventPostActionBar,
  PostAudienceBadge,
  toggleEventRegistrationRequest,
  applyEventRegistrationUpdate,
} from '../../../assets/components/PortalShellElements';
import { formatPostTimestamp } from '../../../utils/dateUtils';
import {
  shuffleFeedItems,
  hidePostOnServer,
  unhidePostOnServer,
  hideAllFromPageOnServer,
} from '../../../utils/feedUtils';
import '../../styles/StaffDashboard.css';
import '../../styles/Profile.css';
import '../../styles/Settings.css';
import '../../styles/MyPageDashboard.css';

export default function MyPageDashboard({ onSwitchToStaffDashboard }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [feed, setFeed] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registeringEventId, setRegisteringEventId] = useState(null);

  const handleEventRegister = async (eventId, isAlreadyRegistered) => {
    setRegisteringEventId(eventId);
    try {
      const result = await toggleEventRegistrationRequest(eventId, isAlreadyRegistered);
      if (result.unauthenticated) {
        window.location.href = '/auth';
        return;
      }
      if (result.ok) {
        setFeed((prev) => applyEventRegistrationUpdate(prev, eventId, !isAlreadyRegistered));
      } else {
        alert(result.message || 'Failed to update event registration.');
      }
    } catch {
      alert('Network error while updating event registration.');
    } finally {
      setRegisteringEventId(null);
    }
  };

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postType, setPostType] = useState('announcement');
  const [audience, setAudience] = useState('All Campus');
  const [categoryId, setCategoryId] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [isUniversityWide, setIsUniversityWide] = useState(false);
  const [spotlightExpiresAt, setSpotlightExpiresAt] = useState('');
  const [modalPickerView, setModalPickerView] = useState(null); // null | 'postType' | 'category' | 'audience'
  const fileInputRef = useRef(null);

  const [editingPost, setEditingPost] = useState(null);
  const [activeMenuKey, setActiveMenuKey] = useState(null);
  const [deletingPost, setDeletingPost] = useState(null);

  const [pageName, setPageName] = useState('Student Affairs Office');
  const [pageCode, setPageCode] = useState('SAO');
  const [pageAvatarUrl, setPageAvatarUrl] = useState('');
  const [myPageId, setMyPageId] = useState(null);
  const [userName, setUserName] = useState('Staff User');
  const [togglingPageId, setTogglingPageId] = useState(null);
  const [hiddenPosts, setHiddenPosts] = useState({});
  const [hiddenPageKeys, setHiddenPageKeys] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPopoverRef = useRef(null);

  const QUICK_EMOJIS = ['📢', '🎉', '📅', '🎓', '🏆', '💡', '👏', '🔥', '✅', '📌', '❤️', '🙌'];

  const fetchPageAndFeedData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      // Fetch Feed Data
      const response = await fetch('http://localhost:5000/users/dashboard-data', {
        method: 'POST',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        const announcements = (data.announcements || []).map(a => ({ ...a, _type: 'Announcement' }));
        const events = (data.events || []).map(e => ({ ...e, _type: 'Event' }));
        setFeed(shuffleFeedItems([...announcements, ...events]));
      }

      // Fetch Categories
      const catRes = await fetch('http://localhost:5000/api/categories', { headers });
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.categories) setCategories(catData.categories);
      }

      // Fetch Page Status
      const statusRes = await fetch('http://localhost:5000/api/my-page-status', { headers });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.exists) {
          if (statusData.pageName) setPageName(statusData.pageName);
          if (statusData.pageCode) setPageCode(statusData.pageCode);
          if (statusData.profile_image || statusData.logo || statusData.image_url) {
            setPageAvatarUrl(statusData.profile_image || statusData.logo || statusData.image_url);
          }
          if (statusData.pageId || statusData.id) setMyPageId(statusData.pageId || statusData.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.first_name || parsed.firstName) {
          setUserName(parsed.first_name || parsed.firstName);
        }
      } catch (e) {
        console.error('Failed to parse user', e);
      }
    }

    fetchPageAndFeedData();

    const handleClickOutside = (e) => {
      if (emojiPopoverRef.current && !emojiPopoverRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      setActiveMenuKey(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleToggleFollow = async (pageId, currentFollowState) => {
    const token = localStorage.getItem('token');
    if (!pageId || !token) return;
    setTogglingPageId(pageId);
    const method = currentFollowState ? 'DELETE' : 'POST';
    try {
      const response = await fetch(`http://localhost:5000/api/pages/${pageId}/follow`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        setFeed(prev =>
          prev.map(item =>
            item.page_id === pageId ? { ...item, is_followed: !currentFollowState } : item
          )
        );
        fetchPageAndFeedData();
      }
    } catch (err) {
      console.error('Failed to update follow status:', err);
    } finally {
      setTogglingPageId(null);
    }
  };

  const handleHidePost = (postKey, postId) => {
    const token = localStorage.getItem('token');
    setHiddenPosts(prev => ({
      ...prev,
      [postKey]: { reason: null, dismissed: false, postId }
    }));
    hidePostOnServer(postId, token);
  };

  const handleUndoHidePost = (postKey, postId) => {
    const token = localStorage.getItem('token');
    setHiddenPosts(prev => {
      const next = { ...prev };
      delete next[postKey];
      return next;
    });
    unhidePostOnServer(postId, token);
  };

  const handleSelectHideReason = (postKey, postId, reason) => {
    const token = localStorage.getItem('token');
    setHiddenPosts(prev => ({
      ...prev,
      [postKey]: { ...(prev[postKey] || {}), reason, dismissed: false }
    }));
    hidePostOnServer(postId, token, reason);
  };

  const handleHideAllFromPage = (pageKey, pageId) => {
    const token = localStorage.getItem('token');
    if (!pageKey) return;
    setHiddenPageKeys(prev => (prev.includes(pageKey) ? prev : [...prev, pageKey]));
    if (pageId) hideAllFromPageOnServer(pageId, token);
  };

  const visibleFeed = feed.filter((item, idx) => {
    const key = `${item._type}-${item.id || idx}`;
    const pageKey = item.page_id || item.department_name || item.page_name;
    if (pageKey && hiddenPageKeys.includes(pageKey)) return false;
    return !hiddenPosts[key]?.dismissed;
  });

  const handleDeletePost = async () => {
    const token = localStorage.getItem('token');
    if (!deletingPost || !token) return;
    const isEvent = deletingPost._type === 'Event' || deletingPost.post_type === 'event';
    const deleteId = deletingPost.event_id || deletingPost.announcement_id || deletingPost.id || deletingPost.post_id;
    const deleteEndpoint = isEvent
      ? `http://localhost:5000/api/events/${deleteId}`
      : `http://localhost:5000/api/announcements/${deleteId}`;
    try {
      const res = await fetch(deleteEndpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFeed(prev =>
          prev.filter(p => {
            const pId = p.event_id || p.announcement_id || p.id || p.post_id;
            return !(pId === deleteId && p._type === deletingPost._type);
          })
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to delete post.');
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Network error while deleting post.');
    } finally {
      setDeletingPost(null);
    }
  };

  const readFileAsScaledDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const rawDataUrl = reader.result;
      if (file.type === 'image/gif') {
        resolve(rawDataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
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
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Selected image exceeds 10MB limit.');
      return;
    }
    try {
      const dataUrl = await readFileAsScaledDataUrl(file);
      setSelectedImage(file);
      setImagePreview(dataUrl);
      setRemoveExistingImage(false);
    } catch (err) {
      console.error('Failed to read image:', err);
      alert('Could not load the selected image.');
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setRemoveExistingImage(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getLocalDateTimeValue = (hoursAhead = 0) => {
    const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleToggleUniversityWide = (checked) => {
    setIsUniversityWide(checked);
    if (checked && !spotlightExpiresAt) {
      setSpotlightExpiresAt(getLocalDateTimeValue(24 * 7));
    }
  };

  const resetForm = () => {
    setQuickTitle('');
    setQuickBody('');
    setEventDate('');
    setLocation('');
    setCapacity('');
    setCategoryId('');
    setSelectedImage(null);
    setImagePreview(null);
    setRemoveExistingImage(false);
    setIsUniversityWide(false);
    setSpotlightExpiresAt('');
    setEditingPost(null);
    setModalPickerView(null);
    setIsModalOpen(false);
  };

  const handlePublishPost = async (e) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickBody.trim()) return;

    if (isUniversityWide) {
      const expMs = spotlightExpiresAt ? new Date(spotlightExpiresAt).getTime() : NaN;
      if (!spotlightExpiresAt || Number.isNaN(expMs) || expMs <= Date.now()) {
        alert('Please choose a valid future "Active Until" date and time for University-Wide Spotlight.');
        return;
      }
    }

    const spotlightPayload = {
      is_university_wide: isUniversityWide,
      expires_at: isUniversityWide && spotlightExpiresAt ? new Date(spotlightExpiresAt).toISOString() : null,
      require_approval: isUniversityWide
    };

    try {
      const token = localStorage.getItem('token');
      const headers = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      if (editingPost) {
        const isEvent = editingPost._type === 'Event';
        const endpoint = isEvent 
          ? `http://localhost:5000/api/events/${editingPost.event_id || editingPost.id}` 
          : `http://localhost:5000/api/announcements/${editingPost.announcement_id || editingPost.id}`;

        const bodyData = isEvent ? {
          event_title: quickTitle,
          event_description: quickBody,
          event_date: eventDate || new Date().toISOString().split('T')[0],
          location: location || 'TBD',
          capacity: capacity ? parseInt(capacity) : null,
          category_id: categoryId ? parseInt(categoryId) : null,
          audience,
          image_data: imagePreview || null,
          remove_image: removeExistingImage,
          ...spotlightPayload
        } : {
          title: quickTitle,
          content: quickBody,
          description: quickBody,
          category_id: categoryId ? parseInt(categoryId) : null,
          audience,
          image_data: imagePreview || null,
          remove_image: removeExistingImage,
          ...spotlightPayload
        };

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers,
          body: JSON.stringify(bodyData)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          alert(data.message || 'Failed to save changes.');
          return;
        }
        fetchPageAndFeedData();
        window.dispatchEvent(new Event('spotlight:refresh'));
        const updatedMod = data.announcement?.moderation_status || data.event?.moderation_status;
        if (String(updatedMod || '').toLowerCase() === 'pending') {
          alert('Changes saved and submitted for Admin approval before appearing publicly.');
        }
      } else {
        if (postType === 'announcement') {
          const response = await fetch('http://localhost:5000/api/announcements', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              title: quickTitle,
              content: quickBody,
              description: quickBody,
              category_id: categoryId ? parseInt(categoryId) : null,
              audience,
              image_data: imagePreview || null,
              ...spotlightPayload
            })
          });
          const data = await response.json();
          if (!response.ok) {
            alert(data.message || 'Failed to publish announcement.');
            return;
          }
          fetchPageAndFeedData();
          window.dispatchEvent(new Event('spotlight:refresh'));
          if (String(data.announcement?.moderation_status || '').toLowerCase() === 'pending') {
            alert('Your public post has been submitted for Admin approval.');
          }
        } else {
          const response = await fetch('http://localhost:5000/api/events', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              event_title: quickTitle,
              event_description: quickBody,
              event_date: eventDate || new Date().toISOString().split('T')[0],
              location: location || 'TBD',
              capacity: capacity ? parseInt(capacity) : null,
              category_id: categoryId ? parseInt(categoryId) : null,
              audience,
              image_data: imagePreview || null,
              ...spotlightPayload
            })
          });
          const data = await response.json();
          if (!response.ok) {
            alert(data.message || 'Failed to publish event.');
            return;
          }
          fetchPageAndFeedData();
          window.dispatchEvent(new Event('spotlight:refresh'));
          if (String(data.event?.moderation_status || '').toLowerCase() === 'pending') {
            alert('Your public event has been submitted for Admin approval.');
          }
        }
      }

      resetForm();
    } catch (err) {
      console.error('Failed to publish post:', err);
      alert('Network error while publishing post.');
    }
  };

  return (
    <MyPageDashboardLayout 
      activeTab={activeTab} 
      pageName={pageName}
      pageCode={pageCode}
      onTabChange={(tab) => {
        if (tab === 'profile') window.location.href = '/staff/mypage/profile';
        else if (tab === 'settings') window.location.href = '/staff/mypage/settings';
        else if (tab === 'registrations') window.location.href = '/staff/mypage/registrations';
        else setActiveTab(tab);
      }} 
      onSwitchToStaffDashboard={onSwitchToStaffDashboard}
    >
      {/* Scrollbar-Hiding Global CSS Injection */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>

      <main 
        className="lg-col-6 no-scrollbar" 
        style={{ 
          flex: 1,
          minHeight: 0,
          height: '100%',
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem', 
          paddingBottom: '2.5rem'
        }}
      >
        
        {/* Compact Horizontal Posting Composer */}
        <div className="mypage-composer" ref={emojiPopoverRef}>
          <div className="mypage-composer-row">
            <div className="mypage-composer-avatar" aria-hidden="true">
              {pageAvatarUrl ? (
                <img src={pageAvatarUrl} alt={pageName} />
              ) : (
                (pageCode || pageName.split(' ').map(w => w[0]).join('').slice(0, 3)).toUpperCase()
              )}
            </div>

            <div className="mypage-composer-input-wrap">
              <input
                type="text"
                className="mypage-composer-input"
                placeholder="What's on your mind?"
                aria-label="What's on your mind?"
                value={quickBody}
                onChange={(e) => setQuickBody(e.target.value)}
                onClick={() => {
                  if (!quickBody.trim()) {
                    setEditingPost(null);
                    setIsModalOpen(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setEditingPost(null);
                    setIsModalOpen(true);
                  }
                }}
              />

              <div className="mypage-composer-actions">
                <button
                  type="button"
                  className="mypage-composer-icon-btn"
                  onClick={() => { setEditingPost(null); setPostType('announcement'); setIsModalOpen(true); }}
                  title="Create Announcement"
                  aria-label="Create Announcement"
                  style={{ color: '#f43f5e' }}
                >
                  <i className="fa-solid fa-bullhorn"></i>
                </button>
                <button
                  type="button"
                  className="mypage-composer-icon-btn"
                  onClick={() => { setEditingPost(null); setPostType('event'); setIsModalOpen(true); }}
                  title="Create Event"
                  aria-label="Create Event"
                  style={{ color: '#f7b928' }}
                >
                  <i className="fa-solid fa-calendar-days"></i>
                </button>
                <button
                  type="button"
                  className="mypage-composer-icon-btn"
                  onClick={() => { setEditingPost(null); setIsModalOpen(true); setTimeout(() => fileInputRef.current?.click(), 100); }}
                  title="Add Photo"
                  aria-label="Add Photo"
                  style={{ color: '#45bd62' }}
                >
                  <i className="fa-solid fa-image"></i>
                </button>
                <button
                  type="button"
                  className="mypage-composer-icon-btn"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  title="Insert Emoji"
                  aria-label="Insert Emoji"
                  aria-expanded={showEmojiPicker}
                  style={{ color: '#f7b928' }}
                >
                  <i className="fa-solid fa-face-smile"></i>
                </button>
              </div>
            </div>
          </div>

          {showEmojiPicker && (
            <div className="mypage-emoji-popover" role="menu" aria-label="Quick emoji picker">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="mypage-emoji-btn"
                  onClick={() => {
                    setQuickBody((prev) => (prev ? `${prev} ${emoji}` : emoji));
                    setShowEmojiPicker(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Form */}
        {isModalOpen && createPortal(
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
            onClick={resetForm}
          >
            <div 
              className="no-scrollbar"
              style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '540px',
                borderRadius: '1rem',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
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
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', textAlign: 'center', width: '100%', margin: 0 }}>
                  {modalPickerView === 'postType'
                    ? 'Post Type'
                    : modalPickerView === 'category'
                      ? 'Select Category'
                      : modalPickerView === 'audience'
                        ? 'Post Audience'
                        : editingPost
                          ? 'Edit Post'
                          : 'Create Post'}
                </h3>
                <button 
                  type="button" 
                  onClick={resetForm}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                              setAudience('All Campus');
                              handleToggleUniversityWide(true);
                            } else {
                              setAudience(opt.value);
                              handleToggleUniversityWide(false);
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
                          <div
                            style={{
                              width: '2.25rem',
                              height: '2.25rem',
                              borderRadius: '50%',
                              backgroundColor: isSelected ? '#881337' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <i className={opt.icon} style={{ fontSize: '0.9rem' }}></i>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{opt.label}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{opt.desc}</div>
                          </div>
                        </div>
                        <span
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            border: `2px solid ${isSelected ? '#881337' : '#cbd5e1'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && (
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#881337' }} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
              <form onSubmit={handlePublishPost} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <PostPageAvatar
                    avatarUrl={pageAvatarUrl}
                    label={pageName}
                    fallbackCode={pageCode}
                  />

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.2 }}>
                      {pageName}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setModalPickerView('postType')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700, color: '#881337', cursor: 'pointer' }}
                      >
                        <i className={postType === 'event' ? 'fa-solid fa-calendar-days' : 'fa-solid fa-bullhorn'}></i>
                        <span>{postType === 'event' ? 'Event' : 'Announcement'}</span>
                        <i className="fa-solid fa-caret-down" style={{ fontSize: '0.75rem' }}></i>
                      </button>

                      {postType === 'announcement' && (
                        <button
                          type="button"
                          onClick={() => setModalPickerView('category')}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                        >
                          <i className="fa-solid fa-tag" style={{ fontSize: '0.75rem', color: '#64748b' }}></i>
                          <span>
                            {categories.find((c) => String(c.category_id) === String(categoryId))?.category_name || 'Category'}
                          </span>
                          <i className="fa-solid fa-caret-down" style={{ fontSize: '0.75rem' }}></i>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setModalPickerView('audience')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: isUniversityWide ? '#fff1f2' : '#f1f5f9', border: `1px solid ${isUniversityWide ? '#fecdd3' : '#e2e8f0'}`, borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: isUniversityWide ? '#881337' : '#334155', cursor: 'pointer' }}
                      >
                        <i
                          className={
                            isUniversityWide
                              ? 'fa-solid fa-bullhorn'
                              : audience === 'Private'
                                ? 'fa-solid fa-lock'
                                : audience === 'Followers Only'
                                  ? 'fa-solid fa-user-group'
                                  : 'fa-solid fa-earth-americas'
                          }
                          style={{ fontSize: '0.75rem', color: isUniversityWide ? '#881337' : '#64748b' }}
                        ></i>
                        <span>
                          {isUniversityWide ? 'University-Wide' : audience === 'Private' ? 'Private' : audience === 'Followers Only' ? 'Followers' : 'Public'}
                        </span>
                        <i className="fa-solid fa-caret-down" style={{ fontSize: '0.75rem' }}></i>
                      </button>
                    </div>
                  </div>
                </div>

                <input 
                  id="post-title"
                  name="title"
                  type="text" 
                  placeholder={postType === 'announcement' ? "Announcement Title..." : "Event Title..."} 
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9375rem', fontWeight: 700, outline: 'none', color: '#0f172a' }}
                  required
                />

                {postType === 'event' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div>
                      <label htmlFor="event-date" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>EVENT DATE</label>
                      <input id="event-date" name="event_date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', backgroundColor: '#ffffff' }} required />
                    </div>
                    <div>
                      <label htmlFor="event-location" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>LOCATION / VENUE</label>
                      <input id="event-location" name="location" type="text" placeholder="e.g. CCS Gym" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', backgroundColor: '#ffffff' }} />
                    </div>
                    <div>
                      <label htmlFor="event-capacity" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>CAPACITY</label>
                      <input id="event-capacity" name="capacity" type="number" placeholder="Max capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', backgroundColor: '#ffffff' }} />
                    </div>
                  </div>
                )}

                <textarea 
                  id="post-body"
                  name="content"
                  rows="4" 
                  placeholder="Write post description..." 
                  value={quickBody}
                  onChange={(e) => setQuickBody(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.9375rem', resize: 'none', outline: 'none', color: '#1e293b', fontFamily: 'inherit', minHeight: '110px' }}
                  required
                ></textarea>

                {imagePreview && (
                  <div style={{ position: 'relative', width: '100%', maxHeight: '220px', overflow: 'hidden', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <img src={imagePreview} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      type="button" 
                      onClick={handleRemoveImage}
                      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <i className="fa-solid fa-xmark" style={{ fontSize: '14px' }}></i>
                    </button>
                  </div>
                )}

                <input id="post-image-upload" name="image" type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#334155' }}>Add to your post</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', padding: '0.4rem', cursor: 'pointer', color: '#10b981', fontSize: '1.1rem' }}><i className="fa-solid fa-image"></i></button>
                    <button type="button" onClick={() => setPostType(postType === 'event' ? 'announcement' : 'event')} style={{ background: 'none', border: 'none', padding: '0.4rem', cursor: 'pointer', color: '#d97706', fontSize: '1.1rem' }}><i className="fa-solid fa-calendar-days"></i></button>
                    <button type="button" onClick={() => { const loc = prompt('Enter Location:', location); if(loc !== null) setLocation(loc); }} style={{ background: 'none', border: 'none', padding: '0.4rem', cursor: 'pointer', color: '#ef4444', fontSize: '1.1rem' }}><i className="fa-solid fa-location-dot"></i></button>
                  </div>
                </div>

                {/* University-Wide Spotlight Expiration (shown when Audience is University-Wide) */}
                {isUniversityWide && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.625rem', padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <label htmlFor="spotlight-expires-at" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#881337', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Spotlight Active Until (Required) *
                      </label>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {[
                          { label: '24h', hours: 24 },
                          { label: '3 Days', hours: 72 },
                          { label: '7 Days', hours: 168 },
                          { label: '14 Days', hours: 336 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setSpotlightExpiresAt(getLocalDateTimeValue(preset.hours))}
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '9999px',
                              border: '1px solid #fda4af',
                              background: '#ffffff',
                              color: '#881337',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      id="spotlight-expires-at"
                      type="datetime-local"
                      value={spotlightExpiresAt}
                      min={getLocalDateTimeValue(0)}
                      onChange={(e) => setSpotlightExpiresAt(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '0.4rem',
                        border: '1px solid #fda4af',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: '#881337', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
                >
                  {editingPost
                    ? (isUniversityWide ? 'Save & Submit for Spotlight Approval' : 'Save Changes')
                    : isUniversityWide
                      ? 'Submit University-Wide Spotlight Request'
                      : !['Followers Only', 'Private'].includes(audience)
                        ? 'Submit for Admin Approval'
                        : 'Post'}
                </button>
              </form>
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Dynamic Feed Content */}
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading database feeds...</p>
        ) : visibleFeed.length === 0 ? (
          <article className="card" style={{ padding: '1.75rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--slate-600)' }}>No posts available yet.</p>
          </article>
        ) : (
          visibleFeed.map((item, index) => {
            const postKey = `${item._type}-${item.id || index}`;
            const isEvent = item._type === 'Event';
            const deptName = item.department_name || item.page_name || pageName || 'Staff Department Office';
            const deptKey = item.department_id || item.page_id || deptName;
            
            // Check if this post belongs to current user's page
            const isMyOwnPage = (myPageId && (item.page_id === myPageId || item.department_id === myPageId)) || (deptName === pageName);

            // Avatar calculation matching StaffDashboard
            const avatarText = item.code || (isMyOwnPage ? pageCode : null) || deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
            
            const pageId = item.page_id;
            const isFollowed = !!item.is_followed;
            
            // Format Timestamp / Date
            const postDate = formatPostTimestamp(item.created_at || item.date || item.event_date);
            const postImage = item.image_url || item.image || null;

            // Event-specific details
            const currentRegistered = item.registered_count ?? item.current_registered ?? 0;
            const maxCapacity = item.max_capacity || item.capacity || 'Unlimited';
            const locationText = item.location || 'University Campus';
            const hideState = hiddenPosts[postKey];
            const pageKey = pageId || deptName;
            const postId = item.id || item.post_id;

            if (hideState) {
              return (
                <HiddenPostCard
                  key={item.id || index}
                  deptName={deptName}
                  pageId={pageId}
                  isFollowed={isFollowed}
                  togglingPageId={togglingPageId}
                  selectedReason={hideState.reason}
                  onUndo={() => handleUndoHidePost(postKey, postId)}
                  onSelectReason={(reason) => handleSelectHideReason(postKey, postId, reason)}
                  onUnfollow={() => handleToggleFollow(pageId, true)}
                  onHideAllFromPage={() => handleHideAllFromPage(pageKey, pageId)}
                  onViewPage={pageId ? () => { window.location.href = `/staff/page/${pageId}`; } : null}
                />
              );
            }

            return (
              <article 
                key={item.id || index} 
                className="card card-interactive" 
                style={{ 
                  padding: '1rem 0', 
                  borderRadius: '1.25rem',
                  border: '1px solid var(--slate-200, #e2e8f0)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                {/* 1. POST HEADER */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem 0.875rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                    <PostPageAvatar
                      avatarUrl={item.page_avatar_url || (isMyOwnPage ? pageAvatarUrl : null)}
                      label={deptName}
                      fallbackCode={item.code || (isMyOwnPage ? pageCode : null)}
                    />

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {deptName}
                        </h4>
                        {!isMyOwnPage && pageId && (
                          <>
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>•</span>
                            <button
                              type="button"
                              onClick={() => handleToggleFollow(pageId, isFollowed)}
                              disabled={togglingPageId === pageId}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                color: '#2563eb',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                lineHeight: 1.2
                              }}
                              title={isFollowed ? 'Click to unfollow' : 'Click to follow'}
                            >
                              {togglingPageId === pageId ? 'Updating...' : isFollowed ? 'Following' : 'Follow'}
                            </button>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {isEvent ? (
                          <EventPostMeta
                            registeredCount={currentRegistered}
                            capacity={item.max_capacity || item.capacity}
                            createdAt={item.created_at}
                            audience={item.audience}
                          />
                        ) : (
                          <>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Announcement • {postDate}</span>
                            <span>•</span>
                            <PostAudienceBadge audience={item.audience} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    {(isMyOwnPage || item.is_owner) && (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuKey(prev => (prev === postKey ? null : postKey));
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '0.35rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '9999px'
                          }}
                          title="Manage post"
                        >
                          <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '0.95rem' }}></i>
                        </button>

                        {activeMenuKey === postKey && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '0.25rem',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.625rem',
                              boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
                              minWidth: '130px',
                              zIndex: 30,
                              overflow: 'hidden'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuKey(null);
                                handleOpenEditModal(item);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.55rem 0.85rem',
                                background: 'transparent',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: '#1e293b',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <i className="fa-solid fa-pen-to-square"></i> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingPost(item);
                                setActiveMenuKey(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.55rem 0.85rem',
                                background: 'transparent',
                                border: 'none',
                                borderTop: '1px solid #f1f5f9',
                                textAlign: 'left',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: '#b91c1c',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <i className="fa-solid fa-trash-can"></i> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHidePost(postKey, postId);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '9999px'
                      }}
                      title="Hide this post"
                    >
                      <i className="fa-solid fa-xmark" style={{ fontSize: '1rem' }}></i>
                    </button>
                  </div>
                </div>

                {/* 2. POST MEDIA / CONTENT CONTAINER */}
                {postImage ? (
                  <div style={{ 
                    backgroundColor: '#0f172a', 
                    width: '100%',
                    maxHeight: '450px',
                    overflow: 'hidden',
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    position: 'relative'
                  }}>
                    <img 
                      src={postImage} 
                      alt={item.title || item.event_title} 
                      style={{ width: '100%', height: 'auto', objectFit: 'cover' }} 
                    />
                  </div>
                ) : (
                  <div style={{ padding: '0.5rem 1rem 1rem 1rem' }}>
                    <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.125rem', lineHeight: 1.35, margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                      {item.title || item.event_title}
                    </h3>
                    <p style={{ color: '#475569', fontSize: '0.9375rem', marginTop: '0.75rem', lineHeight: 1.6, margin: '0.75rem 0 0 0' }}>
                      {item.content || item.description || item.event_description}
                    </p>
                  </div>
                )}

                {/* Caption / Title for Image Posts */}
                {postImage && (
                  <div style={{ padding: '0.875rem 1rem 0.5rem 1rem' }}>
                    <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                      {item.title || item.event_title}
                    </h3>
                    <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.5, margin: '0.4rem 0 0 0' }}>
                      {item.content || item.description || item.event_description}
                    </p>
                  </div>
                )}

                {/* 3. EVENT REGISTRATION & ATTENDANCE BAR */}
                {isEvent && (
                  <EventPostActionBar
                    isRegistered={Boolean(item.is_registered)}
                    isRegistering={registeringEventId === postId}
                    onToggleRegister={() => handleEventRegister(postId, Boolean(item.is_registered))}
                    onScanAttendance={() => {
                      const scanToken = prompt("Scan or enter event QR token:");
                      if (scanToken) {
                        const clean = scanToken.trim().split('/').pop();
                        window.location.href = `/staff/attendance/check-in/${clean}`;
                      }
                    }}
                  />
                )}
              </article>
            );
          })
        )}
      </main>

      {deletingPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '1rem'
          }}
          onClick={() => setDeletingPost(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '400px',
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Delete Post</h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: '#475569' }}>
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setDeletingPost(null)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={handleDeletePost} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#b91c1c', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </MyPageDashboardLayout>
  );
}