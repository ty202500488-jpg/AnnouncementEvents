import { Calendar, Eye, Megaphone, Users } from "lucide-react";
import { useData } from "../context/DataContext.jsx";

const METRIC_ITEMS = [
  { icon: Users, key: "activeUsers", label: "Active users" },
  { icon: Megaphone, key: "publishedAnnouncements", label: "Published announcements" },
  { icon: Calendar, key: "upcomingEvents", label: "Upcoming events" },
  { icon: Eye, key: "eventRegistrations", label: "Event registrations" },
];

export default function Reports() {
  const { reports } = useData();
  const activity = reports?.monthlyActivity || [];
  const pages = reports?.topPages || [];
  const maxActivity = Math.max(1, ...activity.map((item) => item.count));
  const maxPageItems = Math.max(1, ...pages.map((page) => page.content_items));

  const download = () => {
    const rows = [
      ["Month", "Announcements and events"],
      ...activity.map((item) => [item.month, item.count]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "publishing-activity-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>Reports &amp; statistics</h1>
          <p className="muted" style={{ maxWidth: 460 }}>
            Live totals and publishing activity from the platform database.
          </p>
        </div>
      </div>

      <div className="stats">
        {METRIC_ITEMS.map(({ icon: Icon, key, label }) => (
          <div className="card stat" key={key}>
            <div className="stat-top"><div className="stat-icon"><Icon size={20} /></div></div>
            <div className="stat-value">
              {(reports?.metrics?.[key] ?? 0).toLocaleString()}
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
              <div className="engage-value">Announcements &amp; events · last 12 months</div>
            </div>
            <button className="link-btn" onClick={download}>Download report</button>
          </div>
          <div className="bars">
            {activity.map((item) => (
              <div className="bar-wrap" key={item.month}>
                <div
                  className="bar"
                  title={`${item.month}: ${item.count} records`}
                  style={{ height: `${Math.max(5, (item.count / maxActivity) * 100)}%` }}
                />
                <span className="bar-label">{item.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card health">
          <h3>Most active pages</h3>
          {pages.map((page, index) => (
            <div className="top-item" key={page.id}>
              <div className="top-row">
                <b>{index + 1}. {page.name}</b>
                <span>{page.content_items} posts/events</span>
              </div>
              <div className="progress">
                <div style={{ width: `${(page.content_items / maxPageItems) * 92}%` }} />
              </div>
            </div>
          ))}
          {pages.length === 0 && <div className="empty">No page activity yet.</div>}
        </div>
      </div>
    </>
  );
}
