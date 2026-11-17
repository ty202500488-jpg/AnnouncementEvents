import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EventPostMeta, PostAudienceBadge } from './PortalShellElements';
import { formatPostTimestamp } from '../../utils/dateUtils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Normalize image URLs across base64 data URIs (stripping newlines), relative /uploads paths, and remote URLs. */
export function resolveAdminMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('blob:')) return null;

  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return trimmed;
    const header = trimmed.slice(0, commaIdx + 1);
    const payload = trimmed.slice(commaIdx + 1).replace(/\s+/g, '');
    return `${header}${payload}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${API_BASE}${normalizedPath}`;
  }
  return trimmed;
}

/**
 * Shared Staff-matched post card for Admin Campus Feed and Admin Profile,
 * keeping all admin actions tucked cleanly inside the 3-dots menu.
 */
export default function AdminPostCard({
  item,
  isMenuOpen = false,
  onToggleMenu,
  onCloseMenu,
  onViewDetails,
  onEdit,
  onArchive,
  onTakeDown,
  onRestore,
  onDelete,
  failedImages = {},
  onImageError,
}) {
  const navigate = useNavigate();

  const isEvent = item.type === 'event';
  const deptName = item.page_name || item.department_name || 'University Notice';
  const avatarText = item.department_code || deptName.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  const postTimestamp = formatPostTimestamp(item.created_at);
  const postKey = `${item.type}-${item.id}`;
  const avatarSrc = resolveAdminMediaUrl(item.page_avatar_url);
  const postImage = resolveAdminMediaUrl(item.image_url);
  const avatarFailed = Boolean(failedImages[`avatar-${postKey}`]);
  const mediaFailed = Boolean(failedImages[`media-${postKey}`]);
  const isArchived = item.is_archived || String(item.status).toLowerCase() === 'archived';
  const isTakenDown = String(item.status).toLowerCase() === 'rejected';
  const descriptionText = item.description || item.body || 'No description provided.';

  const hasMenuActions = Boolean(
    onViewDetails || onEdit || onArchive || onTakeDown || onRestore || onDelete
  );

  return (
    <article className="csf-post-card">
      {/* 1. Staff-Matched Post Header */}
      <div className="csf-post-header">
        <div
          className={`csf-author-wrap ${item.page_id ? 'is-clickable' : ''}`}
          onClick={() => item.page_id && navigate(`/page/${item.page_id}`)}
          title={item.page_id ? `View ${deptName} page` : undefined}
        >
          <div className="csf-avatar">
            {avatarSrc && !avatarFailed ? (
              <img
                src={avatarSrc}
                alt={deptName}
                onError={() => onImageError?.(`avatar-${postKey}`)}
              />
            ) : (
              avatarText
            )}
          </div>

          <div className="csf-author-meta">
            <div className="csf-badges-row">
              <h4 className="csf-page-name">{deptName}</h4>
            </div>

            <div className="csf-submeta">
              {isEvent ? (
                <EventPostMeta
                  registeredCount={item.registered_count ?? item.current_registered ?? 0}
                  capacity={item.max_capacity || item.capacity}
                  createdAt={item.created_at}
                  audience={item.audience}
                />
              ) : (
                <>
                  <span>Announcement • {postTimestamp}</span>
                  <span>•</span>
                  <PostAudienceBadge audience={item.audience} />
                </>
              )}
            </div>
          </div>
        </div>

        {hasMenuActions && (
          <div className="csf-post-header-right">
            <div className="csf-post-menu-wrap">
              <button
                type="button"
                className={`csf-post-menu-btn ${isMenuOpen ? 'is-open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu?.();
                }}
                aria-label="Post actions"
                aria-expanded={isMenuOpen}
                title="Admin actions"
              >
                <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>

              {isMenuOpen && (
                <div className="csf-post-menu-dropdown" role="menu">
                  {onViewDetails && (
                    <button
                      type="button"
                      className="csf-post-menu-item"
                      role="menuitem"
                      onClick={() => {
                        onCloseMenu?.();
                        onViewDetails(item);
                      }}
                    >
                      <i className="fa-solid fa-eye"></i>
                      <span>View Details</span>
                    </button>
                  )}

                  {onEdit && (
                    <button
                      type="button"
                      className="csf-post-menu-item"
                      role="menuitem"
                      onClick={() => {
                        onCloseMenu?.();
                        onEdit(item);
                      }}
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                      <span>Edit Post</span>
                    </button>
                  )}

                  {(onArchive || onTakeDown || onRestore || onDelete) && (onViewDetails || onEdit) && (
                    <div className="csf-post-menu-divider" />
                  )}

                  {isArchived || isTakenDown ? (
                    <>
                      {onRestore && (
                        <button
                          type="button"
                          className="csf-post-menu-item is-emerald"
                          role="menuitem"
                          onClick={() => {
                            onCloseMenu?.();
                            onRestore(item);
                          }}
                        >
                          <i className="fa-solid fa-rotate-left"></i>
                          <span>Restore</span>
                        </button>
                      )}
                      {isArchived && onDelete && (
                        <button
                          type="button"
                          className="csf-post-menu-item is-danger"
                          role="menuitem"
                          onClick={() => {
                            onCloseMenu?.();
                            onDelete(item);
                          }}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                          <span>Delete Permanently</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {onArchive && (
                        <button
                          type="button"
                          className="csf-post-menu-item is-amber"
                          role="menuitem"
                          onClick={() => {
                            onCloseMenu?.();
                            onArchive(item);
                          }}
                        >
                          <i className="fa-solid fa-box-archive"></i>
                          <span>Archive</span>
                        </button>
                      )}
                      {onTakeDown && (
                        <button
                          type="button"
                          className="csf-post-menu-item is-danger"
                          role="menuitem"
                          onClick={() => {
                            onCloseMenu?.();
                            onTakeDown(item);
                          }}
                        >
                          <i className="fa-solid fa-shield-halved"></i>
                          <span>Take Down</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Staff-Matched Full-Bleed Media + Content */}
      {postImage && !mediaFailed ? (
        <>
          <div className="csf-post-media">
            <img
              src={postImage}
              alt={item.title}
              loading="lazy"
              onError={() => onImageError?.(`media-${postKey}`)}
            />
          </div>
          <div className="csf-post-body-wrap">
            <h3 className="csf-post-title">{item.title}</h3>
            <p className="csf-post-text">{descriptionText}</p>
          </div>
        </>
      ) : (
        <div className="csf-post-body-wrap csf-text-only-body">
          <h3 className="csf-post-title is-uppercase">{item.title}</h3>
          <p className="csf-post-text">{descriptionText}</p>
          {postImage && mediaFailed && (
            <div className="csf-image-fallback">
              <i className="fa-solid fa-image"></i>
              <span>Attachment image could not be loaded for this post.</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
