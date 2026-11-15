import React from 'react';

const HIDE_REASONS = [
  'Not relevant to me',
  "I've seen too many posts like this",
  'Already saw this information',
  'Other',
];

export default function HiddenPostCard({
  deptName,
  pageId,
  isFollowed,
  togglingPageId,
  selectedReason,
  onUndo,
  onSelectReason,
  onUnfollow,
  onHideAllFromPage,
  onViewPage,
}) {
  return (
    <article
      className="card"
      style={{
        padding: '1rem 1.25rem',
        borderRadius: '1.25rem',
        border: '1px solid var(--slate-200, #e2e8f0)',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#0f172a',
            fontWeight: 700,
            fontSize: '0.9rem',
          }}
        >
          <i className="fa-regular fa-eye-slash" style={{ color: '#64748b' }}></i>
          <span>Post hidden</span>
        </div>
        <button
          type="button"
          onClick={onUndo}
          style={{
            backgroundColor: '#f1f5f9',
            color: '#1e293b',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Undo
        </button>
      </div>

      <div style={{ marginTop: '0.875rem' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>
          Why aren&apos;t you interested?
        </p>
        {selectedReason ? (
          <div
            style={{
              fontSize: '0.8125rem',
              color: '#059669',
              backgroundColor: '#ecfdf5',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
            }}
          >
            Thanks for your feedback ({selectedReason}).
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {HIDE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => onSelectReason(reason)}
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  borderRadius: '9999px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {reason}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>
          Other steps you can take
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {pageId && isFollowed && onUnfollow && (
            <button
              type="button"
              onClick={onUnfollow}
              disabled={togglingPageId === pageId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                textAlign: 'left',
                background: '#f8fafc',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                color: '#1e293b',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-user-minus" style={{ color: '#64748b', width: '16px' }}></i>
              <span>Unfollow {deptName}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onHideAllFromPage}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              textAlign: 'left',
              background: '#f8fafc',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              color: '#1e293b',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <i className="fa-regular fa-circle-xmark" style={{ color: '#64748b', width: '16px' }}></i>
            <span>Hide all posts from {deptName}</span>
          </button>
          {pageId && onViewPage && (
            <button
              type="button"
              onClick={onViewPage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                textAlign: 'left',
                background: '#f8fafc',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                color: '#1e293b',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <i className="fa-regular fa-flag" style={{ color: '#64748b', width: '16px' }}></i>
              <span>View {deptName}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
