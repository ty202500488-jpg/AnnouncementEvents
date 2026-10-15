import { usePortal } from "../context/PortalContext";
import { fmt, astOf } from "../utils";
import { Heading } from "../components/Feed";

const aTag = (s) => <span className={`ptag a-${s.replace(" ", "")}`}>{s}</span>;

// student: my registrations + attendance QR
export default function MyEvents() {
  const { S, evOf, attOf, setModal, cancelReg } = usePortal();
  const rows = S.regs.filter((r) => r.mine).slice().reverse();

  const qrBtn = (r, e) => {
    if (r.status !== "Approved") return null;
    if (r.att === "Present") return <button className="pbtn" disabled>Checked in</button>;
    const s = astOf(e);
    return s === "Ongoing"
      ? <button className="pbtn p" onClick={() => setModal({ type: "showqr", id: r.id })}>Show QR</button>
      : <button className="pbtn" disabled>{s === "Finished" ? "QR closed" : "Not open yet"}</button>;
  };

  return (
    <>
      <Heading>My Events</Heading>
      <div className="card" style={{ padding: "1rem", overflowX: "auto" }}>
        <table className="ptable">
          <thead><tr><th>Event</th><th>Date</th><th>Status</th><th>Attendance</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="5" className="pmeta">Nothing here yet.</td></tr>}
            {rows.map((r) => {
              const e = evOf(r);
              return (
                <tr key={r.id}>
                  <td><b>{e.title}</b><div className="pmeta">{e.venue}</div></td>
                  <td>{fmt(e.date)}</td>
                  <td><span className={`ptag s-${r.status}`}>{r.status}</span></td>
                  <td>
                    {r.status === "Approved" ? (
                      <>
                        <span className={`ptag s-${attOf(r)}`}>{attOf(r)}</span>
                        <div className="pmeta" style={{ marginTop: ".375rem" }}>Event: {aTag(astOf(e))}</div>
                        <div style={{ marginTop: ".375rem" }}>{qrBtn(r, e)}</div>
                      </>
                    ) : "—"}
                  </td>
                  <td>
                    <button className="pbtn" onClick={() => setModal({ type: "regview", r, e })}>Show details</button>{" "}
                    {["Pending", "Approved"].includes(r.status) && <button className="pbtn" onClick={() => cancelReg(r)}>Cancel</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
