import { Database, Shield } from "lucide-react";

export default function Settings() {
  return (
    <>
      <div className="page-head">
        <div>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>System settings</h1>
          <p className="muted">
            Current platform configuration and data capabilities.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="card settings-card">
          <div className="settings-top">
            <div>
              <h3>Academic year lifecycle</h3>
              <p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                The backend does not yet store an active school year or provide
                a safe archive-and-rollover operation.
              </p>
            </div>
            <span className="status scheduled">NOT CONFIGURED</span>
          </div>

          <div className="warn-box">
            <Shield size={22} />
            <div>
              <b>Rollover is unavailable</b>
              <p>
                No records will be changed here. A database-backed school-year
                setting and archival policy must be configured before annual
                rollover can safely be enabled.
              </p>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <h3>Connected data</h3>
          <div className="warn-box" style={{ marginTop: 18 }}>
            <Database size={22} />
            <div>
              <b>PostgreSQL</b>
              <p>
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
