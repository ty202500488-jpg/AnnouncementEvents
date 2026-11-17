import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PostPageAvatar } from './PortalShellElements';
import { formatPostTimestamp } from '../../utils/dateUtils';
import { formatNotificationDisplay, useNotificationCenter } from '../../utils/notificationUtils';

export default function NotificationFeedView({ endpoint }) {
  const navigate = useNavigate();
  const {
    loading,
    filteredNotifications,
    handleMarkAsRead,
    handleDelete,
    handleDeleteMany,
    handleNotificationClick
  } = useNotificationCenter(endpoint);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmTargetIds, setConfirmTargetIds] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const visibleNotifications = filteredNotifications.filter((notif) => !notif.is_archived);
  const visibleIds = visibleNotifications.map((notif) => notif.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => visibleIds.includes(id)));
  }, [filteredNotifications.length]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : visibleIds);
  };

  const handleExitEdit = () => {
    setIsEditing(false);
    setSelectedIds([]);
  };

  const openSingleDeleteConfirm = (notifId, e) => {
    if (e) e.stopPropagation();
    setConfirmTargetIds([notifId]);
  };

  const openBulkDeleteConfirm = () => {
    if (selectedIds.length === 0) return;
    setConfirmTargetIds([...selectedIds]);
  };

  const handleConfirmDelete = async () => {
    if (!confirmTargetIds || confirmTargetIds.length === 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      if (confirmTargetIds.length === 1 && !isEditing) {
        await handleDelete(confirmTargetIds[0]);
      } else {
        await handleDeleteMany(confirmTargetIds);
      }
      setConfirmTargetIds(null);
      if (isEditing) {
        setIsEditing(false);
        setSelectedIds([]);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main
      className="lg-col-6 hide-scrollbar notif-feed-shell"
      style={{
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {!loading && visibleNotifications.length > 0 && (
        <div className="notif-toolbar-card">
          <div className="notif-toolbar-left">
            {isEditing ? (
              <label className="notif-select-all-label">
                <input
                  type="checkbox"
                  className="notif-checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                <span>
                  {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
                </span>
              </label>
            ) : (
              <h2 className="notif-toolbar-title">Notifications</h2>
            )}
          </div>

          <div className="notif-toolbar-actions">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="notif-toolbar-btn danger"
                  disabled={selectedIds.length === 0}
                  onClick={openBulkDeleteConfirm}
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
                  <span>Delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</span>
                </button>
                <button
                  type="button"
                  className="notif-toolbar-btn"
                  onClick={handleExitEdit}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="notif-toolbar-btn"
                onClick={() => setIsEditing(true)}
              >
                <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="notif-empty-state">
          <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#881337' }}></i>
          <p>Loading notifications...</p>
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="notif-empty-state">
          <i className="fa-solid fa-bell-slash"></i>
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {visibleNotifications.map((notif) => {
            const { pageName, title: displayTitle, summary } = formatNotificationDisplay(notif);
            const isSelected = selectedIds.includes(notif.id);

            return (
              <div
                key={notif.id}
                className={`notif-item-card ${notif.is_read ? 'read' : 'unread'} ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (isEditing) {
                    toggleSelect(notif.id);
                  } else {
                    handleNotificationClick(notif, navigate);
                  }
                }}
                style={{ cursor: isEditing || notif.url ? 'pointer' : 'default' }}
              >
                <div className="notif-item-main">
                  {isEditing && (
                    <div className="notif-card-checkbox-wrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="notif-checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(notif.id)}
                        aria-label={`Select notification ${displayTitle || pageName}`}
                      />
                    </div>
                  )}
                  <PostPageAvatar
                    avatarUrl={notif.page_avatar_url}
                    label={pageName}
                    fallbackCode={notif.page_code}
                  />
                  <div className="notif-item-body">
                    <div className="notif-item-meta">
                      <span className="notif-page-name">{pageName}</span>
                      <span className="notif-time-stamp" style={{ marginTop: 0 }}>• {formatPostTimestamp(notif.created_at)}</span>
                    </div>
                    {displayTitle && (
                      <div className="notif-item-title">{displayTitle}</div>
                    )}
                    {summary && (
                      <p className="notif-message-text">{summary}</p>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <div className="notif-item-actions">
                    {!notif.is_read && (
                      <button
                        type="button"
                        className="notif-action-btn read-btn"
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <i className="fa-solid fa-circle-check"></i>
                      </button>
                    )}
                    <button
                      type="button"
                      className="notif-action-btn delete-btn"
                      onClick={(e) => openSingleDeleteConfirm(notif.id, e)}
                      title="Delete"
                      aria-label="Delete notification"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmTargetIds && createPortal(
        <div
          className="notif-modal-backdrop"
          onClick={() => {
            if (!isDeleting) setConfirmTargetIds(null);
          }}
        >
          <div
            className="notif-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notif-modal-icon">
              <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
            </div>
            <h3 id="notif-delete-modal-title" className="notif-modal-title">
              Are you sure you want to delete?
            </h3>
            <p className="notif-modal-text">
              {confirmTargetIds.length > 1
                ? `This will permanently delete ${confirmTargetIds.length} selected notifications.`
                : 'This will permanently delete this notification.'}
            </p>
            <div className="notif-modal-actions">
              <button
                type="button"
                className="notif-modal-btn-cancel"
                disabled={isDeleting}
                onClick={() => setConfirmTargetIds(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="notif-modal-btn-delete"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
