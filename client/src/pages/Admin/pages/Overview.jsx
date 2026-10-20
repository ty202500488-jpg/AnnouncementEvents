import { useState } from "react";
import {
  Eye,
  Megaphone,
  Calendar,
  Users,
  Search,
  ChevronDown,
} from "lucide-react";
import { useData } from "../context/DataContext.jsx";

const STAT_ITEMS = [
  { icon: Users, key: "activeUsers", label: "Active users" },
  { icon: Megaphone, key: "publishedAnnouncements", label: "Published announcements" },
  { icon: Calendar, key: "upcomingEvents", label: "Upcoming events" },
  { icon: Eye, key: "pendingRequests", label: "Pending page requests" },
];

export default function Overview() {
  const { overview } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showSearch, setShowSearch] = useState(false);
  const activity = overview?.monthlyActivity || [];
  const maxActivity = Math.max(1, ...activity.map((month) => month.count));
  const filtered = (overview?.recentContent || []).filter(
    (row) =>
      (status === "all" || row.status?.toLowerCase() === status) &&
      row.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>Campus overview</h1>
          <p className="muted">Manage the entire WMSU Connect platform.</p>
        </div>
      </div>

      <div className="stats">
        {STAT_ITEMS.map(({ icon: Icon, key, label }) => (
          <div className="card stat" key={label}>
            <div className="stat-top">
              <div className="stat-icon"><Icon size={20} /></div>
            </div>
            <div className="stat-value">
              {(overview?.counts?.[key] ?? 0).toLocaleString()}
            </div>
            <div className="muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="row-2">
        <div className="engage">
          <div className="engage-top">
            <div>
              <div className="engage-label">Monthly publishing activity</div>
              <div className="engage-value">
                {activity.reduce((total, month) => total + month.count, 0).toLocaleString()} records · last 12 months
              </div>
            </div>
            <span className="pill-cream">ANNOUNCEMENTS &amp; EVENTS</span>
          </div>
          <div className="bars">
            {activity.map((month) => (
              <div
                key={month.month}
                className="bar"
                title={`${month.month}: ${month.count} records`}
                style={{ height: `${Math.max(5, (month.count / maxActivity) * 100)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="card health">
          <h3>Platform summary</h3>
          <div className="health-row">
            <span>Active users</span>
            <b>{(overview?.counts?.activeUsers ?? 0).toLocaleString()}</b>
          </div>
          <div className="health-row">
            <span>Published announcements</span>
            <b>{(overview?.counts?.publishedAnnouncements ?? 0).toLocaleString()}</b>
          </div>
          <div className="health-row">
            <span>Pending page requests</span>
            <b className="warn">{(overview?.counts?.pendingRequests ?? 0).toLocaleString()}</b>
          </div>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-head">
          <div>
            <h3>Recent content</h3>
            <div className="muted small">Announcements and campus events</div>
          </div>
          <div className="table-tools">
            {showSearch ? (
              <input
                className="mini-input"
                autoFocus
                placeholder="Search..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={() => !query && setShowSearch(false)}
              />
            ) : (
              <button className="btn-outline" onClick={() => setShowSearch(true)}>
                <Search size={16} /> Search
              </button>
            )}
            <div className="select-wrap">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All status</option>
                <option value="published">Published</option>
                <option value="upcoming">Upcoming</option>
                <option value="draft">Draft</option>
              </select>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>TITLE</th>
              <th>TYPE</th>
              <th>STATUS</th>
              <th>DATE</th>
              <th>PAGE</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={`${row.type}-${row.id}`}>
                <td className="t-title">{row.title}</td>
                <td className="muted">{row.type}</td>
                <td>
                  <span className={`status ${row.status?.toLowerCase()}`}>
                    {row.status}
                  </span>
                </td>
                <td className="muted date">
                  {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                </td>
                <td className="muted">{row.page || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="empty">No content found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
