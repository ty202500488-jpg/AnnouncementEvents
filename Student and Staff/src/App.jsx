import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { PortalProvider } from "./context/PortalContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Announcements from "./pages/Announcements";
import Events from "./pages/Events";
import Departments from "./pages/Departments";
import MyEvents from "./pages/MyEvents";
import Attendance from "./pages/Attendance";
import MyPage from "./pages/MyPage";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import Help from "./pages/Help";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

// pages both roles use (the page reads the role from the URL: /staff/... = staff)
const shared = [
  ["announcements", <Announcements />],
  ["events", <Events />],
  ["depts", <Departments />],
  ["profile", <Profile />],
  ["notifications", <Notifications />],
  ["help", <Help />],
  ["settings", <Settings />],
];

export default function App() {
  return (
    <BrowserRouter>
      <PortalProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* student */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            {shared.map(([p, el]) => <Route key={p} path={p} element={el} />)}
            <Route path="myevents" element={<MyEvents />} />
          </Route>

          {/* staff */}
          <Route path="/staff" element={<Layout />}>
            <Route index element={<Home />} />
            {shared.map(([p, el]) => <Route key={p} path={p} element={el} />)}
            <Route path="mypage" element={<MyPage />} />
            <Route path="attendance" element={<Attendance />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PortalProvider>
    </BrowserRouter>
  );
}
