import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useData } from "../context/DataContext.jsx";

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
      <div className="page-head">
        <div>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>Manage pages</h1>
          <p className="muted" style={{ maxWidth: 560 }}>
            Create official pages for active departments and organizations.
          </p>
        </div>
        <div className="add-page">
          <input
            placeholder="New page name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
          />
          <select className="select" value={owner} onChange={(event) => setOwner(event.target.value)}>
            <option value="">Choose department or organization</option>
            {owners.map((item) => (
              <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>
                {item.label}
              </option>
            ))}
          </select>
          <button className="btn-primary lg" onClick={add} disabled={!name.trim() || !owner}>
            <Plus size={18} /> Add page
          </button>
        </div>
      </div>

      {owners.length === 0 && (
        <div className="assign-msg">No active departments or organizations are available to create a page.</div>
      )}

      <div className="page-grid">
        {pages.map((page) => (
          <div className="card page-card" key={page.id}>
            <div className="page-top">
              <div className="page-code">{page.code}</div>
              <div className="grow">
                <div className="list-name">{page.name}</div>
                <div className="list-email">
                  {page.dept} · {page.followers.toLocaleString()} followers
                </div>
              </div>
              <button
                className="ghost"
                onClick={() => removePage(page.id)}
                aria-label={`Deactivate ${page.name}`}
                title="Deactivate page"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="page-bottom">
              <span>
                {page.managers.length
                  ? `Managed by ${page.managers.join(", ")}`
                  : page.name}
              </span>
              <button
                className={`pill-toggle ${page.active ? "on" : "off"}`}
                onClick={() => togglePage(page.id)}
              >
                {page.active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>
        ))}
        {pages.length === 0 && <div className="card empty">No approved pages yet.</div>}
      </div>
    </>
  );
}
