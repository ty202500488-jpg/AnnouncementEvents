import { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  UserPlus,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  GraduationCap,
  Users as UsersIcon,
} from "lucide-react";
import { useData } from "./context/DataContext.jsx";

const ITEMS_PER_PAGE = 10;
const ADMIN_ROLES = ["administrator", "admin", "system administrator"];

const usernameOf = (email = "") => (email ? email.split("@")[0] : "");

export default function Users() {
  const { users = [], updateUser } = useData();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const q = query.trim().toLowerCase().replace(/^@/, "");

  // Exclude admin accounts completely from the user list view
  const nonAdminUsers = useMemo(() => {
    return users.filter((u) => !ADMIN_ROLES.includes(u.role?.toLowerCase()));
  }, [users]);

  const filtered = useMemo(() => {
    return nonAdminUsers.filter((u) => {
      if (!q) return true;
      const uname = usernameOf(u.email).toLowerCase();
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return uname.includes(q) || name.includes(q) || email.includes(q);
    });
  }, [nonAdminUsers, q]);

  const staff = useMemo(
    () => filtered.filter((u) => u.role?.toLowerCase() === "staff"),
    [filtered]
  );
  
  const students = useMemo(
    () => filtered.filter((u) => u.role?.toLowerCase() === "student"),
    [filtered]
  );

  const activeList = useMemo(() => {
    switch (activeTab) {
      case "staff":
        return staff;
      case "students":
        return students;
      default:
        return filtered;
    }
  }, [activeTab, filtered, staff, students]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, query]);

  const totalItems = activeList.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [activeList, currentPage]);

  const giveStaff = async (u) => {
    const result = await updateUser(u.id, { role: "Staff" });
    if (!result) return;
    setNotice(`${u.name} (@${usernameOf(u.email)}) granted staff access.`);
  };

  const removeStaff = async (u) => {
    const result = await updateUser(u.id, { role: "Student" });
    if (!result) return;
    setNotice(`${u.name} (@${usernameOf(u.email)}) revoked back to student role.`);
  };

  const toggleStatus = async (u) => {
    await updateUser(u.id, { active: !u.active });
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div>
          <span style={{ display: "inline-block", backgroundColor: "#fbe4e8", color: "#9b1034", fontWeight: 800, fontSize: "11.5px", letterSpacing: "0.5px", padding: "7px 14px", borderRadius: "999px" }}>
            ADMINISTRATOR WORKSPACE
          </span>
          <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.5px", margin: "12px 0 6px", lineHeight: 1.15, color: "#16162b" }}>
            Manage users
          </h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: "15px" }}>
            Directory overview, access control, and user role management.
          </p>
        </div>
      </div>

      {notice && (
        <div style={{ margin: "0 0 20px", padding: "12px 18px", borderRadius: "16px", backgroundColor: "#e6f7ef", border: "1px solid #a7e3c8", color: "#0f8a5f", fontSize: "14.5px", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Close notification" style={{ color: "#0f8a5f", border: "none", background: "transparent", cursor: "pointer", padding: "4px", display: "grid", placeItems: "center" }}>
            <X size={14} />
          </button>
        </div>
      )}

      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e6ebf0", borderRadius: "24px", overflow: "hidden", width: "100%" }}>
        {/* Header Tabs & Search */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e6ebf0", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto" }}>
            {[
              { id: "all", label: `All (${filtered.length})`, icon: UsersIcon },
              { id: "staff", label: `Staff (${staff.length})`, icon: UserCheck },
              { id: "students", label: `Students (${students.length})`, icon: GraduationCap },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "12px",
                    border: isActive ? "1px solid #f8c4d0" : "1px solid transparent",
                    backgroundColor: isActive ? "#fbe4e8" : "transparent",
                    color: isActive ? "#9b1034" : "#64748b",
                    fontWeight: isActive ? 700 : 600,
                    fontSize: "14px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={16} /> {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, maxWidth: "360px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "42px", padding: "0 14px", backgroundColor: "#eaf0f4", borderRadius: "999px", color: "#64748b" }}>
              <Search size={18} />
              <input
                placeholder="Search by username, name, or email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "14px", color: "#16162b", minWidth: 0 }}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8" }}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User Rows */}
        <div>
          {paginatedUsers.length > 0 ? (
            paginatedUsers.map((u, idx) => {
              const roleLower = u.role?.toLowerCase() || "";
              const isStaff = roleLower === "staff";
              const isStudent = roleLower === "student";

              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 24px", borderTop: idx === 0 ? "none" : "1px solid #e6ebf0", flexWrap: "wrap" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#fbe4e8", color: "#8c1030", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "13px", flexShrink: 0 }}>
                    {u.initials || u.name?.charAt(0) || "U"}
                  </div>

                  <div style={{ flex: 1, minWidth: "220px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "15.5px", color: "#16162b" }}>{u.name}</span>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", textTransform: "uppercase", backgroundColor: isStaff ? "#e0f2fe" : "#f1f5f9", color: isStaff ? "#0369a1" : "#64748b" }}>
                        {u.role}
                      </span>
                    </div>
                    <div style={{ fontSize: "13.5px", color: "#8a97a6", marginTop: "2px" }}>
                      <span style={{ color: "#9b1034", fontWeight: 700 }}>@{usernameOf(u.email)}</span> · {u.email}
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                    {isStudent && (
                      <button onClick={() => giveStaff(u)} style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #a3123a, #7a0c29)", color: "#ffffff", minHeight: "38px", padding: "6px 14px", borderRadius: "10px", fontWeight: 600, fontSize: "13.5px", border: "none", cursor: "pointer" }}>
                        <UserPlus size={15} /> Give Staff Access
                      </button>
                    )}
                    {isStaff && (
                      <button onClick={() => removeStaff(u)} style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "38px", padding: "6px 14px", border: "1px solid #e6ebf0", borderRadius: "10px", backgroundColor: "#ffffff", fontSize: "13.5px", fontWeight: 500, color: "#475569", cursor: "pointer" }}>
                        <UserMinus size={15} /> Remove Staff Access
                      </button>
                    )}

                    <button
                      onClick={() => toggleStatus(u)}
                      style={{
                        minHeight: "36px",
                        padding: "4px 14px",
                        borderRadius: "999px",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        border: u.active ? "1px solid #bbf0d8" : "1px solid #cbd5e1",
                        backgroundColor: u.active ? "#e6f7ef" : "#f1f5f9",
                        color: u.active ? "#0f8a5f" : "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      {u.active ? "Active" : "Inactive"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "36px 24px", textAlign: "center", color: "#64748b", fontSize: "14.5px" }}>
              {q ? "No users match your search." : "No users found in this category."}
            </div>
          )}
        </div>

        {/* Pagination Page Numbers */}
        {totalItems > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: "1px solid #e6ebf0", backgroundColor: "#ffffff", flexWrap: "wrap", gap: "12px" }}>
            <span style={{ fontSize: "13.5px", color: "#64748b" }}>
              Showing <b>{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalItems)}</b>-
              <b>{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</b> of <b>{totalItems}</b> users
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                style={{ minHeight: "34px", width: "34px", borderRadius: "8px", border: "1px solid #e6ebf0", backgroundColor: "#ffffff", color: "#334155", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.4 : 1, display: "grid", placeItems: "center" }}
              >
                <ChevronLeft size={16} />
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        minWidth: "34px",
                        height: "34px",
                        padding: "0 6px",
                        borderRadius: "8px",
                        border: isActive ? "1px solid #9b1034" : "1px solid #e6ebf0",
                        backgroundColor: isActive ? "#9b1034" : "#ffffff",
                        color: isActive ? "#ffffff" : "#475569",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                style={{ minHeight: "34px", width: "34px", borderRadius: "8px", border: "1px solid #e6ebf0", backgroundColor: "#ffffff", color: "#334155", cursor: currentPage >= totalPages ? "not-allowed" : "pointer", opacity: currentPage >= totalPages ? 0.4 : 1, display: "grid", placeItems: "center" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}