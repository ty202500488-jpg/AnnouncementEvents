import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import ConfirmEmail from './pages/ConfirmEmail';

// Student Imports
import StudentDashboard from './pages/Student/StudentDashboard';
import StudentAnnouncements from './pages/Student/Announcements';
import StudentEvents from './pages/Student/Events';
import StudentProfile from './pages/Student/Profile';
import StudentNotifications from './pages/Student/Notification';
import StudentMyEvents from './pages/Student/MyEvents';
import StudentSettings from './pages/Student/Settings';
import StudentQRCheckIn from './pages/Student/StudentQRCheckIn';

// Staff Imports
import StaffDashboard from './pages/Staff/StaffDashboard';
import StaffAnnouncements from './pages/Staff/StaffAnnouncements';
import StaffEvents from './pages/Staff/StaffEvents';
import StaffMyPage from './pages/Staff/StaffMyPage';
import MyPageDashboard from './pages/Staff/MyPageDashboard/MyPageDashboard';
import MyPageProfile from './pages/Staff/MyPageDashboard/MyPageProfile';
import MyPageAnnouncements from './pages/Staff/MyPageDashboard/MyPageAnnouncements';
import MyPageEvents from './pages/Staff/MyPageDashboard/MyPageEvents';
import MyPageRegistration from './pages/Staff/MyPageDashboard/MyPageRegistration';
import MyPageAttendance from './pages/Staff/MyPageDashboard/MyPageAttendance';
import MyPageNotifications from './pages/Staff/MyPageDashboard/MyPageNotifications';
import MyPageSettings from './pages/Staff/MyPageDashboard/MyPageSettings';
import StaffProfile from './pages/Staff/StaffProfile';
import StaffNotifications from './pages/Staff/StaffNotification';
import StaffMyEvents from './pages/Staff/StaffMyEvents';
import StaffSettings from './pages/Staff/StaffSettings';
import StaffQRCheckIn from './pages/Staff/StaffQrCheckIn';

