import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import { toLocalDateTimeInputValue } from '../../../utils/attendanceUtils';
import '../../styles/MyPageAttendance.css';

const API_BASE = 'http://localhost:5000/api/mypage/attendance';

function formatDisplayDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text || 'Event Attendance').trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3);
}

export default function MyPageAttendance() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Attendance Records & Filters
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Static QR Display State
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrCreatedAt, setQrCreatedAt] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  const [regeneratingQr, setRegeneratingQr] = useState(false);

  // Schedule Window State
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState(null); // { type: 'error'|'success', text: string }

  // Correction Modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [correctionStatus, setCorrectionStatus] = useState('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const eventFetchIdRef = useRef(0);
  const qrFetchIdRef = useRef(0);

  const buildLocalQrDataUrl = useCallback(async (qrPayload) => {
    return QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M'
    });
  }, []);

  const fetchAuthorizedEvents = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.events) {
        setEvents(data.events);
        if (data.events.length > 0) {
          setSelectedEventId(String(data.events[0].id));
        }
      } else {
        setError(data.message || 'Failed to load authorized events.');
      }
    } catch (err) {
      console.error('Error fetching authorized events:', err);
      setError('Unable to reach server.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEventAttendanceData = useCallback(async (eventId) => {
    const reqId = ++eventFetchIdRef.current;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (reqId !== eventFetchIdRef.current) return;
      if (response.ok) {
        setEventData(data);
        setRecords(data.records || []);
        setScheduleStart(toLocalDateTimeInputValue(data.session?.scheduled_open_time));
        setScheduleEnd(toLocalDateTimeInputValue(data.session?.scheduled_close_time));
      } else {
        setError(data.message || 'Failed to load event attendance info.');
      }
    } catch (err) {
      if (reqId !== eventFetchIdRef.current) return;
      console.error('Error fetching event details:', err);
    }
  }, []);

  const fetchStaticQrCredential = useCallback(async (eventId) => {
    if (!eventId) return;
    const reqId = ++qrFetchIdRef.current;
    setQrLoading(true);
    setQrDataUrl('');
    setQrCreatedAt(null);
    setQrError('');
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/events/${eventId}/qr-credential`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (reqId !== qrFetchIdRef.current) return;
      if (response.ok && data.qrPayload) {
        const dataUrl = await buildLocalQrDataUrl(data.qrPayload);
        if (reqId !== qrFetchIdRef.current) return;
        setQrDataUrl(dataUrl);
        setQrCreatedAt(data.qrCreatedAt || null);
      } else {
        setQrDataUrl('');
        setQrCreatedAt(null);
        setQrError(data.message || 'QR credential unavailable.');
      }
    } catch (err) {
      if (reqId !== qrFetchIdRef.current) return;
      console.error('Failed to load static QR credential:', err);
      setQrDataUrl('');
      setQrCreatedAt(null);
      setQrError('Unable to generate local QR code.');
    } finally {
      if (reqId === qrFetchIdRef.current) {
        setQrLoading(false);
      }
    }
  }, [buildLocalQrDataUrl]);

  useEffect(() => {
    fetchAuthorizedEvents();
  }, [fetchAuthorizedEvents]);

  useEffect(() => {
    if (!selectedEventId) return;
    fetchEventAttendanceData(selectedEventId);
    fetchStaticQrCredential(selectedEventId);
  }, [selectedEventId, fetchEventAttendanceData, fetchStaticQrCredential]);

  useEffect(() => {
    if (!scheduleFeedback || scheduleFeedback.type !== 'success') return undefined;
    const timer = setTimeout(() => {
      setScheduleFeedback(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [scheduleFeedback]);

  const handleRegenerateQr = async () => {
    if (!selectedEventId || regeneratingQr) return;
    const confirmed = window.confirm(
      "Regenerate this event's QR code? Any previously shared screenshots will immediately stop working."
    );
    if (!confirmed) return;

    setRegeneratingQr(true);
    setQrError('');
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/events/${selectedEventId}/qr-credential/regenerate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.qrPayload) {
        const dataUrl = await buildLocalQrDataUrl(data.qrPayload);
        setQrDataUrl(dataUrl);
        setQrCreatedAt(data.qrCreatedAt || new Date().toISOString());
        fetchEventAttendanceData(selectedEventId);
      } else {
        setQrError(data.message || 'Failed to regenerate QR code.');
      }
    } catch (err) {
      console.error('Error regenerating QR credential:', err);
      setQrError('Unable to regenerate QR code.');
    } finally {
      setRegeneratingQr(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !selectedEventId) return;

    const qrImage = new Image();
    qrImage.onload = () => {
      const width = 640;
      const paddingX = 48;
      const maxTextWidth = width - paddingX * 2;
      const qrSize = 400;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const titleLines = wrapCanvasText(ctx, eventData?.event?.title || 'Event Attendance', maxTextWidth);
      const headerHeight = 68 + titleLines.length * 32 + 34;
      const height = headerHeight + qrSize + 92;

      canvas.width = width;
      canvas.height = height;

      // White card background & crimson top accent
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#7B0D1E';
      ctx.fillRect(0, 0, width, 12);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      // Event Title
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      titleLines.forEach((line, idx) => {
        ctx.fillText(line, width / 2, 56 + idx * 32, maxTextWidth);
      });

      // Subtitle
      ctx.fillStyle = '#7B0D1E';
      ctx.font = '600 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText('Scan in Crimson · WMSU Main Campus', width / 2, 56 + titleLines.length * 32 + 6, maxTextWidth);

      // QR Code
      const qrX = (width - qrSize) / 2;
      const qrY = headerHeight;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(`Event #${selectedEventId} · Official Attendance QR`, width / 2, qrY + qrSize + 44, maxTextWidth);

      const triggerDownload = (href) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = `attendance_qr_event_${selectedEventId}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      };

      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            triggerDownload(canvas.toDataURL('image/png'));
            return;
          }
          const url = window.URL.createObjectURL(blob);
          triggerDownload(url);
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        }, 'image/png');
      } else {
        triggerDownload(canvas.toDataURL('image/png'));
      }
    };
    qrImage.src = qrDataUrl;
  };

  const handleToggleAttendanceWindow = async (action) => {
    const label = action === 'OPEN' ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${label} the attendance window?`)) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/events/${selectedEventId}/window`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (response.ok) {
        fetchEventAttendanceData(selectedEventId);
      } else {
        alert(data.message || 'Action failed.');
      }
    } catch (err) {
      console.error('Action error:', err);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setScheduleFeedback(null);

    if (!scheduleStart || !scheduleEnd) {
      setScheduleFeedback({
        type: 'error',
        text: 'Please provide both a Schedule Start and Schedule End date/time.'
      });
      return;
    }

    const startDate = new Date(scheduleStart);
    const endDate = new Date(scheduleEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setScheduleFeedback({
        type: 'error',
        text: 'Please enter valid date and time values.'
      });
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setScheduleFeedback({
        type: 'error',
        text: 'Schedule End must be after Schedule Start.'
      });
      return;
    }

    setScheduleSaving(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/events/${selectedEventId}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          scheduledOpenTime: startDate.toISOString(),
          scheduledCloseTime: endDate.toISOString()
        })
      });
      const data = await response.json();
      if (response.ok) {
        setScheduleFeedback({
          type: 'success',
          text: data.message || 'Attendance schedule saved.'
        });
        fetchEventAttendanceData(selectedEventId);
      } else {
        setScheduleFeedback({
          type: 'error',
          text: data.message || 'Failed to save attendance schedule.'
        });
      }
    } catch (err) {
      console.error('Schedule save error:', err);
      setScheduleFeedback({
        type: 'error',
        text: 'Unable to save schedule right now.'
      });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleClearSchedule = async () => {
    setScheduleFeedback(null);
    setScheduleSaving(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/events/${selectedEventId}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ clear: true })
      });
      const data = await response.json();
      if (response.ok) {
        setScheduleStart('');
        setScheduleEnd('');
        setScheduleFeedback({
          type: 'success',
          text: data.message || 'Attendance schedule cleared.'
        });
        fetchEventAttendanceData(selectedEventId);
      } else {
        setScheduleFeedback({
          type: 'error',
          text: data.message || 'Failed to clear schedule.'
        });
      }
    } catch (err) {
      console.error('Schedule clear error:', err);
      setScheduleFeedback({
        type: 'error',
        text: 'Unable to clear schedule right now.'
      });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      alert('A reason is required for manual attendance correction.');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/records/${selectedRecord.id}/correct`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: correctionStatus,
          reason: correctionReason
        })
      });
      const data = await response.json();
      if (response.ok) {
        setShowCorrectionModal(false);
        setCorrectionReason('');
        fetchEventAttendanceData(selectedEventId);
      } else {
        alert(data.message || 'Correction failed.');
      }
    } catch (err) {
      console.error('Correction submission error:', err);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedEventId) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/events/${selectedEventId}/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        alert('Failed to export attendance CSV.');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_event_${selectedEventId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export CSV error:', err);
    }
  };

  const effectiveStatus =
    eventData?.session?.effective_status ||
    (eventData?.session?.status === 'OPEN' ? 'ACTIVE' : 'CLOSED');

  const hasSavedSchedule = Boolean(
    eventData?.session?.scheduled_open_time || eventData?.session?.scheduled_close_time
  );

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      (r.student_name && r.student_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.student_id && r.student_id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <MyPageDashboardLayout activeTab="attendance">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          Loading attendance module...
        </div>
      </MyPageDashboardLayout>
    );
  }

  return (
    <MyPageDashboardLayout activeTab="attendance">
      <div className="attendance-page-container">
        <div className="attendance-header-card">
          <div className="attendance-breadcrumb">
            <span>MyPage</span> / <span className="active">Attendance</span>
          </div>
          <div className="attendance-title-row">
            <div>
              <h1>Attendance Management</h1>
              <p>Manage static event QR codes, attendance schedules, and verified campus check-ins.</p>
            </div>

            <div className="event-selector-box">
              <label htmlFor="eventSelect">Select Event</label>
              <select
                id="eventSelect"
                className="event-select-dropdown"
                value={selectedEventId}
                onChange={(e) => {
                  setScheduleFeedback(null);
                  setQrError('');
                  setSelectedEventId(e.target.value);
                }}
              >
                {events.length === 0 ? (
                  <option value="">No authorized events found</option>
                ) : (
                  events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title} ({new Date(evt.event_date).toLocaleDateString()})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecdd3', color: '#991b1b', borderRadius: '0.5rem' }}>
            {error}
          </div>
        )}

        {eventData && (
          <>
            <div className="selected-event-card">
              <div className="event-card-header">
                <span className="event-category-badge">{eventData.event.category || 'General Event'}</span>
                <span className={`status-badge ${effectiveStatus.toLowerCase()}`}>
                  Window: {effectiveStatus}
                </span>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                {eventData.event.title}
              </h2>

              <div className="event-info-grid">
                <div className="event-info-item">
                  <i className="fa-solid fa-calendar"></i>
                  <span>{new Date(eventData.event.event_date).toLocaleString()}</span>
                </div>
                <div className="event-info-item">
                  <i className="fa-solid fa-location-dot"></i>
                  <span>{eventData.event.venue || 'Main Campus Auditorium'}</span>
                </div>
                <div className="event-info-item">
                  <i className="fa-solid fa-users"></i>
                  <span>{eventData.summary?.totalEligible || 0} Eligible Registered</span>
                </div>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-card present">
                <div>
                  <div className="metric-lbl">Present</div>
                  <div className="metric-val">{eventData.summary?.present || 0}</div>
                  <div className="metric-pct">{eventData.summary?.presentPct || 0}% of total</div>
                </div>
                <i className="fa-solid fa-circle-check" style={{ fontSize: '2rem', color: '#16a34a' }}></i>
              </div>

              <div className="metric-card absent">
                <div>
                  <div className="metric-lbl">Absent</div>
                  <div className="metric-val">{eventData.summary?.absent || 0}</div>
                  <div className="metric-pct">{eventData.summary?.absentPct || 0}% of total</div>
                </div>
                <i className="fa-solid fa-circle-xmark" style={{ fontSize: '2rem', color: '#dc2626' }}></i>
              </div>

              <div className="metric-card unmarked">
                <div>
                  <div className="metric-lbl">Not Marked</div>
                  <div className="metric-val">{eventData.summary?.unmarked || 0}</div>
                  <div className="metric-pct">{eventData.summary?.unmarkedPct || 0}% remaining</div>
                </div>
                <i className="fa-solid fa-clock" style={{ fontSize: '2rem', color: '#d97706' }}></i>
              </div>
            </div>

            <div className="controls-card">
              <div className="controls-top-row">
                <div className="window-time-info">
                  <div>
                    <span className={`status-badge ${effectiveStatus.toLowerCase()}`}>
                      {effectiveStatus}
                    </span>
                  </div>
                  <div>
                    <strong>Window Start:</strong>{' '}
                    {formatDisplayDateTime(eventData.session?.scheduled_open_time || eventData.session?.open_time)}
                  </div>
                  <div>
                    <strong>Window End:</strong>{' '}
                    {formatDisplayDateTime(eventData.session?.scheduled_close_time || eventData.session?.close_time)}
                  </div>
                </div>

                <div className="action-buttons-group">
                  {effectiveStatus !== 'ACTIVE' ? (
                    <button
                      type="button"
                      className="btn-primary-maroon"
                      onClick={() => handleToggleAttendanceWindow('OPEN')}
                    >
                      <i className="fa-solid fa-door-open"></i> Activate Attendance
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary-outline"
                      onClick={() => handleToggleAttendanceWindow('CLOSE')}
                    >
                      <i className="fa-solid fa-door-closed"></i> Deactivate Attendance
                    </button>
                  )}
                </div>
              </div>

              <form className="schedule-window-form" onSubmit={handleSaveSchedule}>
                <div className="schedule-window-header">
                  <span className="schedule-window-title">
                    <i className="fa-solid fa-calendar-clock"></i> Schedule Window
                  </span>
                  <span className="schedule-window-hint">
                    Optional: automatically activates and closes check-ins at your chosen times.
                  </span>
                </div>

                <div className="schedule-inputs-row">
                  <label className="schedule-field">
                    <span>Schedule Start</span>
                    <input
                      type="datetime-local"
                      value={scheduleStart}
                      onChange={(e) => setScheduleStart(e.target.value)}
                    />
                  </label>

                  <label className="schedule-field">
                    <span>Schedule End</span>
                    <input
                      type="datetime-local"
                      value={scheduleEnd}
                      onChange={(e) => setScheduleEnd(e.target.value)}
                    />
                  </label>

                  <div className="schedule-actions">
                    <button
                      type="submit"
                      className="btn-primary-maroon"
                      disabled={scheduleSaving}
                    >
                      <i className="fa-solid fa-floppy-disk"></i> {scheduleSaving ? 'Saving...' : 'Save Schedule'}
                    </button>
                    {hasSavedSchedule && (
                      <button
                        type="button"
                        className="btn-secondary-outline"
                        onClick={handleClearSchedule}
                        disabled={scheduleSaving}
                      >
                        <i className="fa-solid fa-xmark"></i> Clear Schedule
                      </button>
                    )}
                  </div>
                </div>

                {scheduleFeedback && (
                  <div className={`schedule-feedback ${scheduleFeedback.type}`}>
                    {scheduleFeedback.text}
                  </div>
                )}
              </form>
            </div>

            <div className="attendance-nav-tabs-wrapper">
              <div className="attendance-nav-tabs">
                <button
                  className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview
                </button>
                <button
                  className={`tab-item ${activeTab === 'qr' ? 'active' : ''}`}
                  onClick={() => setActiveTab('qr')}
                >
                  Attendance QR
                </button>
                <button
                  className={`tab-item ${activeTab === 'records' ? 'active' : ''}`}
                  onClick={() => setActiveTab('records')}
                >
                  Attendance Records
                </button>
                <button
                  className={`tab-item ${activeTab === 'reports' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reports')}
                >
                  Reports
                </button>
              </div>
            </div>

            {activeTab === 'overview' && (
              <div className="overview-guidelines-card">
                <h3>Attendance Guidelines</h3>
                <ul className="overview-guidelines-list">
                  <li>
                    <strong>Static Shareable QR:</strong> Each event has one persistent QR code available in the <em>Attendance QR</em> tab even before the session starts, so you can download or screenshot it for assistants in advance. Regenerating the QR immediately invalidates prior copies.
                  </li>
                  <li>
                    <strong>Manual or Scheduled Activation:</strong> Students can only check in while the window is <strong>ACTIVE</strong> — either activated manually or during your saved schedule window.
                  </li>
                  <li>
                    <strong>On-Campus Verification:</strong> Student scans require device location verification within the <strong>WMSU Main Campus</strong> geofence.
                  </li>
                  <li>
                    <strong>Automatic Absent Marking:</strong> When an active window closes (manually or at the scheduled end time), any eligible registered student who did not check in is automatically recorded as <strong>Absent</strong>.
                  </li>
                </ul>
              </div>
            )}

            {activeTab === 'qr' && (
              <div className="qr-display-container">
                <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>Static Event Attendance QR</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                  Display, download, or share this event QR with event assistants. Scans are accepted only when attendance is active.
                </p>

                {effectiveStatus === 'ACTIVE' && (
                  <div className="qr-status-banner active">
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Active — accepting on-campus scans (WMSU Main Campus)</span>
                  </div>
                )}

                {effectiveStatus === 'SCHEDULED' && (
                  <div className="qr-status-banner scheduled">
                    <i className="fa-solid fa-clock"></i>
                    <span>
                      Scheduled ({formatDisplayDateTime(eventData.session?.scheduled_open_time)} – {formatDisplayDateTime(eventData.session?.scheduled_close_time)}) — safe to screenshot &amp; share with assistants now; students cannot scan until it starts.
                    </span>
                  </div>
                )}

                {effectiveStatus === 'CLOSED' && (
                  <div className="qr-status-banner closed">
                    <i className="fa-solid fa-circle-pause"></i>
                    <span>
                      Inactive — safe to screenshot &amp; share with assistants now; students cannot scan until you activate it or set a schedule.
                    </span>
                  </div>
                )}

                <div className="qr-box">
                  {qrLoading ? (
                    <p style={{ padding: '2rem', color: '#64748b', margin: 0 }}>Generating QR Code...</p>
                  ) : qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Static Event Attendance QR Code"
                      className="qr-rendered-image"
                    />
                  ) : (
                    <p style={{ padding: '2rem', color: '#dc2626', margin: 0 }}>
                      {qrError || 'QR Credential Unavailable'}
                    </p>
                  )}
                </div>

                {qrCreatedAt && (
                  <div className="qr-meta-timestamp">
                    QR Credential Issued: {formatDisplayDateTime(qrCreatedAt)}
                  </div>
                )}

                {qrError && qrDataUrl && (
                  <div className="schedule-feedback error">{qrError}</div>
                )}

                <div className="qr-actions-row">
                  <button
                    type="button"
                    className="btn-primary-maroon"
                    onClick={handleDownloadQr}
                    disabled={!qrDataUrl || qrLoading}
                  >
                    <i className="fa-solid fa-download"></i> Download QR
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-outline"
                    onClick={handleRegenerateQr}
                    disabled={qrLoading || regeneratingQr}
                  >
                    <i className="fa-solid fa-rotate"></i> {regeneratingQr ? 'Regenerating...' : 'Regenerate QR'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'records' && (
              <div className="records-table-container">
                <div className="records-filter-bar">
                  <input
                    type="text"
                    placeholder="Search by student name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', width: '260px' }}
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="NOT_MARKED">Not Marked</option>
                  </select>
                </div>

                <div className="table-responsive-wrapper">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Student Name</th>
                        <th>Status</th>
                        <th>Check-in Time</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                            No matching student records found.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r) => (
                          <tr key={r.id}>
                            <td>{r.student_id || 'N/A'}</td>
                            <td>{r.student_name}</td>
                            <td>
                              <span className={`status-badge ${r.status.toLowerCase()}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>{r.checkin_time ? new Date(r.checkin_time).toLocaleTimeString() : '—'}</td>
                            <td>
                              <button
                                className="btn-secondary-outline"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setSelectedRecord(r);
                                  setCorrectionStatus(r.status);
                                  setShowCorrectionModal(true);
                                }}
                              >
                                Correct
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Export Attendance Report</h3>
                <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  Download official attendance CSV for <strong>{eventData.event.title}</strong> including all verified check-in timestamps and audit corrections.
                </p>
                <button className="btn-primary-maroon" onClick={handleExportCSV}>
                  <i className="fa-solid fa-file-csv"></i> Export Attendance CSV
                </button>
              </div>
            )}
          </>
        )}

        {showCorrectionModal && selectedRecord && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Correct Attendance Record</h3>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem' }}>
                Student: <strong>{selectedRecord.student_name}</strong> ({selectedRecord.student_id})
              </p>

              <form onSubmit={handleSubmitCorrection}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>New Status</label>
                  <select
                    value={correctionStatus}
                    onChange={(e) => setCorrectionStatus(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="NOT_MARKED">NOT MARKED</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Reason for Correction (Required)
                  </label>
                  <textarea
                    rows="3"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="e.g., Student scanned late due to system delay..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
                    required
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary-outline" onClick={() => setShowCorrectionModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary-maroon">
                    Submit Correction
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MyPageDashboardLayout>
  );
}
