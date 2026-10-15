import { usePortal } from "../context/PortalContext";
import { DEPTS } from "../data/seed";
import { Heading } from "../components/Feed";

export default function Departments() {
  const { S, base, nav, setDept, toggleFollow } = usePortal();
  return (
    <>
      <Heading>Departments</Heading>
      <div className="pgrid">
        {DEPTS.map((d) => {
          const f = S.fol.includes(d[0]);
          return (
            <div className="card" style={{ padding: "1.25rem" }} key={d[0]}>
              <div className="flex items-center gap-3">
                <div className="dept-badge"><i className={`fa-solid fa-${d[3]}`}></i></div>
                <div className="dept-info"><span className="dept-title">{d[1]}</span><span className="dept-sub">{d[2]}</span></div>
              </div>
              <div style={{ marginTop: ".75rem" }}>
                <button className={`pbtn ${f ? "" : "p"}`} onClick={() => toggleFollow(d[0])}>{f ? "Following ✓" : "Follow"}</button>{" "}
                <button className="pbtn" onClick={() => { setDept(d[0]); nav(base || "/"); }}>View posts</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