// Admin Imports
import AdminDashboard from './pages/Admin/AdminDashboard.jsx';
import ContentFeed from './pages/Admin/ContentFeed.jsx';
import UserManagement from './pages/Admin/UserManagement.jsx';
import PageManagement from './pages/Admin/PageManagement.jsx';
import PostApproval from './pages/Admin/PostApproval.jsx';
import Archives from './pages/Admin/Archives.jsx';
import Reports from './pages/Admin/Reports.jsx';
import AuditLogs from './pages/Admin/AuditLogs.jsx';
import SystemSettings from './pages/Admin/SystemSettings.jsx';
import AdminProfile from './pages/Admin/AdminProfile.jsx';
import PageView from './pages/Common/PageView';
import { ProtectedRoute, PublicOnlyRoute } from './assets/components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
        <Route path="/confirm-email" element={<ConfirmEmail />} />
        <Route path="/page/:pageId" element={<PageView role="guest" />} />

        {/* Student Routes (Strictly Protected for Student Role) */}
        <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/page/:pageId" element={<ProtectedRoute allowedRoles={['student']}><PageView role="student" /></ProtectedRoute>} />
        <Route path="/student/announcements" element={<ProtectedRoute allowedRoles={['student']}><StudentAnnouncements /></ProtectedRoute>} />
        <Route path="/student/events" element={<ProtectedRoute allowedRoles={['student']}><StudentEvents /></ProtectedRoute>} />
        <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfile /></ProtectedRoute>} />
        <Route path="/student/notifications" element={<ProtectedRoute allowedRoles={['student']}><StudentNotifications /></ProtectedRoute>} />
        <Route path="/student/my-events" element={<ProtectedRoute allowedRoles={['student']}><StudentMyEvents /></ProtectedRoute>} />
        <Route path="/student/settings" element={<ProtectedRoute allowedRoles={['student']}><StudentSettings /></ProtectedRoute>} />
        <Route path="/student/attendance/check-in/scan" element={<ProtectedRoute allowedRoles={['student']}><StudentQRCheckIn /></ProtectedRoute>} />
        <Route path="/student/attendance/check-in/:token" element={<ProtectedRoute allowedRoles={['student']}><StudentQRCheckIn /></ProtectedRoute>} />

        {/* Staff Routes (Strictly Protected for Staff Role) */}
        <Route path="/staff/dashboard" element={<ProtectedRoute allowedRoles={['staff']}><StaffDashboard /></ProtectedRoute>} />
        <Route path="/staff/page/:pageId" element={<ProtectedRoute allowedRoles={['staff']}><PageView role="staff" /></ProtectedRoute>} />
        <Route path="/staff/announcements" element={<ProtectedRoute allowedRoles={['staff']}><StaffAnnouncements /></ProtectedRoute>} />
        <Route path="/staff/events" element={<ProtectedRoute allowedRoles={['staff']}><StaffEvents /></ProtectedRoute>} />
        <Route path="/staff/mypage" element={<ProtectedRoute allowedRoles={['staff']}><StaffMyPage /></ProtectedRoute>} />

        {/* Mypage Routes (Strictly Protected for Staff Role) */}
        <Route 
          path="/staff/mypage/dashboard" 
          element={<ProtectedRoute allowedRoles={['staff']}><MyPageDashboard onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} /></ProtectedRoute>} 
        />
        <Route 
          path="/staff/mypage/profile" 
          element={<ProtectedRoute allowedRoles={['staff']}><MyPageProfile onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} /></ProtectedRoute>} 
        />
        <Route 
          path="/staff/mypage/announcements" 
          element={<ProtectedRoute allowedRoles={['staff']}><MyPageAnnouncements onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} /></ProtectedRoute>} 
        />
        <Route 
          path="/staff/mypage/events" 
          element={<ProtectedRoute allowedRoles={['staff']}><MyPageEvents onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} /></ProtectedRoute>} 
        />
        <Route 
          path="/staff/mypage/registrations" 
          element={<ProtectedRoute allowedRoles={['staff']}><MyPageRegistration onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} /></ProtectedRoute>} 
        />
        <Route 
          path="/staff/mypage/attendance" 
          element={<ProtectedRoute allowedRoles={['staff']}><MyPageAttendance onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} /></ProtectedRoute>} 
        />
        <Route 
          path="/staff/mypage/notifications" 
          element={<ProtectedRoute allowedRoles={['staff']}><MyPageNotifications onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} /></ProtectedRoute>} 
        />
        <Route
          path="/staff/mypage/settings"
          element={<ProtectedRoute allowedRoles={['staff']}><MyPageSettings onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} /></ProtectedRoute>}
        />
        
        <Route path="/staff/profile" element={<ProtectedRoute allowedRoles={['staff']}><StaffProfile /></ProtectedRoute>} />
        <Route path="/staff/notifications" element={<ProtectedRoute allowedRoles={['staff']}><StaffNotifications /></ProtectedRoute>} />
        <Route path="/staff/my-events" element={<ProtectedRoute allowedRoles={['staff']}><StaffMyEvents /></ProtectedRoute>} />
        <Route path="/staff/settings" element={<ProtectedRoute allowedRoles={['staff']}><StaffSettings /></ProtectedRoute>} />
        <Route path="/staff/attendance/check-in/scan" element={<ProtectedRoute allowedRoles={['staff']}><StaffQRCheckIn /></ProtectedRoute>} />
        <Route path="/staff/attendance/check-in/:token" element={<ProtectedRoute allowedRoles={['staff']}><StaffQRCheckIn /></ProtectedRoute>} />

        {/* Admin Routes (Strictly Protected for Administrator Role) */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/content-feed" element={<ProtectedRoute allowedRoles={['admin']}><ContentFeed /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
        <Route path="/admin/pages" element={<ProtectedRoute allowedRoles={['admin']}><PageManagement /></ProtectedRoute>} />
        <Route path="/admin/pages/:tab" element={<ProtectedRoute allowedRoles={['admin']}><PageManagement /></ProtectedRoute>} />
        <Route path="/admin/posts" element={<ProtectedRoute allowedRoles={['admin']}><PostApproval /></ProtectedRoute>} />
        <Route path="/admin/post-approval" element={<ProtectedRoute allowedRoles={['admin']}><PostApproval /></ProtectedRoute>} />
        <Route path="/admin/archives" element={<ProtectedRoute allowedRoles={['admin']}><Archives /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
        <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogs /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><SystemSettings /></ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />
        <Route path="/admin/mypage/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />

        {/* Fallback Catch-All Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;