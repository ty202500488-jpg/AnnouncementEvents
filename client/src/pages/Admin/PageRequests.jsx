import { useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, X, Check } from "lucide-react";
import { useData } from "./context/DataContext.jsx";

export default function PageRequests() {
  const { requests, reviewRequest } = useData();
  const [notice, setNotice] = useState(null);

  const approve = async (r) => {
    const result = await reviewRequest(r.id, "approved");
    if (!result) return;
    setNotice(
      `"${r.name}" was approved. ${r.requester.name} is now listed under it in Manage users.`,
    );
  };

  const reject = async (r) => {
    const result = await reviewRequest(r.id, "rejected");
    if (!result) return;
    setNotice(`The request for "${r.name}" was rejected.`);
  };

  return (
    <>
      <div 
        className="page-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>Pages</h1>
          <p className="muted" style={{ margin: "6px 0 0 0", maxWidth: "560px" }}>
            Review requests for new official pages and authorize the staff
            members who will manage them.
          </p>
        </div>
        <span className="pending-pill" style={{ alignSelf: "flex-start" }}>{requests.length} PENDING</span>
      </div>

      {notice && (
        <div className="assign-msg ok-msg">
          {notice} <Link to="/admin/users">View in Manage users →</Link>
        </div>
      )}

      {/* List container wrapping each request cleanly */}
      <div 
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {requests.map((r) => (
          <div 
            className="card" 
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "24px",
              padding: "24px",
              flexWrap: "wrap",
              boxSizing: "border-box",
            }}
          >
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
                flex: "1 1 400px",
                minWidth: 0,
              }}
            >
              <div 
                className="req-icon"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "var(--admin-pink, #fbe4e8)",
                  color: "var(--admin-crimson-dark, #8c1030)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Megaphone size={22} />
              </div>

              <div className="grow" style={{ minWidth: 0 }}>
                <div 
                  className="req-title" 
                  style={{ 
                    wordBreak: "break-word", 
                    fontSize: "17px", 
                    fontWeight: "700",
                    color: "var(--admin-ink, #16162b)",
                    lineHeight: "1.3"
                  }}
                >
                  {r.name}
                </div>
                <div 
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginTop: "6px",
                    fontSize: "14px",
                  }}
                >
                  <span className="avatar xs" style={{ flexShrink: 0 }}>
                    {r.requester.name
                      .replace(/^(Prof|Dr|Engr|Atty|Ms|Mr|Mrs)\.?\s+/i, "")
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <b style={{ color: "var(--admin-ink, #16162b)", wordBreak: "break-word" }}>{r.requester.name}</b>
                  <span className="muted">·</span>
                  <span className="muted" style={{ wordBreak: "break-all" }}>{r.requester.email}</span>
                  <span className="muted">· Requested {r.requestedOn}</span>
                </div>
              </div>
            </div>

            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexShrink: 0,
                flexWrap: "wrap",
              }}
            >
              <button 
                className="btn-reject" 
                onClick={() => reject(r)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  height: "46px",
                  width: "145px",
                  margin: 0,
                  border: "1px solid var(--admin-line, #e6ebf0)",
                  borderRadius: "14px",
                  background: "#ffffff",
                  fontSize: "15px",
                  color: "#475569",
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxSizing: "border-box",
                }}
              >
                <X size={18} /> Reject
              </button>
              <button 
                className="btn-primary" 
                onClick={() => approve(r)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  height: "46px",
                  width: "165px",
                  margin: 0,
                  borderRadius: "14px",
                  fontWeight: 600,
                  fontSize: "15px",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxSizing: "border-box",
                  boxShadow: "0 8px 18px rgba(139, 16, 48, 0.25)",
                }}
              >
                <Check size={18} /> Approve page
              </button>
            </div>
          </div>
        ))}

        {requests.length === 0 && (
          <div className="card empty" style={{ padding: "36px" }}>No pending page requests.</div>
        )}
      </div>
    </>
  );
}