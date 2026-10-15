import { useState } from "react";
import { usePortal } from "../context/PortalContext";
import { rel, TODAY } from "../utils";

const ICON = {
  ann: ["icon-announcement", "fa-solid fa-bullhorn"],
  evt: ["icon-event", "fa-regular fa-calendar-check"],
  sys: ["icon-system", "fa-solid fa-circle-info"],
};

export default function Notifications() {
  const { S, staff, update } = usePortal();
  const tabs = staff ? ["All", "Unread", "Announcements", "Events"] : ["All", "Unread", "Announcements", "Academic"];
  const [tab, setTab] = useState("All");

  const mine = S.notifs.filter((n) => n.for === (staff ? "staff" : "student"));
  const L = mine.filter((n) => (tab === "Unread" ? !n.read : tab === "Announcements" ? n.t === "ann" : tab === "Academic" ? n.acad : tab === "Events" ? n.t === "evt" : true));
  const read = (id) => update((s) => { const n = s.notifs.find((x) => x.id === id); if (n) n.read = true; });
  const markAll = () => update((s) => { s.notifs.forEach((n) => { if (n.for === (staff ? "staff" : "student")) n.read = true; }); });

  const group = (label, arr) =>
    arr.length > 0 && (
      <>
        <div className="notif-group-label">{label}</div>
        {arr.map((n) => {
          const [cls, ic] = ICON[n.t] || ICON.sys;
          return (
            <div key={n.id} className={`card notif-card ${n.read ? "" : "unread"}`} onClick={() => read(n.id)}>
              <div className={`notif-icon-wrapper ${cls}`}><i className={ic}></i></div>
              <div className="notif-body">
                <div className="notif-header"><span className="notif-source">{n.src}</span><span className="notif-time">{rel(n.date)}</span></div>
                <h4 className="notif-title">{n.title}</h4>
                <p className="notif-message">{n.text}</p>
              </div>
              {!n.read && <div className="unread-indicator"></div>}
            </div>
          );
        })}
      </>
    );

  const today = L.filter((n) => n.date === TODAY);
  const earlier = L.filter((n) => n.date !== TODAY);

  return (
    <>
      <div className="card" style={{ padding: "1.25rem 1.5rem" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 style={{ fontFamily: "'Bungee', sans-serif", fontWeight: 400, color: "var(--slate-900)" }}>Notifications</h2>
          <button className="pbtn" onClick={markAll}>Mark all as read</button>
        </div>
        <div className="notif-tabs">
          {tabs.map((t) => <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </div>

      <div className="space-y-3" style={{ paddingBottom: "1.5rem" }}>
        {group("Today", today)}
        {group("Earlier", earlier)}
        {!L.length && <div className="card" style={{ padding: "1.5rem", color: "var(--slate-500)", fontSize: ".875rem" }}>No notifications here.</div>}
      </div>
    </>
  );
}
