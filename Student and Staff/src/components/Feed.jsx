import { usePortal } from "../context/PortalContext";
import { DEPTS } from "../data/seed";
import PostCard from "./PostCard";

export const Heading = ({ children, right }) => (
  <div className="prow">
    <h2 style={{ fontFamily: "'Bungee', sans-serif", fontWeight: 400, color: "var(--slate-900)" }}>{children}</h2>
    {right}
  </div>
);

export const Empty = ({ children }) => (
  <div className="card" style={{ padding: "1.5rem", color: "var(--slate-500)", fontSize: ".875rem" }}>{children}</div>
);

// view: "home" | "announcements" | "events"; filters adds the Campus-wide / Your department buttons
export default function Feed({ view, filters = false }) {
  const { S, feedItems, dept, setDept, sf, setSf, toggleFollow } = usePortal();
  const list = feedItems(view);
  const d = dept !== "mine" && dept !== "all" ? DEPTS.find((x) => x[0] === dept) : null;
  const following = d && S.fol.includes(d[0]);

  return (
    <>
      {filters && (
        <div className="flex gap-2">
          <button className={`pbtn ${sf === "wide" ? "p" : ""}`} onClick={() => setSf(sf === "wide" ? "" : "wide")}>Campus-wide</button>
          <button className={`pbtn ${sf === "dept" ? "p" : ""}`} onClick={() => setSf(sf === "dept" ? "" : "dept")}>Your department</button>
        </div>
      )}
      {d && (
        <div className="card prow" style={{ padding: "1rem 1.5rem" }}>
          <div><b>{d[1]}</b><div className="pmeta">{d[2]}</div></div>
          <span>
            <button className={`pbtn ${following ? "" : "p"}`} onClick={() => toggleFollow(d[0])}>{following ? "Following ✓" : "Follow"}</button>{" "}
            <button className="pbtn" onClick={() => setDept(S.set.scope)}>✕ Clear</button>
          </span>
        </div>
      )}
      {list.length ? list.map((x) => <PostCard key={x.t + x.o.id} t={x.t} o={x.o} />) : <Empty>Nothing found. Try another department or search.</Empty>}
    </>
  );
}
