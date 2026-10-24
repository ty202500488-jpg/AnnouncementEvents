import React from "react";
import { Database, Shield } from "lucide-react";

export default function Settings() {
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
            System settings
          </h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: "15px" }}>
            Current platform configuration and data capabilities.
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
        }}
      >
        {/* Card 1: Academic Year Lifecycle */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e6ebf0",
            borderRadius: "24px",
            padding: "28px",
            boxSizing: "border-box",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: "200px" }}>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  margin: 0,
                  color: "#16162b",
                }}
              >
                Academic year lifecycle
              </h3>
              <p
                style={{
                  color: "#64748b",
                  marginTop: "6px",
                  marginBottom: 0,
                  lineHeight: 1.5,
                  fontSize: "14.5px",
                }}
              >
                The backend does not yet store an active school year or provide
                a safe archive-and-rollover operation.
              </p>
            </div>
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 800,
                padding: "7px 12px",
                borderRadius: "999px",
                letterSpacing: "0.3px",
                display: "inline-block",
                whiteSpace: "nowrap",
                background: "#fff6dc",
                color: "#b45309",
              }}
            >
              NOT CONFIGURED
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "16px 18px",
              borderRadius: "16px",
              background: "#fffbe6",
              border: "1px solid #fde68a",
              color: "#92400e",
              fontSize: "14.5px",
              fontWeight: 500,
              wordBreak: "break-word",
              boxSizing: "border-box",
            }}
          >
            <Shield size={22} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <b style={{ display: "block", marginBottom: "4px" }}>
                Rollover is unavailable
              </b>
              <p style={{ margin: 0, lineHeight: 1.4 }}>
                No records will be changed here. A database-backed school-year
                setting and archival policy must be configured before annual
                rollover can safely be enabled.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Connected Data */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e6ebf0",
            borderRadius: "24px",
            padding: "28px",
            boxSizing: "border-box",
            width: "100%",
          }}
        >
          <h3
            style={{
              fontSize: "20px",
              fontWeight: 800,
              margin: "0 0 18px",
              color: "#16162b",
            }}
          >
            Connected data
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "16px 18px",
              borderRadius: "16px",
              background: "#fffbe6",
              border: "1px solid #fde68a",
              color: "#92400e",
              fontSize: "14.5px",
              fontWeight: 500,
              wordBreak: "break-word",
              boxSizing: "border-box",
            }}
          >
            <Database size={22} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <b style={{ display: "block", marginBottom: "4px" }}>
                PostgreSQL
              </b>
              <p style={{ margin: 0, lineHeight: 1.4 }}>
                Administrator users, pages, requests, announcements, events,
                registrations, and reports are read from the application
                database. Settings are not persisted because the current
                database schema has no system-settings table.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}