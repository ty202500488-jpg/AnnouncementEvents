import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import NotificationFeedView from '../../../assets/components/NotificationFeedView';
import '../../styles/StudentDashboard.css';
import '../../styles/Notification.css';

export default function MyPageNotifications() {
  return (
    <MyPageDashboardLayout activeTab="notifications">
      <NotificationFeedView endpoint="/api/mypage/notifications" />
    </MyPageDashboardLayout>
  );
}
