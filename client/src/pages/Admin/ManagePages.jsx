import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useData } from "./context/DataContext.jsx";

export default function ManagePages() {
  const { pages, pageOptions, addPage, removePage, togglePage } = useData();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");

  const owners = [
    ...pageOptions.departments.map((item) => ({
      ...item,
      type: "department",
      label: `${item.name} (${item.code})`,
    })),
    ...pageOptions.organizations.map((item) => ({
      ...item,
      type: "organization",
      label: item.name,
    })),
  ];

  const add = async () => {
    const pageName = name.trim();
    const selectedOwner = owners.find((item) => `${item.type}:${item.id}` === owner);
    if (!pageName || !selectedOwner) return;

    const result = await addPage(pageName, selectedOwner.type, selectedOwner.id);
    if (result) {
      setName("");
      setOwner("");
    }
  };

  const confirmToggle = (page) => {
    const message = page.active
      ? `Do you want to deactivate "${page.name}"? Its status will be set to Inactive and it will be hidden from students and staff.`
      : `Do you want to reactivate "${page.name}"?`;
    if (window.confirm(message)) {
      togglePage(page.id);
    }
  };

  return (
    <>
      <div className="manage-pages-head">
        <div>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>Manage pages</h1>
          <p style={{ color: "var(--admin-muted, #64748b)", maxWidth: 560, margin: 0 }}>
            Create official pages for active departments and organizations.
          </p>
        </div>

        <div className="manage-pages-controls">
          <input
            className="text-input"
            placeholder="New page name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            style={{ minWidth: 0, flex: "1 1 200px" }}
          />
          <select
            className="select"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            style={{ minWidth: 0, flex: "1 1 220px" }}
          >
            <option value="">Choose department or organization</option>
            {owners.map((item) => (
              <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={add}
            disabled={!name.trim() || !owner}
            style={{
              minHeight: "48px",
              flexShrink: 0,
            }}
          >
            <Plus size={18} /> Add page
          </button>
        </div>
      </div>

      {owners.length === 0 && (
        <div className="assign-msg">
          No active departments or organizations are available to create a page.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        {pages.map((page) => (
          <div
            key={page.id}
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "20px",
                borderBottom: "1px solid var(--admin-line, #e6ebf0)",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "var(--admin-pink, #fbe4e8)",
                  color: "var(--admin-crimson-dark, #8c1030)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                {page.code}
              </div>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "15.5px",
                    wordBreak: "break-word",
                    color: "var(--admin-ink, #16162b)",
                    lineHeight: 1.25,
                  }}
                >
                  {page.name}
                </div>
                <div
                  style={{
                    fontSize: "13.5px",
                    color: "var(--admin-muted, #8a97a6)",
                    marginTop: "4px",
                    wordBreak: "break-word",
                  }}
                >
                  {page.dept} · {page.followers.toLocaleString()} followers
                </div>
              </div>
              <button
                onClick={() => removePage(page.id)}
                aria-label={`Deactivate ${page.name}`}
                title="Deactivate page"
                className="ghost"
                style={{
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                background: "#fcfdfe",
                fontSize: "13.5px",
                color: "var(--admin-muted, #64748b)",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ wordBreak: "break-word", flex: "1 1 140px" }}>
                {page.managers.length
                  ? `Managed by ${page.managers.join(", ")}`
                  : page.name}
              </span>
              <button
                onClick={() => confirmToggle(page)}
                className={`pill-toggle ${page.active ? "on" : "off"}`}
                style={{
                  flexShrink: 0,
                }}
              >
                {page.active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>
        ))}

        {pages.length === 0 && (
          <div
            className="card empty"
            style={{
              gridColumn: "1 / -1",
            }}
          >
            No approved pages yet.
          </div>
        )}
      </div>
    </>
  );
}