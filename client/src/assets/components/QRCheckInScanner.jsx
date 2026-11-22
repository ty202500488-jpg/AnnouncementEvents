import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { extractAttendanceToken, evaluateClientGeofence } from '../../utils/attendanceUtils';

function getCurrentPositionAsync() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
  });
}

function getGeolocationErrorMessage(err) {
  if (err?.code === 1) {
    return 'Location access was denied. Enable Location Services for this site in your browser settings and tap Retry Location Check, or ask event staff to manually record your attendance.';
  }
  if (err?.code === 2) {
    return 'Unable to determine your current location. Ensure GPS/Location Services are enabled and try again, or ask event staff to manually record your attendance.';
  }
  if (err?.code === 3) {
    return 'Location check timed out. Move to an area with clearer signal and tap Retry Location Check, or ask event staff to manually record your attendance.';
  }
  return 'Unable to verify your campus location. Enable Location Services and try again, or ask event staff to manually record your attendance.';
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

export default function QRCheckInScanner({
  role = 'student',
  isModal = false,
  expectedEventId = null,
  eventTitle = '',
  onClose,
  onCheckInSuccess,
}) {
  const params = useParams();
  const token = isModal ? undefined : params?.token;
  const navigate = useNavigate();
  const isScanMode = isModal || !token || token === 'scan';
  const dashboardPath = role === 'staff' ? '/staff/dashboard' : '/student/dashboard';
  const scanPath = role === 'staff' ? '/staff/attendance/check-in/scan' : '/student/attendance/check-in/scan';

  const [locationState, setLocationState] = useState('checking');
  const [locationDetail, setLocationDetail] = useState({
    geofenceEnabled: true,
    campusName: 'WMSU Main Campus',
    distanceMeters: null,
    radiusMeters: null,
    errorMessage: '',
  });
  const [status, setStatus] = useState(isScanMode ? 'scanner' : 'processing');
  const [message, setMessage] = useState(isScanMode ? '' : 'Verifying attendance token...');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const submittingRef = useRef(false);
  const coordsRef = useRef(null);
  const geofenceEnabledRef = useRef(true);
  const geofenceConfigRef = useRef(null);
  const locationCheckIdRef = useRef(0);
  const autoSubmittedTokenRef = useRef(null);
  const autoStartedCameraRef = useRef(false);
  const isMountedRef = useRef(true);
  const cameraRequestIdRef = useRef(0);

  const stopCamera = useCallback(() => {
    cameraRequestIdRef.current += 1;
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
    if (isMountedRef.current) {
      setCameraActive(false);
    }
  }, []);

  const verifyCampusLocation = useCallback(async () => {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      localStorage.setItem('redirect_after_login', window.location.pathname);
      navigate('/auth');
      return false;
    }

    const checkId = ++locationCheckIdRef.current;
    stopCamera();
    autoStartedCameraRef.current = false;
    autoSubmittedTokenRef.current = null;
    setLocationState('checking');
    setLocationDetail((prev) => ({ ...prev, errorMessage: '' }));

    try {
      const response = await fetch('http://localhost:5000/api/mypage/attendance/geofence-config', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (checkId !== locationCheckIdRef.current) return false;

      if (response.status === 401) {
        localStorage.setItem('redirect_after_login', window.location.pathname);
        navigate('/auth');
        return false;
      }

      if (!response.ok) {
        setLocationDetail({
          geofenceEnabled: true,
          campusName: 'WMSU Main Campus',
          distanceMeters: null,
          radiusMeters: null,
          errorMessage: 'Unable to verify campus geofence settings. Tap Retry Location Check or ask event staff for manual check-in.',
        });
        setLocationState('blocked_error');
        return false;
      }

      const config = await response.json();
      if (checkId !== locationCheckIdRef.current) return false;

      geofenceConfigRef.current = config;
      geofenceEnabledRef.current = config?.enabled !== false;

      if (config?.enabled === false) {
        coordsRef.current = null;
        setLocationDetail({
          geofenceEnabled: false,
          campusName: config?.campusName || 'WMSU Main Campus',
          distanceMeters: null,
          radiusMeters: config?.radiusMeters ?? null,
          errorMessage: '',
        });
        setLocationState('verified');
        return true;
      }

      if (!navigator.geolocation) {
        coordsRef.current = null;
        setLocationDetail({
          geofenceEnabled: true,
          campusName: config?.campusName || 'WMSU Main Campus',
          distanceMeters: null,
          radiusMeters: config?.radiusMeters ?? null,
          errorMessage: 'Location services are not supported in this browser. Ask event staff to manually record your attendance.',
        });
        setLocationState('blocked_error');
        return false;
      }

      const pos = await getCurrentPositionAsync();
      if (checkId !== locationCheckIdRef.current) return false;

      const geo = evaluateClientGeofence(
        { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        config
      );

      if (geo.allowed) {
        coordsRef.current = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          checkedAt: Date.now(),
        };
        setLocationDetail({
          geofenceEnabled: true,
          campusName: geo.campusName,
          distanceMeters: geo.distanceMeters,
          radiusMeters: geo.radiusMeters,
          errorMessage: '',
        });
        setLocationState('verified');
        return true;
      }

      coordsRef.current = null;
      setLocationDetail({
        geofenceEnabled: true,
        campusName: geo.campusName,
        distanceMeters: geo.distanceMeters,
        radiusMeters: geo.radiusMeters,
        errorMessage: '',
      });
      setLocationState('blocked_outside');
      return false;
    } catch (err) {
      if (checkId !== locationCheckIdRef.current) return false;
      coordsRef.current = null;
      const isGeolocationError = typeof err?.code === 'number';
      setLocationDetail({
        geofenceEnabled: geofenceEnabledRef.current,
        campusName: geofenceConfigRef.current?.campusName || 'WMSU Main Campus',
        distanceMeters: null,
        radiusMeters: geofenceConfigRef.current?.radiusMeters ?? null,
        errorMessage: isGeolocationError
          ? getGeolocationErrorMessage(err)
          : 'Network error while verifying campus location. Tap Retry Location Check or ask event staff for manual check-in.',
      });
      setLocationState('blocked_error');
      return false;
    }
  }, [navigate, stopCamera]);

  const submitTokenCheckIn = useCallback(async (rawToken) => {
    const cleanToken = extractAttendanceToken(rawToken);
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
      if (
        geofenceEnabledRef.current &&
        (!coordsRef.current || Date.now() - coordsRef.current.checkedAt > 60000)
      ) {
        if (!navigator.geolocation) {
          coordsRef.current = null;
          setLocationDetail((prev) => ({
            ...prev,
            errorMessage: 'Location services are not supported in this browser. Ask event staff to manually record your attendance.',
          }));
          setLocationState('blocked_error');
          setStatus(isScanMode ? 'scanner' : 'processing');
          return;
        }

        try {
          const pos = await getCurrentPositionAsync();
          const geo = evaluateClientGeofence(
            { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
            geofenceConfigRef.current || undefined
          );
          if (!geo.allowed) {
            coordsRef.current = null;
            setLocationDetail({
              geofenceEnabled: true,
              campusName: geo.campusName,
              distanceMeters: geo.distanceMeters,
              radiusMeters: geo.radiusMeters,
              errorMessage: '',
            });
            setLocationState('blocked_outside');
            setStatus(isScanMode ? 'scanner' : 'processing');
            return;
          }
          coordsRef.current = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            checkedAt: Date.now(),
          };
          setLocationDetail({
            geofenceEnabled: true,
            campusName: geo.campusName,
            distanceMeters: geo.distanceMeters,
            radiusMeters: geo.radiusMeters,
            errorMessage: '',
          });
        } catch (geoErr) {
          coordsRef.current = null;
          setLocationDetail((prev) => ({
            ...prev,
            errorMessage: getGeolocationErrorMessage(geoErr),
          }));
          setLocationState('blocked_error');
          setStatus(isScanMode ? 'scanner' : 'processing');
          return;
        }
      }

      const response = await fetch('http://localhost:5000/api/mypage/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: cleanToken,
          ...(expectedEventId ? { eventId: expectedEventId } : {}),
          ...(coordsRef.current
            ? {
                latitude: coordsRef.current.latitude,
                longitude: coordsRef.current.longitude,
              }
            : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Attendance recorded successfully!');
        onCheckInSuccess?.(data);
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
  }, [expectedEventId, isScanMode, navigate, onCheckInSuccess, stopCamera]);

  const startCamera = useCallback(async () => {
    const requestId = ++cameraRequestIdRef.current;
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

      if (!isMountedRef.current || requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (!isMountedRef.current || requestId !== cameraRequestIdRef.current) return;
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
        } catch {
          /* ignore frame detection errors */
        }
      }, 300);
    } catch (err) {
      if (!isMountedRef.current || requestId !== cameraRequestIdRef.current) {
        return;
      }
      console.error('Camera start error:', err);
      setCameraError('Unable to access camera. Please allow camera permission and try again.');
      stopCamera();
    }
  }, [stopCamera, submitTokenCheckIn]);

  useEffect(() => {
    verifyCampusLocation();
    return () => {
      locationCheckIdRef.current += 1;
    };
  }, [verifyCampusLocation]);

  useEffect(() => {
    if (locationState !== 'verified') return;

    if (!isScanMode && token) {
      if (autoSubmittedTokenRef.current !== token) {
        autoSubmittedTokenRef.current = token;
        submitTokenCheckIn(token);
      }
      return;
    }

    if (isModal && isScanMode && status === 'scanner' && !autoStartedCameraRef.current) {
      autoStartedCameraRef.current = true;
      startCamera();
    }
  }, [isModal, isScanMode, locationState, startCamera, status, submitTokenCheckIn, token]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  const handleResetToScanner = () => {
    autoSubmittedTokenRef.current = null;
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

      {eventTitle && (
        <div
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: '#fff1f2',
            borderBottom: '1px solid #fecdd3',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.825rem',
            fontWeight: 700,
            color: '#881337',
          }}
        >
          <i className="fa-solid fa-calendar-check" aria-hidden="true"></i>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {eventTitle}
          </span>
        </div>
      )}

      <div className="uw-modal-scroll">
        {locationState === 'checking' && (
          <div style={{ textAlign: 'center', padding: '2.25rem 1.25rem' }}>
            <i
              className="fa-solid fa-circle-notch fa-spin"
              style={{ fontSize: '2.25rem', color: '#7B0D1E', marginBottom: '0.9rem' }}
            ></i>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', color: '#0f172a' }}>
              Checking campus location...
            </h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Confirming you are within {locationDetail.campusName} before enabling QR check-in.
            </p>
          </div>
        )}

        {locationState === 'blocked_outside' && (
          <div style={{ textAlign: 'center', padding: '1.85rem 1.25rem' }}>
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#8c1030',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.45rem',
                marginBottom: '0.85rem',
              }}
            >
              <i className="fa-solid fa-location-dot"></i>
            </div>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.15rem', color: '#0f172a' }}>
              Outside Campus Area
            </h3>
            <p style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.875rem', lineHeight: 1.5 }}>
              You appear to be{' '}
              <strong>
                {locationDetail.distanceMeters !== null ? `${locationDetail.distanceMeters}m` : 'outside'}
              </strong>{' '}
              from {locationDetail.campusName}
              {locationDetail.radiusMeters !== null
                ? ` (allowed radius: ${locationDetail.radiusMeters}m)`
                : ''}
              .
            </p>
            <p style={{ margin: '0 0 1.25rem 0', color: '#64748b', fontSize: '0.8125rem', lineHeight: 1.45 }}>
              QR check-in is only available on campus. Move within campus grounds and retry, or ask event staff for manual attendance check-in.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={verifyCampusLocation}
                style={{
                  backgroundColor: '#7B0D1E',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <i className="fa-solid fa-rotate-right"></i>
                <span>Retry Location Check</span>
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

        {locationState === 'blocked_error' && (
          <div style={{ textAlign: 'center', padding: '1.85rem 1.25rem' }}>
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#b45309',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.45rem',
                marginBottom: '0.85rem',
              }}
            >
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.15rem', color: '#0f172a' }}>
              Location Required
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', color: '#475569', fontSize: '0.875rem', lineHeight: 1.5 }}>
              {locationDetail.errorMessage ||
                'Enable Location Services for this browser and tap Retry Location Check, or ask event staff to manually record your attendance.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={verifyCampusLocation}
                style={{
                  backgroundColor: '#7B0D1E',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <i className="fa-solid fa-rotate-right"></i>
                <span>Retry Location Check</span>
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

        {locationState === 'verified' && status === 'scanner' && (
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
              {locationDetail.geofenceEnabled && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.28rem 0.65rem',
                    borderRadius: '9999px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#047857',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  <i className="fa-solid fa-location-dot"></i>
                  <span>
                    Campus verified · {locationDetail.campusName}
                    {locationDetail.distanceMeters !== null ? ` (${locationDetail.distanceMeters}m)` : ''}
                  </span>
                </div>
              )}

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
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 500, textAlign: 'center' }}>
                  {cameraError}
                </p>
              )}
            </div>
          </>
        )}

        {locationState === 'verified' && status === 'processing' && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.25rem', color: '#7B0D1E', marginBottom: '0.85rem' }}></i>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', color: '#0f172a' }}>Verifying...</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{message}</p>
          </div>
        )}

        {locationState === 'verified' && status === 'success' && (
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
              {!expectedEventId && (
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
              )}
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

        {locationState === 'verified' && status === 'error' && (
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
