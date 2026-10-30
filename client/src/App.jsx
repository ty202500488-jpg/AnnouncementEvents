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

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/confirm-email" element={<ConfirmEmail />} />

        {/* Student Routes */}
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/announcements" element={<StudentAnnouncements />} />
        <Route path="/student/events" element={<StudentEvents />} />
        <Route path="/student/profile" element={<StudentProfile />} />
        <Route path="/student/notifications" element={<StudentNotifications />} />
        <Route path="/student/my-events" element={<StudentMyEvents />} />
        <Route path="/student/settings" element={<StudentSettings />} />
        <Route path="/student/attendance/check-in/scan" element={<StudentQRCheckIn />} />
        <Route path="/student/attendance/check-in/:token" element={<StudentQRCheckIn />} />

        {/* Staff Routes */}
        <Route path="/staff/dashboard" element={<StaffDashboard />} />
        <Route path="/staff/announcements" element={<StaffAnnouncements />} />
        <Route path="/staff/events" element={<StaffEvents />} />
        <Route path="/staff/mypage" element={<StaffMyPage />} />

        {/* Mypage Routes */}
        <Route 
          path="/staff/mypage/dashboard" 
          element={<MyPageDashboard onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} />} 
        />
        <Route 
          path="/staff/mypage/profile" 
          element={<MyPageProfile onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} />} 
        />
        <Route 
          path="/staff/mypage/announcements" 
          element={<MyPageAnnouncements onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} />} 
        />
        <Route 
          path="/staff/mypage/events" 
          element={<MyPageEvents onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} />} 
        />
        <Route 
          path="/staff/mypage/registrations" 
          element={<MyPageRegistration onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} />} 
        />
        <Route 
          path="/staff/mypage/attendance" 
          element={<MyPageAttendance onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} />} 
        />
        <Route 
          path="/staff/mypage/notifications" 
          element={<MyPageNotifications onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} />} 
        />
        <Route
          path="/staff/mypage/settings"
          element={<MyPageSettings onSwitchToStaffDashboard={() => window.location.href = '/staff/dashboard'} />}
        />
        
        <Route path="/staff/profile" element={<StaffProfile />} />
        <Route path="/staff/notifications" element={<StaffNotifications />} />
        <Route path="/staff/my-events" element={<StaffMyEvents />} />
        <Route path="/staff/settings" element={<StaffSettings />} />
        <Route path="/staff/attendance/check-in/scan" element={<StaffQRCheckIn />} />
        <Route path="/staff/attendance/check-in/:token" element={<StaffQRCheckIn />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/content-feed" element={<ContentFeed />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/pages" element={<PageManagement />} />
        <Route path="/admin/posts" element={<PostApproval />} />
        <Route path="/admin/post-approval" element={<PostApproval />} />
        <Route path="/admin/archives" element={<Archives />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/audit-logs" element={<AuditLogs />} />
        <Route path="/admin/settings" element={<SystemSettings />} />
        <Route path="/admin/*" element={<AdminDashboard />} />

        {/* Fallback Catch-All Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;