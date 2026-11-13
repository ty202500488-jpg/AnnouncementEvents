import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const NOTIFICATION_META_MAP = {
  event: { boxClass: 'event', iconClass: 'fa-regular fa-calendar-days', label: 'Event' },
  reminder: { boxClass: 'event', iconClass: 'fa-regular fa-bell', label: 'Reminder' },
  registration: { boxClass: 'event', iconClass: 'fa-solid fa-user-plus', label: 'Registration' },
  attendance: { boxClass: 'event', iconClass: 'fa-solid fa-clipboard-check', label: 'Attendance' },
  moderation: { boxClass: 'announcement', iconClass: 'fa-solid fa-shield-halved', label: 'Moderation' },
  page: { boxClass: 'announcement', iconClass: 'fa-solid fa-layer-group', label: 'Page Status' },
  announcement: { boxClass: 'announcement', iconClass: 'fa-solid fa-bullhorn', label: 'Announcement' },
  system: { boxClass: 'announcement', iconClass: 'fa-solid fa-circle-info', label: 'System' }
};

export function useHighlightedPost(isReady, onDeepLink) {
  const location = useLocation();
  const [highlightedId, setHighlightedId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('postId') && onDeepLink) {
      onDeepLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get('postId');
    if (!targetId || !isReady) return undefined;

    let timer;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(`feed-post-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(String(targetId));
        timer = setTimeout(() => {
          setHighlightedId(prev => (prev === String(targetId) ? null : prev));
        }, 3500);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [location.search, isReady]);

  return highlightedId;
}

export function getHighlightedCardProps(item, highlightedPostId) {
  const idVal = item?.id ?? item?.post_id;
  const isHighlighted = highlightedPostId && idVal != null && String(idVal) === highlightedPostId;
  return {
    domId: idVal != null ? `feed-post-${idVal}` : undefined,
    isHighlighted,
    highlightStyle: isHighlighted
      ? {
          border: '2px solid #8c1030',
          boxShadow: '0 0 0 4px rgba(140, 16, 48, 0.14), 0 8px 24px rgba(140, 16, 48, 0.12)',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease'
        }
      : {}
  };
}

export function dispatchNotificationsUpdated() {
  window.dispatchEvent(new CustomEvent('notifications-updated'));
}

export function getNotificationMeta(type) {
  const key = String(type || 'announcement').toLowerCase();
  return NOTIFICATION_META_MAP[key] || {
    boxClass: 'announcement',
    iconClass: 'fa-solid fa-bullhorn',
    label: type || 'Notice'
  };
}

export function useNotificationCenter(baseEndpoint) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const sep = baseEndpoint.includes('?') ? '&' : '?';
      const response = await fetch(`${baseEndpoint}${sep}includeArchived=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [baseEndpoint]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notifId, e) => {
    if (e) e.stopPropagation();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${baseEndpoint}/${notifId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notifId ? { ...n, is_read: true } : n))
        );
        dispatchNotificationsUpdated();
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${baseEndpoint}/read-all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        dispatchNotificationsUpdated();
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleToggleArchive = async (notifId, currentArchived, e) => {
    if (e) e.stopPropagation();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${baseEndpoint}/${notifId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_archived: !currentArchived })
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notifId ? { ...n, is_archived: !currentArchived } : n))
        );
        dispatchNotificationsUpdated();
      }
    } catch (err) {
      console.error('Failed to update archive state:', err);
    }
  };

  const handleDelete = async (notifId, e) => {
    if (e) e.stopPropagation();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${baseEndpoint}/${notifId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        dispatchNotificationsUpdated();
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleNotificationClick = (notif, navigate) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    if (notif.url && navigate) {
      navigate(notif.url);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read && !n.is_archived).length;
  const archivedCount = notifications.filter(n => n.is_archived).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read && !n.is_archived;
    if (filter === 'archived') return n.is_archived;
    return !n.is_archived;
  });

  return {
    notifications,
    loading,
    filter,
    setFilter,
    unreadCount,
    archivedCount,
    filteredNotifications,
    fetchNotifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleToggleArchive,
    handleDelete,
    handleNotificationClick
  };
}
