import DashboardLayout from '../../assets/components/DashboardLayout';
import NotificationFeedView from '../../assets/components/NotificationFeedView';
import '../styles/StudentDashboard.css';
import '../styles/Notification.css';

export default function Notifications() {
  return (
    <DashboardLayout activePage="notifications">
      <NotificationFeedView endpoint="/api/student/notifications" />
    </DashboardLayout>
  );
}
