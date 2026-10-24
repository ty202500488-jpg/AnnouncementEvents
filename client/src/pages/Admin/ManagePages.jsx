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

  return (
    <>
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
            }}
          >
            Manage pages
          </h1>
          <p style={{ color: "#64748b", maxWidth: 560, margin: 0 }}>
            Create official pages for active departments and organizations.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            maxWidth: "100%",
          }}
        >
          <input
            placeholder="New page name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            style={{
              padding: "14px 18px",
              border: "1px solid #e6ebf0",
              borderRadius: "16px",
              fontSize: "15px",
              fontWeight: 400,
              letterSpacing: 0,
              color: "#16162b",
              outline: "none",
              minHeight: "48px",
              boxSizing: "border-box",
              background: "#ffffff",
            }}
          />
          <select
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            style={{
              minHeight: "48px",
              padding: "0 16px",
              border: "1px solid #e6ebf0",
              borderRadius: "14px",
              fontSize: "15px",
              background: "#ffffff",
              color: "#16162b",
              outline: "none",
              boxSizing: "border-box",
            }}
          >
            <option value="">Choose department or organization</option>
            {owners.map((item) => (
              <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={!name.trim() || !owner}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "linear-gradient(135deg, #a3123a, #7a0c29)",
              color: "#ffffff",
              minHeight: "50px",
              padding: "0 24px",
              borderRadius: "14px",
              fontWeight: 600,
              fontSize: "15px",
              boxShadow: "0 8px 18px rgba(139, 16, 48, 0.25)",
              border: "none",
              cursor: !name.trim() || !owner ? "not-allowed" : "pointer",
              opacity: !name.trim() || !owner ? 0.45 : 1,
              whiteSpace: "nowrap",
              boxSizing: "border-box",
            }}
          >
            <Plus size={18} /> Add page
          </button>
        </div>
      </div>

      {owners.length === 0 && (
        <div
          style={{
            margin: "0 0 20px",
            padding: "14px 18px",
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
          No active departments or organizations are available to create a page.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "20px",
        }}
      >
        {pages.map((page) => (
          <div
            key={page.id}
            style={{
              background: "#ffffff",
              border: "1px solid #e6ebf0",
              borderRadius: "24px",
              overflow: "hidden",
              width: "100%",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justify: ("space-between"),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "20px",
                borderBottom: "1px solid #e6ebf0",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#fbe4e8",
                  color: "#8c1030",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                {page.code}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "15.5px",
                    wordBreak: "break-word",
                    color: "#16162b",
                  }}
                >
                  {page.name}
                </div>
                <div
                  style={{
                    fontSize: "13.5px",
                    color: "#8a97a6",
                    marginTop: "2px",
                    wordBreak: "break-all",
                  }}
                >
                  {page.dept} · {page.followers.toLocaleString()} followers
                </div>
              </div>
              <button
                onClick={() => removePage(page.id)}
                aria-label={`Deactivate ${page.name}`}
                title="Deactivate page"
                style={{
                  color: "#94a3b8",
                  padding: "6px",
                  borderRadius: "8px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
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
                padding: "16px 20px",
                background: "#fcfdfe",
                fontSize: "13.5px",
                color: "#64748b",
                gap: "12px",
              }}
            >
              <span style={{ wordBreak: "break-word" }}>
                {page.managers.length
                  ? `Managed by ${page.managers.join(", ")}`
                  : page.name}
              </span>
              <button
                onClick={() => togglePage(page.id)}
                style={{
                  minHeight: "38px",
                  padding: "6px 18px",
                  borderRadius: "12px",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: page.active ? "#e6f7ef" : "#eef2f6",
                  color: page.active ? "#0f8a5f" : "#64748b",
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
            style={{
              background: "#ffffff",
              border: "1px solid #e6ebf0",
              borderRadius: "24px",
              padding: "28px",
              textAlign: "center",
              color: "#64748b",
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