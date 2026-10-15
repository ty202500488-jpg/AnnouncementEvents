import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { usePortal } from "../context/PortalContext";
import { DEPTS } from "../data/seed";
import { PHOTO, onImgError } from "./Avatar";
import ProfileModal from "./ProfileModal";
import Modals from "./Modals";
import Gate from "./Gate";

export default function Layout() {
  const { S, U, P, staff, base, q, setQ, setDept, resetFilters, setModal, toast, nav } = usePortal();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accOpen, setAccOpen] = useState(false);
  const [more, setMore] = useState(false);

  const home = base || "/";
  const NAV = staff
    ? [
        { title: "Main", items: [[home, "Home", "fa-solid fa-house"], [base + "/announcements", "Announcements", "fa-solid fa-bullhorn"], [base + "/events", "Events", "fa-regular fa-calendar-days"], [base + "/mypage", "My Page", "fa-solid fa-flag"], [base + "/attendance", "Register and Attendance", "fa-solid fa-building-columns"]] },
        { title: "Personal", items: [[base + "/profile", "Profile", "fa-solid fa-user"], [base + "/notifications", "Notifications", "fa-solid fa-bell"]] },
        { title: "System", items: [[base + "/help", "Help & Support", "fa-solid fa-circle-info"], [base + "/settings", "Settings", "fa-solid fa-gear"]] },
      ]
    : [
        { title: "Main", items: [[home, "Home", "fa-solid fa-house"], ["/announcements", "Announcements", "fa-solid fa-bullhorn"], ["/events", "Events", "fa-regular fa-calendar-days"]] },
        { title: "Personal", items: [["/profile", "Profile", "fa-regular fa-user"], ["/notifications", "Notifications", "fa-regular fa-bell"], ["/myevents", "My Events", "fa-solid fa-building-columns"]] },
        { title: "System", items: [["/help", "Help & Support", "fa-solid fa-circle-info"], ["/settings", "Settings", "fa-solid fa-gear"]] },
      ];

  const name = staff ? P.short + " Council" : U.name;
  const sub = staff ? "Staff" : U.course;
  const unread = S.notifs.some((n) => n.for === (staff ? "staff" : "student") && !n.read);

  const myDept = staff ? P.dept : U.dept;
  const top = [DEPTS[0], DEPTS.find((d) => d[0] === myDept) || DEPTS[1]];
  const rest = DEPTS.filter((d) => !top.includes(d));
  const vis = more ? rest : rest.slice(0, 6);

  const row = (d, c = "", b = "") => (
    <a key={d[0]} href="#" className={`dept-item ${c}`} onClick={(e) => { e.preventDefault(); setDept(d[0]); setQ(""); nav(home); window.scrollTo(0, 0); }}>
      <div className={`dept-badge ${b}`}><i className={`fa-solid fa-${d[3]}`}></i></div>
      <div className="dept-info"><span className="dept-title">{d[1]}</span><span className="dept-sub">{d[2]}</span></div>
    </a>
  );

  const askLogout = () => { setMenuOpen(false); setAccOpen(false); setModal({ type: "logout" }); };
  const feedPaths = [home, base + "/announcements", base + "/events"];

  return (
    <>
      <header className="header">
        <div className="header-container">
          <div className="flex items-center gap-3">
            <button className="mobile-menu-btn icon-btn" style={{ color: "var(--slate-600)" }} onClick={() => setMenuOpen(!menuOpen)}>
              <i className="fa-solid fa-bars" style={{ fontSize: "1.25rem" }}></i>
            </button>
            <h1 style={{ fontFamily: "'Bungee', sans-serif", fontWeight: 700, color: "#561C24", fontSize: "1.525rem", lineHeight: 1.2, letterSpacing: "-0.025em" }}>
              CRIM<span style={{ color: "#881337" }}>SON</span>
            </h1>
          </div>

          <div className="search-container">
            <div className="search-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input type="text" className="search-input" placeholder="Search Announcements, Events, Departments..." value={q}
                onChange={(e) => { setQ(e.target.value); if (!feedPaths.includes(pathname)) nav(home); }} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="icon-btn" onClick={() => nav(base + "/notifications")}>
              <i className="fa-regular fa-bell" style={{ fontSize: "1rem" }}></i>
              {unread && <span className="badge-dot"></span>}
            </button>
            <div className="divider-v"></div>
            <div className="profile-btn" role="button" tabIndex={0} aria-haspopup="menu" aria-expanded={accOpen}
              onClick={() => setAccOpen(!accOpen)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAccOpen(!accOpen); } }}>
              <div className="avatar-wrapper">
                <img src={PHOTO} alt={name} className="avatar-img" onError={onImgError} />
                <span className="online-status"></span>
              </div>
              <div className="hidden-sm" style={{ display: "none", textAlign: "left", paddingRight: "0.25rem" }}>
                <div style={{ fontWeight: 600, color: "var(--slate-800)", fontSize: "0.75rem", lineHeight: 1.2 }}>{name}</div>
                <div style={{ fontSize: "11px", color: "var(--slate-500)", lineHeight: 1.2 }}>{sub}</div>
              </div>
              <i className="fa-solid fa-chevron-down hidden-sm" style={{ display: "none", color: "var(--slate-400)", fontSize: "10px", paddingRight: "0.25rem" }}></i>
            </div>
          </div>
        </div>
      </header>

      {accOpen && <ProfileModal onClose={() => setAccOpen(false)} onLogout={askLogout} />}

      <div className="main-container">
        {/* LEFT SIDEBAR */}
        <aside id="leftSidebar" className={`lg-col-3 space-y-6 hidden lg-block ${menuOpen ? "mobile-sidebar-active" : ""}`}>
          <div className="card space-y-5" style={{ padding: "1rem" }}>
            <div style={{ paddingTop: "0.75rem", borderBottom: "1px solid var(--slate-200)" }}>
              <div className="flex items-center gap-3" style={{ padding: "0.5rem 0.75rem" }}>
                <img src={PHOTO} alt={name} className="avatar-img" onError={onImgError} />
                <span style={{ fontWeight: 600, color: "var(--slate-800)", fontSize: "0.875rem" }}>{name}</span>
                {menuOpen && <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setMenuOpen(false)}><i className="fa-solid fa-xmark"></i></button>}
              </div>
            </div>

            {NAV.map((g) => (
              <div key={g.title}>
                <div className="nav-group-title">{g.title}</div>
                <nav className="space-y-1">
                  {g.items.map(([to, label, icon]) => (
                    <NavLink key={to} to={to} end={to === home}
                      onClick={() => { resetFilters(); setMenuOpen(false); window.scrollTo(0, 0); }}
                      className={({ isActive }) => `nav-item ${isActive ? "active btn-nav" : ""}`}>
                      <div className="nav-item-content"><i className={`${icon} nav-icon`}></i><span>{label}</span></div>
                    </NavLink>
                  ))}
                  {g.title === "System" && (
                    <a href="#" className="nav-item" style={{ color: "var(--rose-600)" }} onClick={(e) => { e.preventDefault(); askLogout(); }}>
                      <div className="nav-item-content">
                        <i className="fa-solid fa-right-from-bracket nav-icon" style={{ color: "var(--rose-600)" }}></i><span>Logout</span>
                      </div>
                    </a>
                  )}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER: the current page */}
        <main className="lg-col-6 space-y-6"><Outlet /></main>

        {/* RIGHT SIDEBAR */}
        <aside className="lg-col-3 space-y-6">
          <div className="card" style={{ padding: "1.25rem" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontWeight: 700, color: "var(--slate-900)", fontSize: "0.875rem" }}>Departments</h3>
              <span style={{ color: "var(--brand-600)", fontSize: "11px", fontWeight: 700, padding: "0.125rem 0.5rem", cursor: "pointer" }} onClick={() => nav(base + "/depts")}>View All</span>
            </div>
            <div className="dept-list space-y-2">
              {row(top[0], "dept-item-university", "dept-badge-university")}
              {row(top[1], "dept-item-user", "dept-badge-user")}
              <div className="dept-divider"></div>
              {vis.map((d) => row(d))}
              <a href="#" className="see-more-btn" onClick={(e) => { e.preventDefault(); setMore(!more); }}><span>{more ? "See Less" : "See More"}</span></a>
            </div>
          </div>
        </aside>
      </div>

      <Modals />
      <Gate />
      {toast && <div id="ptoast">{toast}</div>}
    </>
  );
}
