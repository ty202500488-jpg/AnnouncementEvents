import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';

function extractCheckInToken(rawValue) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/attendance/check-in/')) {
    const parts = trimmed.split('/attendance/check-in/');
    return (parts[1] || '').split(/[?#]/)[0].replace(/\/+$/, '').trim();
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const dataParam = url.searchParams.get('data');
      if (dataParam) {
        const nested = extractCheckInToken(dataParam);
        if (nested) return nested;
      }
      const tokenParam = url.searchParams.get('token');
      if (tokenParam) return tokenParam.trim();
      const segs = url.pathname.split('/').filter(Boolean);
      return (segs[segs.length - 1] || '').trim();
    } catch (_) {
      return (trimmed.split('/').pop() || '').replace(/\/+$/, '').trim();
    }
  }
  return trimmed.replace(/^['"]|['"]$/g, '').trim();
}

function decodeQrFromCanvasSource(source, width, height) {
  if (!width || !height) return '';
  const maxDim = 1200;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  // Fill white first so transparent PNG QR codes decode reliably
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(source, 0, 0, targetW, targetH);

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const code = jsQR(imageData.data, targetW, targetH, {
    inversionAttempts: 'attemptBoth',
  });
  return code?.data || '';
}

export default function QRCheckInScanner({ role = 'student', isModal = false, onClose }) {
  const params = useParams();
  const token = isModal ? undefined : params?.token;
  const navigate = useNavigate();
  const isScanMode = isModal || !token || token === 'scan';
  const dashboardPath = role === 'staff' ? '/staff/dashboard' : '/student/dashboard';
  const scanPath = role === 'staff' ? '/staff/attendance/check-in/scan' : '/student/attendance/check-in/scan';

  const [status, setStatus] = useState(isScanMode ? 'scanner' : 'processing');
  const [message, setMessage] = useState(isScanMode ? '' : 'Verifying attendance token...');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const submittingRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const submitTokenCheckIn = useCallback(async (rawToken) => {
    const cleanToken = extractCheckInToken(rawToken);
    if (!cleanToken || cleanToken === 'scan') {
      setStatus('error');
      setMessage('Please enter or scan a valid attendance QR code.');
      return;
    }

    const authToken = localStorage.getItem('token');
    if (!authToken) {
      localStorage.setItem('redirect_after_login', window.location.pathname);
      navigate('/auth');
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    stopCamera();
    setCameraError('');
    setStatus('processing');
    setMessage('Verifying attendance token...');

    try {
      const response = await fetch('http://localhost:5000/api/mypage/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: cleanToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Attendance recorded successfully!');
      } else {
        setStatus('error');
        setMessage(data.message || 'Failed to record attendance.');
      }
    } catch (err) {
      console.error('Check-in error:', err);
      setStatus('error');
      setMessage('Network error. Please try again.');
    } finally {
      submittingRef.current = false;
    }
  }, [navigate, stopCamera]);

  useEffect(() => {
    if (!isScanMode && token) {
      submitTokenCheckIn(token);
    } else {
      setStatus('scanner');
      setMessage('');
    }
  }, [isScanMode, token, submitTokenCheckIn]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);

      const detector = 'BarcodeDetector' in window
        ? new window.BarcodeDetector({ formats: ['qr_code'] })
        : null;

      scanTimerRef.current = setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || submittingRef.current) return;
        try {
          if (detector) {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              submitTokenCheckIn(barcodes[0].rawValue);
              return;
            }
          }
          const decoded = decodeQrFromCanvasSource(video, video.videoWidth, video.videoHeight);
          if (decoded) {
            submitTokenCheckIn(decoded);
          }
        } catch (_) {
          /* ignore frame detection errors */
        }
      }, 300);
    } catch (err) {
      console.error('Camera start error:', err);
      setCameraError('Unable to access camera. Please allow camera permission and try again.');
      stopCamera();
    }
  };

  const handleResetToScanner = () => {
    setCameraError('');
    setStatus('scanner');
    setMessage('');
    if (!isScanMode) {
      navigate(scanPath);
    }
  };

  const handleExit = () => {
    stopCamera();
    if (onClose) {
      onClose();
    } else {
      navigate(dashboardPath);
    }
  };

  const cardContent = (
    <article
      className={isModal ? 'uw-modal-dialog' : 'card'}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: '500px',
        maxHeight: isModal ? '90dvh' : undefined,
        borderRadius: '1.125rem',
        border: isModal ? undefined : '1px solid var(--slate-200, #e2e8f0)',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isModal
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
          : '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
      }}
    >
      {/* Top Bar matching Spotlight Modal */}
      <div className="uw-modal-topbar">
        <div className="uw-modal-badges">
          <span className="uw-modal-badge-primary">
            <span className="uw-spotlight-dot" aria-hidden="true"></span>
            QR Scan
          </span>
          <span className="uw-modal-badge-type">Attendance</span>
        </div>

        <button
          type="button"
          className="uw-modal-close"
          onClick={handleExit}
          aria-label={isModal ? 'Close QR scanner' : 'Back to dashboard'}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="uw-modal-scroll">
        {status === 'scanner' && (
          <>
            {/* Dark Hero Camera Stage matching Spotlight Modal */}
            <div
              className="uw-modal-hero"
              style={{
                minHeight: 'clamp(220px, 42dvh, 360px)',
                maxHeight: 'min(420px, 55dvh)',
                padding: cameraActive ? '0' : 'clamp(1.25rem, 4vw, 2.5rem) 1.25rem',
                flexDirection: 'column',
                gap: '0.75rem',
                boxSizing: 'border-box',
              }}
            >
              {cameraActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    maxHeight: 'min(420px, 55dvh)',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <>
                  <div
                    style={{
                      width: '3.75rem',
                      height: '3.75rem',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                    }}
                  >
                    <i className="fa-solid fa-qrcode"></i>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, textAlign: 'center' }}>
                    Point camera at the QR code
                  </p>
                </>
              )}
            </div>

            {/* White Body matching Spotlight Modal */}
            <div className="uw-modal-body" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>

                {cameraActive ? (
                  <button
                    type="button"
                    onClick={stopCamera}
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.5rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <i className="fa-solid fa-video-slash"></i>
                    <span>Stop Camera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    style={{
                      backgroundColor: '#800020',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      padding: '0.55rem 1.15rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}
                  >
                    <i className="fa-solid fa-camera"></i>
                    <span>Start Scan</span>
                  </button>
                )}
              </div>

              {cameraError && (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 500 }}>
                  {cameraError}
                </p>
              )}
            </div>
          </>
        )}

        {status === 'processing' && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.25rem', color: '#7B0D1E', marginBottom: '0.85rem' }}></i>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', color: '#0f172a' }}>Verifying...</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center', padding: '1.75rem 1rem' }}>
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                marginBottom: '0.85rem',
              }}
            >
              <i className="fa-solid fa-check"></i>
            </div>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', color: '#0f172a' }}>Check-In Confirmed!</h3>
            <p style={{ margin: '0 0 1.25rem 0', color: '#475569', fontSize: '0.875rem' }}>{message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleResetToScanner}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Scan Another
              </button>
              <button
                type="button"
                onClick={handleExit}
                style={{
                  backgroundColor: '#7B0D1E',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isModal ? 'Done' : 'Go to Dashboard'}
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '1.75rem 1rem' }}>
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                marginBottom: '0.85rem',
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </div>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', color: '#0f172a' }}>Check-In Failed</h3>
            <p style={{ margin: '0 0 1.25rem 0', color: '#b91c1c', fontSize: '0.875rem' }}>{message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleResetToScanner}
                style={{
                  backgroundColor: '#7B0D1E',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={handleExit}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isModal ? 'Close' : 'Back to Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );

  if (isModal) {
    return cardContent;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
        backgroundColor: '#f8fafc',
      }}
    >
      {cardContent}
    </div>
  );
}
