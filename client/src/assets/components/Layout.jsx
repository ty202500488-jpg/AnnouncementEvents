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
  Menu,
  X,
} from "lucide-react";
import ProfileModal from "./ProfileModal.jsx";
import { useData } from "../../pages/Admin/context/DataContext.jsx";
import "../../pages/styles/admin.css";
import logo from "../../assets/images/logo.jpg";
import useSessionGuard from "./useSessionGuard";

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

function NavItem({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
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
  useSessionGuard();
  const { loading, error, refresh, profile, updateProfile } = useData();
  const [menu, setMenu] = useState(null); // "notif" | "user" | null
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  const userRole = currentUser.role_name || "Administrator";

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
    <div className="admin-app" style={{ minHeight: "100vh" }}>
      <style>{`
        /* Hide mobile elements on desktop screens */
        @media (min-width: 1024px) {
          .admin-mobile-bottom-nav,
          .mobile-menu-btn {
            display: none !important;
          }
        }

        /* Sidebar Profile Header Spacing and Formatting */
        .side-profile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.25rem 1rem 0.25rem;
          margin-bottom: 0.75rem;
          border-bottom: 1px solid var(--admin-line, #e6ebf0);
        }

        .side-profile-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          text-align: left;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          width: 100%;
        }

        .side-profile-info b {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--admin-ink, #16162b);
          line-height: 1.25;
          word-break: break-word;
        }

        .side-profile-info span {
          font-size: 0.75rem;
          color: var(--admin-muted, #64748b);
          line-height: 1.2;
        }

        /* Mobile Layout & Mobile Drawer Fixes */
        @media (max-width: 1023px) {
          .admin-app {
            padding-bottom: 4.5rem !important;
          }

          /* Hide rail sidebar on mobile */
          .rail {
            display: none !important;
          }

          /* Shell grid layout fix for mobile */
          .shell,
          .shell.has-rail {
            display: block !important;
            padding: 1rem !important;
          }

          /* Sidebar hidden by default on mobile unless drawer active */
          .sidebar:not(.mobile-sidebar-active) {
            display: none !important;
          }

          /* Mobile drawer layout styling */
          .sidebar.mobile-sidebar-active {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 280px !important;
            height: 100vh !important;
            z-index: 50 !important;
            background-color: #ffffff !important;
            box-shadow: 10px 0 25px rgba(0, 0, 0, 0.15) !important;
            overflow-y: auto !important;
            padding: 1.25rem 1rem !important;
          }

          /* Table responsiveness on mobile */
          .table-card {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }
        }

        /* Small screen header adjustments */
        @media (max-width: 640px) {
          .user-text {
            display: none !important;
          }
          .topbar {
            gap: 0.5rem !important;
            padding: 0.5rem 0.75rem !important;
          }
          .search input {
            font-size: 0.8125rem !important;
          }
        }
      `}</style>

      {/* TOPBAR */}
      <header className="topbar" ref={headerRef} style={{ position: "sticky", top: 0, zIndex: 40, backgroundColor: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <button
            type="button"
            className="mobile-menu-btn icon-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{ color: "var(--slate-600)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
            aria-label="Toggle Menu"
          >
            <Menu size={22} />
          </button>

          <Link to="/admin/dashboard" className="brand" style={{ display: "flex", alignItems: "center" }}>
            <img
              src={logo}
              alt="CRIMSON Logo"
              style={{
                height: "38px",
                width: "38px",
                objectFit: "contain",
                borderRadius: "50%",
              }}
            />
          </Link>
        </div>

        <div className="search" style={{ position: "relative", flex: "1 1 auto", maxWidth: "480px" }}>
          <Search size={18} />
          <input placeholder="Search announcements, events, departments..." />
          <SlidersHorizontal size={18} />
        </div>

        <div className="top-actions" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
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
              <div className="dropdown notif" style={{ right: 0 }}>
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
              <span className="user-text">
                <b>{adminName}</b>
                <span>{userRole}</span>
              </span>
              <ChevronDown size={18} />
            </button>
            {menu === "user" && (
              <div className="dropdown user" style={{ right: 0 }}>
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

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 45,
          }}
        />
      )}

      {/* MAIN SHELL */}
      <div className={"shell" + (hasRail ? " has-rail" : "")}>
        <aside className={`sidebar ${isMobileMenuOpen ? "mobile-sidebar-active" : ""}`}>
          <div className="side-profile-header">
            <button
              className="side-profile-info"
              onClick={() => {
                setProfileOpen(true);
                setIsMobileMenuOpen(false);
              }}
            >
              <b>{adminName}</b>
              <span>{userRole}</span>
            </button>

            {isMobileMenuOpen && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  color: "var(--slate-600)",
                  background: "none",
                  border: "none",
                  padding: "0.25rem",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            )}
          </div>

          <nav>
            <div className="nav-label">Main</div>
            {MAIN.map((item) => (
              <NavItem key={item.to} {...item} onClick={() => setIsMobileMenuOpen(false)} />
            ))}

            <div className="nav-label">Insights</div>
            {INSIGHTS.map((item) => (
              <NavItem key={item.to} {...item} onClick={() => setIsMobileMenuOpen(false)} />
            ))}

            <div className="nav-label">System</div>
            <NavItem to="/admin/settings" label="System Settings" icon={Settings} onClick={() => setIsMobileMenuOpen(false)} />
            <button className="nav-item logout" onClick={signOut}>
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
                onClick={() =>
                  refresh().catch((retryError) =>
                    console.error("Admin data refresh failed:", retryError)
                  )
                }
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

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        className="admin-mobile-bottom-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "56px",
          backgroundColor: "#ffffff",
          borderTop: "1px solid var(--slate-200, #e2e8f0)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 40,
          boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.05)",
        }}
      >
        <NavLink
          to="/admin/dashboard"
          end
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#881337" : "var(--slate-500, #64748b)",
          })}
        >
          <LayoutGrid size={18} />
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/admin/users"
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#881337" : "var(--slate-500, #64748b)",
          })}
        >
          <Users size={18} />
          <span>Users</span>
        </NavLink>

        <NavLink
          to="/admin/page-requests"
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#881337" : "var(--slate-500, #64748b)",
          })}
        >
          <Shield size={18} />
          <span>Requests</span>
        </NavLink>

        <NavLink
          to="/admin/pages"
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#881337" : "var(--slate-500, #64748b)",
          })}
        >
          <Megaphone size={18} />
          <span>Pages</span>
        </NavLink>

        <NavLink
          to="/admin/settings"
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#881337" : "var(--slate-500, #64748b)",
          })}
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </nav>

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
                })
              );
              setProfileOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}