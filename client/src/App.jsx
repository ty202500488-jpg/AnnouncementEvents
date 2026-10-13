import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import ConfirmEmail from './pages/ConfirmEmail';
import StudentDashboard from './pages/Student/StudentDashboard';
import Profile from './pages/Student/Profile';
import Notifications from './pages/Student/Notification';
import Settings from './pages/Student/Settings';
import HelpSupport from './pages/Student/HelpSupport';
import StaffDashboard from './pages/Staff/StaffDashboard';
import MyPage from './pages/Staff/MyPage';
import AdminDashboard from './pages/Admin/AdminDashboard';

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
        <Route path="/student/profile" element={<Profile />} />
        <Route path="/student/notifications" element={<Notifications />} />
        <Route path="/student/help" element={<HelpSupport />} />
        <Route path="/student/settings" element={<Settings />} />

        {/* Staff & Page Management Routes */}
        <Route path="/staff/dashboard" element={<StaffDashboard />} />
        <Route path="/staff/mypage" element={<MyPage />} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Fallback Catch-All Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;