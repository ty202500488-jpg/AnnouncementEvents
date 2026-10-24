import React from "react";
import { Calendar, Download, Eye, Megaphone, Users } from "lucide-react";
import { useData } from "./context/DataContext.jsx";

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
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span
            style={{
              display: "inline-block",
              background: "#fbe4e8",
              color: "#9b1034",
              fontWeight: 800,
              fontSize: "11.5px",
              letterSpacing: "0.5px",
              padding: "7px 14px",
              borderRadius: "999px",
              wordBreak: "break-word",
            }}
          >
            ADMINISTRATOR WORKSPACE
          </span>
          <h1
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              margin: "12px 0 6px",
              lineHeight: 1.15,
              wordBreak: "break-word",
              color: "#16162b",
            }}
          >
            Reports &amp; statistics
          </h1>
          <p
            style={{
              color: "#64748b",
              margin: 0,
              fontSize: "15px",
              maxWidth: "460px",
            }}
          >
            Live totals and publishing activity from the platform database.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        {METRIC_ITEMS.map(({ icon: Icon, key, label }) => (
          <div
            key={key}
            style={{
              background: "#ffffff",
              border: "1px solid #e6ebf0",
              borderRadius: "24px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "160px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "#fdf0f3",
                  color: "#9b1034",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={20} />
              </div>
            </div>
            <div
              style={{
                fontSize: "clamp(26px, 2.8vw, 36px)",
                fontWeight: 800,
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
                wordBreak: "break-word",
                color: "#16162b",
              }}
            >
              {(reports?.metrics?.[key] ?? 0).toLocaleString()}
            </div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: "#64748b",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Grid Row 2: Monthly Publishing & Active Pages */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        {/* Monthly Activity Chart Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #8a1230, #4a0618)",
            color: "#ffffff",
            borderRadius: "24px",
            padding: "28px",
            minHeight: "300px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#fca5b0",
                  fontWeight: 600,
                  fontSize: "15px",
                }}
              >
                Monthly publishing activity
              </div>
              <div
                style={{
                  fontSize: "clamp(22px, 2.5vw, 28px)",
                  fontWeight: 800,
                  letterSpacing: "-0.6px",
                  marginTop: "6px",
                }}
              >
                Announcements &amp; events · last 12 months
              </div>
            </div>

            {/* Standout Download Report Button */}
            <button
              type="button"
              onClick={download}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#fff3dc",
                color: "#b45309",
                fontWeight: 800,
                fontSize: "13px",
                padding: "10px 18px",
                borderRadius: "999px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.filter = "brightness(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.filter = "none";
              }}
            >
              <Download size={16} />
              Download report
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              height: "150px",
              marginTop: "20px",
              paddingTop: "10px",
            }}
          >
            {activity.map((item) => (
              <div
                key={item.month}
                style={{
                  flex: 1,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <div
                  title={`${item.month}: ${item.count} records`}
                  style={{
                    width: "100%",
                    borderRadius: "6px 6px 0 0",
                    background: "linear-gradient(180deg, #ff9fa6, #b91c48)",
                    minHeight: "12px",
                    height: `${Math.max(5, (item.count / maxActivity) * 100)}%`,
                    transition: "height 0.3s ease, opacity 0.2s ease",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: "#fca5b0",
                    fontWeight: 500,
                  }}
                >
                  {item.month.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Most Active Pages Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e6ebf0",
            borderRadius: "24px",
            padding: "28px",
            minHeight: "300px",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 800,
              marginBottom: "20px",
              paddingBottom: "12px",
              borderBottom: "1px solid #e6ebf0",
              margin: "0 0 20px 0",
              color: "#16162b",
            }}
          >
            Most active pages
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {pages.map((page, index) => (
              <div key={page.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "14.5px",
                    marginBottom: "6px",
                    color: "#16162b",
                  }}
                >
                  <b style={{ fontWeight: 700 }}>
                    {index + 1}. {page.name}
                  </b>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    {page.content_items} posts/events
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    background: "#f1f5f8",
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "linear-gradient(135deg, #a3123a, #7a0c29)",
                      borderRadius: "999px",
                      width: `${(page.content_items / maxPageItems) * 92}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {pages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "#64748b",
                padding: "28px",
                fontSize: "14.5px",
              }}
            >
              No page activity yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}