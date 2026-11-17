import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import NotificationFeedView from '../../assets/components/NotificationFeedView';
import '../styles/StaffDashboard.css';
import '../styles/Notification.css';

export default function StaffNotifications() {
  return (
    <StaffDashboardLayout activePage="notifications">
      <NotificationFeedView endpoint="/api/staff/notifications" />
    </StaffDashboardLayout>
  );
}
