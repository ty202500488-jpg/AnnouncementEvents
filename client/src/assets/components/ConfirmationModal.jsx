import React, { useState, useEffect } from 'react';

/**
 * Global Reusable Confirmation Modal for Admin Dashboard
 * Supports:
 * - Destructive, warning, primary, and success variants
 * - Optional or required reason input (for rejections, takedowns, suspensions, archiving)
 * - Affected record preview details
 * - Double-submission prevention and loading state
 */
const ConfirmationModal = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this action?',
  itemName = '',
  itemSubtitle = '',
  variant = 'primary', // 'danger' | 'warning' | 'primary' | 'success'
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  requireReason = false,
  showReasonInput = false,
  reasonLabel = 'Reason / Remarks',
  reasonPlaceholder = 'Provide a clear reason for audit logging...',
  initialReason = '',
  onConfirm,
  onCancel,
  loading = false,
  children
}) => {
  const [reason, setReason] = useState(initialReason || '');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(initialReason || '');
      setValidationError('');
    }
  }, [isOpen, initialReason]);

  if (!isOpen) return null;

  const needsReasonField = requireReason || showReasonInput;

  const handleConfirmClick = (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    if (requireReason && !String(reason || '').trim()) {
      setValidationError('Please provide a reason before confirming this action.');
      return;
    }

    setValidationError('');
    onConfirm(String(reason || '').trim());
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading && onCancel) {
      onCancel();
    }
  };

  const getIconClass = () => {
    switch (variant) {
      case 'danger':
        return 'fa-solid fa-triangle-exclamation';
      case 'warning':
        return 'fa-solid fa-box-archive';
      case 'success':
        return 'fa-solid fa-circle-check';
      default:
        return 'fa-solid fa-shield-halved';
    }
  };

  return (
    <div
      className="admin-global-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-confirm-modal-title"
    >
      <div className="admin-global-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className={`admin-global-modal-header variant-${variant}`}>
          <div className={`admin-global-modal-icon variant-${variant}`}>
            <i className={getIconClass()}></i>
          </div>
          <div className="admin-global-modal-title-wrap">
            <h3 id="admin-confirm-modal-title" className="admin-global-modal-title">
              {title}
            </h3>
            {itemName && (
              <div className="admin-global-modal-record-badge">
                <span className="record-name">{itemName}</span>
                {itemSubtitle && <span className="record-sub"> • {itemSubtitle}</span>}
              </div>
            )}
          </div>
          <button
            type="button"
            className="admin-global-modal-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleConfirmClick} className="admin-global-modal-body">
          {message && <p className="admin-global-modal-message">{message}</p>}

          {children && <div className="admin-global-modal-custom-content">{children}</div>}

          {needsReasonField && (
            <div className="admin-global-modal-field">
              <label className="admin-global-modal-label">
                {reasonLabel} {requireReason && <span className="required-star">*</span>}
              </label>
              <textarea
                className={`admin-global-modal-textarea ${validationError ? 'has-error' : ''}`}
                rows={3}
                placeholder={reasonPlaceholder}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (validationError) setValidationError('');
                }}
                disabled={loading}
              />
              {validationError && (
                <span className="admin-global-modal-error">
                  <i className="fa-solid fa-circle-exclamation"></i> {validationError}
                </span>
              )}
            </div>
          )}

          <div className="admin-global-modal-footer">
            <button
              type="button"
              className="admin-global-btn cancel"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelText}
            </button>
            <button
              type="submit"
              className={`admin-global-btn confirm variant-${variant}`}
              disabled={loading || (requireReason && !String(reason || '').trim())}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfirmationModal;
