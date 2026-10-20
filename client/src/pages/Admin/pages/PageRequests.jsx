import { useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, X, Check } from "lucide-react";
import { useData } from "../context/DataContext.jsx";

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
      <div className="page-head">
        <div>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>Pages</h1>
          <p className="muted">
            Review requests for new official pages and authorize the staff
            members who will manage them.
          </p>
        </div>
        <span className="pending-pill">{requests.length} PENDING</span>
      </div>

      {notice && (
        <div className="assign-msg ok-msg">
          {notice} <Link to="/admin/users">View in Manage users →</Link>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          Pending page requests
          <small>
            Approval creates the page and adds its requester to Manage Users as
            the page manager.
          </small>
        </div>

        {requests.map((r) => (
          <div className="req-row" key={r.id}>
            <div className="req-icon">
              <Megaphone size={22} />
            </div>

            <div className="grow">
              <div className="req-title">{r.name}</div>
              <div className="req-sub">
                {r.office} · {r.unit}
              </div>
              <div className="req-by">
                <span className="avatar sm">
                  {r.requester.name
                    .replace(/^(Prof|Dr|Engr|Atty|Ms|Mr|Mrs)\.?\s+/i, "")
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")}
                </span>
                <b>{r.requester.name}</b>
                <span className="muted">{r.requester.email}</span>
                <span className="muted">· Requested {r.requestedOn}</span>
              </div>
            </div>

            <button className="btn-reject" onClick={() => reject(r)}>
              <X size={18} /> Reject
            </button>
            <button className="btn-primary lg" onClick={() => approve(r)}>
              <Check size={18} /> Approve page
            </button>
          </div>
        ))}

        {requests.length === 0 && (
          <div className="empty">No pending page requests.</div>
        )}
      </div>
    </>
  );
}
