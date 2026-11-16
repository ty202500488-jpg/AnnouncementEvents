import { useNavigate } from 'react-router-dom';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import { PostPageAvatar } from '../../../assets/components/PortalShellElements';
import { formatPostTimestamp } from '../../../utils/dateUtils';
import { formatNotificationDisplay, useNotificationCenter } from '../../../utils/notificationUtils';
import '../../styles/StudentDashboard.css';
import '../../styles/Notification.css';

export default function MyPageNotifications() {
  const navigate = useNavigate();
  const {
    loading,
    filteredNotifications,
    handleMarkAsRead,
    handleDelete,
    handleNotificationClick
  } = useNotificationCenter('/api/mypage/notifications');

  const visibleNotifications = filteredNotifications.filter((notif) => !notif.is_archived);

  return (
    <MyPageDashboardLayout activeTab="notifications">
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
              return (
                <div
                  key={notif.id}
                  className={`notif-item-card ${notif.is_read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(notif, navigate)}
                  style={{ cursor: notif.url ? 'pointer' : 'default' }}
                >
                  <div className="notif-item-main">
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
                      onClick={(e) => handleDelete(notif.id, e)}
                      title="Delete"
                      aria-label="Delete notification"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </MyPageDashboardLayout>
  );
}
