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

export default function QRCheckInScanner({ role = 'student' }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const isScanMode = !token || token === 'scan';
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
      <article
        className="card"
        style={{
          width: '100%',
          maxWidth: '500px',
          padding: '1.75rem',
          borderRadius: '1.25rem',
          border: '1px solid var(--slate-200, #e2e8f0)',
          backgroundColor: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid #f1f5f9',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                backgroundColor: '#fbe4e8',
                color: '#7B0D1E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i className="fa-solid fa-qrcode"></i>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                QR Attendance Check-In
              </h2>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Scan an event attendance QR code with your camera
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(dashboardPath)}
            style={{
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>

        {status === 'scanner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                borderRadius: '1rem',
                border: '1px dashed #cbd5e1',
                backgroundColor: '#f8fafc',
                padding: '1.25rem',
                textAlign: 'center',
              }}
            >
              {cameraActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      maxWidth: '380px',
                      borderRadius: '0.85rem',
                      backgroundColor: '#0f172a',
                      border: '2px solid #7B0D1E',
                    }}
                  />
                  <button
                    type="button"
                    onClick={stopCamera}
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.5rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fa-solid fa-video-slash" style={{ marginRight: '0.4rem' }}></i>
                    Stop Camera
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0' }}>
                  <div
                    style={{
                      width: '3.5rem',
                      height: '3.5rem',
                      borderRadius: '50%',
                      backgroundColor: '#fbe4e8',
                      color: '#7B0D1E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                    }}
                  >
                    <i className="fa-solid fa-camera"></i>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>
                    Point your camera at the event attendance QR code
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={startCamera}
                      style={{
                        backgroundColor: '#7B0D1E',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '0.6rem',
                        padding: '0.55rem 1.15rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                      }}
                    >
                      <i className="fa-solid fa-camera"></i>
                      <span>Start Camera Scan</span>
                    </button>
                  </div>
                </div>
              )}

              {cameraError && (
                <p style={{ margin: '0.85rem 0 0 0', fontSize: '0.8rem', color: '#b91c1c', fontWeight: 500 }}>
                  {cameraError}
                </p>
              )}
            </div>
          </div>
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
                onClick={() => navigate(dashboardPath)}
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
                Go to Dashboard
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
                onClick={() => navigate(dashboardPath)}
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
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
