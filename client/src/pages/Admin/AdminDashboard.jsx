import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import '../styles/Overview.css';

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Dashboard Data State
  const [stats, setStats] = useState({
    pendingVerifications: 0,
    pendingApprovals: 0,
    pendingPages: 0,
    verifiedStudents: 0
  });

  const [pendingTasks, setPendingTasks] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [adminUser, setAdminUser] = useState(null);

  // Status & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Read Authenticated Administrator Session
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setAdminUser(parsed);
      } catch (e) {
        console.error('Failed to parse admin session:', e);
      }
    }
  }, []);

  // Fetch Dashboard Overview Data
  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('http://localhost:5000/api/admin/overview', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setStats({
          pendingVerifications: data.counts?.pendingVerifications || 0,
          pendingApprovals: data.counts?.pendingApprovals || 0,
          pendingPages: data.counts?.pendingPages || 0,
          verifiedStudents: data.counts?.verifiedStudents || 0
        });
        setPendingTasks(data.pendingTasks || []);
        setRecentActivities(data.recentActivities || []);
      } else {
        throw new Error(data.message || 'Failed to load dashboard operational statistics.');
      }
    } catch (err) {
      console.error('Overview Data Fetching Error:', err);
      setError(err.message || 'Unable to connect to administration server.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Formatted Date
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <AdminLayout>
      <div className="admin-overview-wrapper">
        
        {/* ================= PAGE HEADER ================= */}
        <div className="overview-header-bar">
          <div>
            <h1 className="overview-title">Overview</h1>
            <p className="overview-subtitle">
              Welcome back{adminUser?.first_name ? `, ${adminUser.first_name}` : ''}. Monitor campus activity, pending administrative tasks, and system operations.
            </p>
          </div>
          <div className="overview-header-actions">
            <span className="overview-date-badge">
              <i className="fa-regular fa-calendar" style={{ marginRight: '6px' }}></i>
              {currentDate}
            </span>
            <button 
              type="button" 
              className="btn-overview-refresh" 
              onClick={fetchOverviewData}
              disabled={loading}
              title="Reload Overview Data"
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'spin-icon' : ''}`}></i>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ERROR ALERT BAR */}
        {error && (
          <div className="overview-alert-banner">
            <div className="alert-content">
              <i className="fa-solid fa-triangle-exclamation alert-icon"></i>
              <span>{error}</span>
            </div>
            <button type="button" className="btn-alert-retry" onClick={fetchOverviewData}>
              Retry Request
            </button>
          </div>
        )}

        {/* ================= SUMMARY CARDS ================= */}
        <div className="overview-summary-grid">
          
          {/* Card 1: Pending Student Verifications */}
          <div 
            className="summary-card pointer-card"
            onClick={() => navigate('/admin/users?filter=pending')}
          >
            <div className="summary-card-body">
              <div>
                <span className="card-label">Pending Verifications</span>
                <div className="card-value">
                  {loading ? <div className="skeleton-line width-50"></div> : stats.pendingVerifications}
                </div>
                <span className="card-status-badge status-amber">Pending Review</span>
              </div>
              <div className="card-icon-box maroon-box">
                <i className="fa-solid fa-user-check"></i>
              </div>
            </div>
          </div>

          {/* Card 2: Pending Post/Event Approvals */}
          <div 
            className="summary-card pointer-card"
            onClick={() => navigate('/admin/post-approval?filter=pending')}
          >
            <div className="summary-card-body">
              <div>
                <span className="card-label">Pending Approvals</span>
                <div className="card-value">
                  {loading ? <div className="skeleton-line width-50"></div> : stats.pendingApprovals}
                </div>
                <span className="card-status-badge status-amber">Awaiting Decision</span>
              </div>
              <div className="card-icon-box maroon-box">
                <i className="fa-solid fa-file-circle-check"></i>
              </div>
            </div>
          </div>

          {/* Card 3: Pending Page Requests */}
          <div 
            className="summary-card pointer-card"
            onClick={() => navigate('/admin/pages?filter=pending')}
          >
            <div className="summary-card-body">
              <div>
                <span className="card-label">Page Requests</span>
                <div className="card-value">
                  {loading ? <div className="skeleton-line width-50"></div> : stats.pendingPages}
                </div>
                <span className="card-status-badge status-blue">Pending Review</span>
              </div>
              <div className="card-icon-box maroon-box">
                <i className="fa-solid fa-layer-group"></i>
              </div>
            </div>
          </div>

          {/* Card 4: Verified Students */}
          <div 
            className="summary-card pointer-card"
            onClick={() => navigate('/admin/users?filter=verified')}
          >
            <div className="summary-card-body">
              <div>
                <span className="card-label">Verified Students</span>
                <div className="card-value">
                  {loading ? <div className="skeleton-line width-50"></div> : stats.verifiedStudents}
                </div>
                <span className="card-status-badge status-green">Verified</span>
              </div>
              <div className="card-icon-box dark-maroon-box">
                <i className="fa-solid fa-id-card"></i>
              </div>
            </div>
          </div>

        </div>

        {/* ================= MAIN CONTENT SPLIT ================= */}
        <div className="overview-main-grid">
          
          {/* LEFT COLUMN: PENDING TASKS & RECENT ACTIVITY */}
          <div className="overview-left-col">

            {/* SECTION: PENDING TASKS */}
            <div className="overview-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">
                  <i className="fa-solid fa-list-check title-icon"></i>
                  Pending Administrative Tasks
                </h2>
                <button 
                  type="button" 
                  className="section-link-btn"
                  onClick={() => navigate('/admin/post-approval')}
                >
                  View All
                </button>
              </div>

              <div className="section-card-body">
                {loading ? (
                  <div className="skeleton-container">
                    <div className="skeleton-line width-100 height-40"></div>
                    <div className="skeleton-line width-100 height-40"></div>
                    <div className="skeleton-line width-100 height-40"></div>
                  </div>
                ) : pendingTasks.length === 0 ? (
                  <div className="overview-empty-state">
                    <i className="fa-solid fa-circle-check empty-icon"></i>
                    <p className="empty-text">You're all caught up! No pending tasks require your attention.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="overview-data-table">
                      <thead>
                        <tr>
                          <th>Task Type</th>
                          <th>Subject / Name</th>
                          <th>Submitted By</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingTasks.map((task, idx) => (
                          <tr key={task.id || idx}>
                            <td>
                              <span className="task-type-pill">
                                {task.type}
                              </span>
                            </td>
                            <td className="font-semibold text-slate-800">{task.title}</td>
                            <td>{task.submittedBy}</td>
                            <td className="text-slate-500">{new Date(task.date).toLocaleDateString()}</td>
                            <td>
                              <span className="card-status-badge status-amber">
                                {task.status || 'Pending'}
                              </span>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="table-action-btn"
                                onClick={() => navigate(task.route || '/admin')}
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION: RECENT ADMINISTRATIVE ACTIVITY */}
            <div className="overview-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">
                  <i className="fa-solid fa-clock-rotate-left title-icon"></i>
                  Recent Administrative Activity
                </h2>
                <button 
                  type="button" 
                  className="section-link-btn"
                  onClick={() => navigate('/admin/audit-logs')}
                >
                  View Audit Logs
                </button>
              </div>

              <div className="section-card-body">
                {loading ? (
                  <div className="skeleton-container">
                    <div className="skeleton-line width-100 height-30"></div>
                    <div className="skeleton-line width-100 height-30"></div>
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="overview-empty-state">
                    <i className="fa-solid fa-box-open empty-icon"></i>
                    <p className="empty-text">No recent administrative logs recorded.</p>
                  </div>
                ) : (
                  <ul className="activity-timeline">
                    {recentActivities.map((act, idx) => (
                      <li key={act.id || idx} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <div className="timeline-row">
                            <span className="timeline-actor">{act.actor_name || 'Administrator'}</span>
                            <span className="timeline-time">{new Date(act.timestamp || act.created_at).toLocaleString()}</span>
                          </div>
                          <p className="timeline-desc">
                            <span className="timeline-action">{act.action}</span>: {act.target || act.details}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: QUICK ACTIONS & SYSTEM STATUS */}
          <div className="overview-right-col">
            
            {/* QUICK ACTIONS CARD */}
            <div className="overview-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">
                  <i className="fa-solid fa-bolt title-icon"></i>
                  Quick Shortcuts
                </h2>
              </div>
              <div className="section-card-body">
                <div className="quick-actions-list">
                  
                  <button 
                    type="button" 
                    className="quick-action-btn"
                    onClick={() => navigate('/admin/users?filter=pending')}
                  >
                    <div className="action-icon-circle maroon-bg">
                      <i className="fa-solid fa-user-check"></i>
                    </div>
                    <div className="action-text">
                      <span className="action-title">Verify Students</span>
                      <span className="action-sub">Review manual student accounts</span>
                    </div>
                    <i className="fa-solid fa-chevron-right action-arrow"></i>
                  </button>

                  <button 
                    type="button" 
                    className="quick-action-btn"
                    onClick={() => navigate('/admin/post-approval')}
                  >
                    <div className="action-icon-circle maroon-bg">
                      <i className="fa-solid fa-file-circle-check"></i>
                    </div>
                    <div className="action-text">
                      <span className="action-title">Post & Event Approvals</span>
                      <span className="action-sub">Approve staff submissions</span>
                    </div>
                    <i className="fa-solid fa-chevron-right action-arrow"></i>
                  </button>

                  <button 
                    type="button" 
                    className="quick-action-btn"
                    onClick={() => navigate('/admin/pages')}
                  >
                    <div className="action-icon-circle maroon-bg">
                      <i className="fa-solid fa-layer-group"></i>
                    </div>
                    <div className="action-text">
                      <span className="action-title">Page Requests</span>
                      <span className="action-sub">Manage organization pages</span>
                    </div>
                    <i className="fa-solid fa-chevron-right action-arrow"></i>
                  </button>

                  <button 
                    type="button" 
                    className="quick-action-btn"
                    onClick={() => navigate('/admin/content-feed')}
                  >
                    <div className="action-icon-circle maroon-bg">
                      <i className="fa-solid fa-newspaper"></i>
                    </div>
                    <div className="action-text">
                      <span className="action-title">Content Feed</span>
                      <span className="action-sub">View active campus updates</span>
                    </div>
                    <i className="fa-solid fa-chevron-right action-arrow"></i>
                  </button>

                  <button 
                    type="button" 
                    className="quick-action-btn"
                    onClick={() => navigate('/admin/reports')}
                  >
                    <div className="action-icon-circle maroon-bg">
                      <i className="fa-solid fa-chart-line"></i>
                    </div>
                    <div className="action-text">
                      <span className="action-title">System Reports</span>
                      <span className="action-sub">Analyze usage metrics</span>
                    </div>
                    <i className="fa-solid fa-chevron-right action-arrow"></i>
                  </button>

                </div>
              </div>
            </div>

            {/* SYSTEM STATUS CARD */}
            <div className="overview-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">
                  <i className="fa-solid fa-shield-halved title-icon"></i>
                  System Status
                </h2>
              </div>
              <div className="section-card-body">
                <div className="system-status-box">
                  <div className="status-indicator-dot online"></div>
                  <div>
                    <div className="status-text-title">WMSU Portal Active</div>
                    <div className="status-text-sub">PostgreSQL services connected</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;