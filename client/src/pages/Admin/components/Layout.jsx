import { useEffect, useRef, useState } from "react";
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  ChevronDown,
  LayoutGrid,
  Users,
  Shield,
  Megaphone,
  Calendar,
  Eye,
  Settings,
  PenLine,
  LogOut,
  SlidersHorizontal,
  GraduationCap,
  Building2,
  Monitor,
} from "lucide-react";
import ProfileModal from "./ProfileModal.jsx";
import { useData } from "../context/DataContext.jsx";
import "../admin.css";

const MAIN = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/admin/users", label: "Manage users", icon: Users },
  { to: "/admin/page-requests", label: "Pages", icon: Shield },
  { to: "/admin/pages", label: "Manage Pages", icon: Megaphone },
];

const INSIGHTS = [
  { to: "/admin/archives", label: "Archives", icon: Calendar },
  { to: "/admin/reports", label: "Reports / Statistics", icon: Eye },
];

const NOTIFICATIONS = [
  { id: 1, text: "Enrollment opens today", unread: true },
  { id: 2, text: "University Week registration", unread: true },
  { id: 3, text: "CCS published a new post", unread: false },
];

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
    >
      <Icon size={20} /> {label}
    </NavLink>
  );
}

function DepartmentsRail() {
  const { pages } = useData();
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? pages : pages.slice(0, 6);

  return (
    <aside className="rail">
      <div className="rail-head">
        <h3>Departments</h3>
        <Link to="/admin/pages">View All</Link>
      </div>

      <Link to="/admin/pages" className="dept gold">
        <span className="dept-icon">
          <GraduationCap size={20} />
        </span>
        <span>
          <b>Western Mindanao State University</b>
          <span className="sub">General updates &amp; notices</span>
        </span>
      </Link>

      {list.map((p, i) => (
        <Link
          to="/admin/pages"
          key={p.id}
          className={"dept" + (i === 0 ? " rose" : "")}
        >
          <span className="dept-icon">
            {i === 0 ? <Monitor size={20} /> : <Building2 size={20} />}
          </span>
          <span>
            <b>{p.name}</b>
            <span className="sub">{p.dept}</span>
          </span>
        </Link>
      ))}

      {pages.length === 0 && <div className="empty">No pages yet.</div>}

      {pages.length > 6 && (
        <button className="see-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "See Less" : "See More"}
          <ChevronDown
            size={16}
            style={{ transform: showAll ? "rotate(180deg)" : "none" }}
          />
        </button>
      )}
    </aside>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { loading, error, refresh, profile, updateProfile } = useData();
  const [menu, setMenu] = useState(null); // "notif" | "user" | null
  const [profileOpen, setProfileOpen] = useState(false);
  const headerRef = useRef(null);
  const hasRail = pathname === "/admin/dashboard";
  let currentUser = {};
  try {
    currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  } catch (parseError) {
    console.error("Unable to read the signed-in administrator profile:", parseError);
  }
  const adminName = [profile?.firstName || currentUser.first_name, profile?.lastName || currentUser.last_name]
    .filter(Boolean)
    .join(" ") || "System Administrator";
  const adminEmail = profile?.email || currentUser.email || "";
  const initials = adminName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/auth", { replace: true });
  };

  useEffect(() => {
    const close = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target))
        setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="admin-app">
      <header className="topbar" ref={headerRef}>
        <Link to="/admin/dashboard" className="brand">
          <span className="wordmark">CRIMSON</span>
        </Link>

        <div className="search">
          <Search size={18} />
          <input placeholder="Search announcements, events, departments..." />
          <SlidersHorizontal size={18} />
        </div>

        <div className="top-actions">
          <div className="menu-wrap">
            <button
              className="icon-btn"
              onClick={() => setMenu(menu === "notif" ? null : "notif")}
              aria-label="Notifications"
            >
              <Bell size={22} />
              <span className="dot" />
            </button>
            {menu === "notif" && (
              <div className="dropdown notif">
                <h4>Notifications</h4>
                {NOTIFICATIONS.map((n) => (
                  <div className="notif-item" key={n.id}>
                    <span className={"bullet" + (n.unread ? " unread" : "")} />
                    {n.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <span className="vdivider" />

          <div className="menu-wrap">
            <button
              className="user-btn"
              onClick={() => setMenu(menu === "user" ? null : "user")}
            >
              <span className="avatar-wrap">
                <span className="avatar">{initials}</span>
                <span className="status-dot" />
              </span>
              <span className="user-text">
                <b>{adminName}</b>
                <span>{currentUser.role_name || "Administrator"}</span>
              </span>
              <ChevronDown size={18} />
            </button>
            {menu === "user" && (
              <div className="dropdown user">
                <div className="user-head">
                  <strong>{adminName}</strong>
                  <span>{adminEmail}</span>
                </div>
                <button
                  className="dd-item"
                  onClick={() => {
                    setProfileOpen(true);
                    setMenu(null);
                  }}
                >
                  <PenLine size={18} /> Account details
                </button>
                <button className="dd-item" onClick={signOut}>
                  <LogOut size={18} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={"shell" + (hasRail ? " has-rail" : "")}>
        <aside className="sidebar">
          <button className="side-profile" onClick={() => setProfileOpen(true)}>
            <span className="avatar">{initials}</span>
            <b>{adminName}</b>
          </button>

          <nav>
            <div className="nav-label">Main</div>
            {MAIN.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}

            <div className="nav-label">Insights</div>
            {INSIGHTS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}

            <div className="nav-label">System</div>
            <NavItem to="/admin/settings" label="System Settings" icon={Settings} />
            <button
              className="nav-item logout"
              onClick={signOut}
            >
              <LogOut size={20} /> Logout
            </button>
          </nav>
        </aside>

        <main className="content">
          {error && (
            <div className="assign-msg" role="alert">
              {error}
              <button
                className="btn-text"
                onClick={() => refresh().catch((retryError) => console.error("Admin data refresh failed:", retryError))}
              >
                Retry
              </button>
            </div>
          )}
          {loading && <div className="card empty">Loading administrator data…</div>}
          <Outlet />
        </main>

        {hasRail && <DepartmentsRail />}
      </div>

      {profileOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onSave={async (updates) => {
            const result = await updateProfile(updates);
            if (result?.profile) {
              localStorage.setItem(
                "user",
                JSON.stringify({
                  ...currentUser,
                  first_name: result.profile.firstName,
                  last_name: result.profile.lastName,
                }),
              );
              setProfileOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}
