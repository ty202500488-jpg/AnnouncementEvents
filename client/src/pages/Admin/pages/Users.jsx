import { useState } from "react";
import { Search, X, UserPlus, UserMinus } from "lucide-react";
import { useData } from "../context/DataContext.jsx";

const usernameOf = (email) => email.split("@")[0];

export default function Users() {
  const { users, updateUser } = useData();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const q = query.trim().toLowerCase().replace(/^@/, "");
  const filtered = users.filter(
    (u) =>
      !q ||
      usernameOf(u.email).toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q),
  );

  const staff = filtered.filter((u) => u.role === "Staff");
  const admins = filtered.filter((u) =>
    ["Administrator", "Admin", "System Administrator"].includes(u.role),
  );
  const students = filtered.filter((u) => u.role === "Student");

  const giveStaff = async (u) => {
    const result = await updateUser(u.id, { role: "Staff" });
    if (!result) return;
    setNotice(
      `${u.name} (@${usernameOf(u.email)}) now has staff access and was moved to the Staff category.`,
    );
  };

  const removeStaff = async (u) => {
    const result = await updateUser(u.id, { role: "Student" });
    if (!result) return;
    setNotice(
      `${u.name} (@${usernameOf(u.email)}) no longer has staff access and was moved to Students.`,
    );
  };

  const row = (u) => (
    <div className="list-row" key={u.id}>
      <div className="avatar sm">{u.initials}</div>
      <div className="grow">
        <div className="list-name">{u.name}</div>
        <div className="list-email">
          <span className="username">@{usernameOf(u.email)}</span> · {u.email}
        </div>
        {u.role === "Staff" && u.managedPages.length > 0 && (
          <div className="page-chips">
            {u.managedPages.map((p) => (
              <span className="tag" key={p}>
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {u.role === "Student" && (
        <button className="btn-primary" onClick={() => giveStaff(u)}>
          <UserPlus size={16} /> Give staff access
        </button>
      )}
      {u.role === "Staff" && (
        <button className="btn-replace" onClick={() => removeStaff(u)}>
          <UserMinus size={16} /> Remove staff access
        </button>
      )}
      {["Administrator", "Admin", "System Administrator"].includes(u.role) && (
        <span className="role-chip">Administrator</span>
      )}

      {["Administrator", "Admin", "System Administrator"].includes(u.role) ? (
        <span className={"pill-toggle " + (u.active ? "on" : "off")}>
          {u.active ? "Active" : "Inactive"}
        </span>
      ) : (
        <button
          className={"pill-toggle " + (u.active ? "on" : "off")}
          onClick={() => updateUser(u.id, { active: !u.active })}
        >
          {u.active ? "Active" : "Inactive"}
        </button>
      )}
    </div>
  );

  const section = (title, list, emptyText) => (
    <div>
      <div className="group-head">
        {title} <span className="count">{list.length}</span>
      </div>
      {list.map(row)}
      {list.length === 0 && <div className="cat-empty">{emptyText}</div>}
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>Manage users</h1>
          <p className="muted">
            All users in the system. Give a student staff access to move them
            into the Staff category.
          </p>
        </div>
      </div>

      {notice && <div className="assign-msg ok-msg">{notice}</div>}

      <div className="card">
        <div className="card-title">
          All users
          <small>
            {filtered.length} {filtered.length === 1 ? "user" : "users"} found
          </small>
        </div>

        <div className="users-toolbar">
          <div className="user-search">
            <Search size={18} />
            <input
              placeholder="Search users by username, name or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="clear-btn"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {section(
          "Staff",
          staff,
          q ? "No staff match your search." : "No staff members yet.",
        )}
        {section(
          "Administrators",
          admins,
          "No administrators match your search.",
        )}
        {section(
          "Students",
          students,
          q ? "No students match your search." : "No students.",
        )}
      </div>
    </>
  );
}
