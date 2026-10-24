import React, { useState, useEffect, useRef } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/MyPageAttendance.css';

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

  // QR Display State
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(30);
  const [qrLoading, setQrLoading] = useState(false);
  const qrTimerRef = useRef(null);

  // Correction Modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [correctionStatus, setCorrectionStatus] = useState('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  useEffect(() => {
    fetchAuthorizedEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchEventAttendanceData(selectedEventId);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (activeTab === 'qr' && selectedEventId && eventData?.session?.status === 'OPEN') {
      fetchQrCode();
      setQrCountdown(30);

      qrTimerRef.current = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            fetchQrCode();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(qrTimerRef.current);
    }

    return () => clearInterval(qrTimerRef.current);
  }, [activeTab, selectedEventId, eventData?.session?.status]);

  const fetchAuthorizedEvents = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:5000/api/mypage/attendance/events', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.events) {
        setEvents(data.events);
        if (data.events.length > 0) {
          setSelectedEventId(data.events[0].id);
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
  };

  const fetchEventAttendanceData = async (eventId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/mypage/attendance/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setEventData(data);
        setRecords(data.records || []);
      } else {
        setError(data.message || 'Failed to load event attendance info.');
      }
    } catch (err) {
      console.error('Error fetching event details:', err);
    }
  };

  const fetchQrCode = async () => {
    if (!selectedEventId) return;
    setQrLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/mypage/attendance/events/${selectedEventId}/qr-credential`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setQrCodeData(data.qrCredentialUrl || data.qrCodeData);
      } else {
        setQrCodeData(null);
      }
    } catch (err) {
      console.error('Failed to refresh QR:', err);
    } finally {
      setQrLoading(false);
    }
  };

  const handleToggleAttendanceWindow = async (action) => {
    if (!window.confirm(`Are you sure you want to ${action} the attendance window?`)) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/mypage/attendance/events/${selectedEventId}/window`, {
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

  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      alert('A reason is required for manual attendance correction.');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/mypage/attendance/records/${selectedRecord.id}/correct`, {
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

  const handleExportCSV = () => {
    if (!selectedEventId) return;
    const token = localStorage.getItem('token');
    window.open(`http://localhost:5000/api/mypage/attendance/events/${selectedEventId}/export?token=${token}`, '_blank');
  };

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
              <p>Manage real-time check-ins and attendance records for published events.</p>
            </div>

            <div className="event-selector-box">
              <label htmlFor="eventSelect">Select Event</label>
              <select
                id="eventSelect"
                className="event-select-dropdown"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
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
                <span className={`status-badge ${eventData.session?.status?.toLowerCase() || 'closed'}`}>
                  Window: {eventData.session?.status || 'Closed'}
                </span>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                {eventData.event.title}
              </h2>

              <div className="event-info-grid">
                <div className="event-info-item">
                  <i className="fa-regular fa-calendar"></i>
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
              <div className="window-time-info">
                <div>
                  <strong>Window Start:</strong>{' '}
                  {eventData.session?.open_time ? new Date(eventData.session.open_time).toLocaleTimeString() : 'Not set'}
                </div>
                <div>
                  <strong>Window End:</strong>{' '}
                  {eventData.session?.close_time ? new Date(eventData.session.close_time).toLocaleTimeString() : 'Not set'}
                </div>
              </div>

              <div className="action-buttons-group">
                {eventData.session?.status !== 'OPEN' ? (
                  <button className="btn-primary-maroon" onClick={() => handleToggleAttendanceWindow('OPEN')}>
                    <i className="fa-solid fa-door-open"></i> Open Attendance
                  </button>
                ) : (
                  <button className="btn-secondary-outline" onClick={() => handleToggleAttendanceWindow('CLOSE')}>
                    <i className="fa-solid fa-door-closed"></i> Close Attendance
                  </button>
                )}
              </div>
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
                  Live QR Display
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
              <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Attendance Window Guidelines</h3>
                <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                  Opening the attendance window allows students to scan the live event QR code displayed on this page.
                  When the session closes, any eligible student who has not checked in will automatically be recorded as <strong>Absent</strong>.
                </p>
              </div>
            )}

            {activeTab === 'qr' && (
              <div className="qr-display-container">
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Scan QR Code for Check-in</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                  Display this QR on screen for attending students to scan with their mobile devices.
                </p>

                {eventData.session?.status === 'OPEN' ? (
                  <>
                    <div className="qr-box">
                      {qrLoading ? (
                        <p style={{ padding: '2rem' }}>Refreshing QR Token...</p>
                      ) : qrCodeData ? (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCodeData)}`}
                          alt="Live Attendance QR Code"
                          style={{ width: '220px', height: '220px' }}
                        />
                      ) : (
                        <p style={{ padding: '2rem', color: '#dc2626' }}>QR Credential Unavailable</p>
                      )}
                    </div>

                    <div className="qr-timer-badge">
                      <i className="fa-solid fa-arrows-rotate"></i> Refreshing QR in {qrCountdown}s
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '2rem 1rem', color: '#94a3b8' }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}></i>
                    <p style={{ margin: 0 }}>Attendance window is currently CLOSED. Open window to display QR.</p>
                  </div>
                )}
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