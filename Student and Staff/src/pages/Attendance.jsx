import { useState, useEffect, useRef } from "react";
import { usePortal } from "../context/PortalContext";
import { fmt, ampm, astOf } from "../utils";
import { Heading, Empty } from "../components/Feed";

const aTag = (s) => <span className={`ptag a-${s.replace(" ", "")}`}>{s}</span>;
const STEPS = ["Not started", "Ongoing", "Finished"];

// staff: registrations for my events + QR attendance
export default function Attendance() {
  const { S, P, attEv, setAttEv, used, setAst, setRegStatus, scanned, attOf } = usePortal();
  const [rq, setRq] = useState("");
  const [rf, setRf] = useState("All");
  const [af, setAf] = useState("All");

  // camera scanner
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const pe = S.evt.filter((e) => e.host === P.name);
  const evId = pe.some((e) => e.id === attEv) ? attEv : (pe[0] || {}).id;
  const e = pe.find((x) => x.id === evId);

  const scannedRef = useRef(scanned);
  scannedRef.current = scanned;
  const evRef = useRef(evId);
  evRef.current = evId;

  const stopCam = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  };

  const startCam = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg("This browser cannot open the camera here (it needs https or localhost).");
      setManual(true);
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch {
      setMsg("Camera permission was denied or no camera was found.");
      setManual(true);
      return;
    }
    if (!("BarcodeDetector" in window)) setManual(true); // camera works but this browser cannot decode QR
    setMsg("Camera on. Point it at a student's QR code.");
    setOn(true);
  };

  // read frames while the camera is on
  useEffect(() => {
    if (!on) return;
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = streamRef.current;
    v.play().catch(() => {});
    const det = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    let stop = false, last = "", lt = 0, t;
    const tick = async () => {
      if (stop) return;
      let c = "";
      if (det && v.readyState >= 2 && v.videoWidth) {
        try { const r = await det.detect(v); if (r.length) c = r[0].rawValue; } catch { /* ignore */ }
      }
      if (stop) return;
      if (c) {
        const n = Date.now();
        const again = c !== last || n - lt > 1500;
        last = c; lt = n;
        if (again) setMsg(scannedRef.current(c, evRef.current));
      }
      t = setTimeout(tick, 200);
    };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [on]);

  // stop the camera when attendance is not ongoing, the event changes, or we leave the page
  useEffect(() => { if (on && (!e || astOf(e) !== "Ongoing")) stopCam(); }, [e, on]); // eslint-disable-line
  useEffect(() => { stopCam(); setMsg(""); }, [evId]); // eslint-disable-line
  useEffect(() => stopCam, []); // eslint-disable-line

  if (!e) return <><Heading>Register and Attendance</Heading><Empty>You have no events yet. Create one from the Events tab.</Empty></>;

  const s = astOf(e);
  const all = S.regs.filter((r) => r.ev === evId);
  const ap = all.filter((r) => r.status === "Approved");
  const rql = rq.toLowerCase();
  const attS = (r) => (r.status === "Approved" ? attOf(r) : "—");
  const rows = all.filter((r) => (rf === "All" || r.status === rf) && (af === "All" || attS(r) === af) && (!rql || (r.name + " " + r.sid).toLowerCase().includes(rql)));
  const cnt = (x) => ap.filter((r) => attOf(r) === x).length;

  const doManual = () => { setMsg(scanned(code, evId)); setCode(""); };

  return (
    <>
      <Heading>Register and Attendance</Heading>

      <div className="card" style={{ padding: "1.25rem" }}>
        <label className="plbl">Event</label>
        <select className="pf-input" value={evId} onChange={(x) => setAttEv(+x.target.value)}>
          {pe.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
        <div className="prow" style={{ marginTop: "1rem" }}>
          <div><b>{e.title}</b><div className="pmeta">{fmt(e.date)} · {ampm(e.time)} – {ampm(e.end)} · {e.venue} · {used(e)}/{e.cap} registered</div></div>
          {aTag(s)}
        </div>
        <div className="seg" style={{ marginTop: "1rem" }}>
          {STEPS.map((x) => <button key={x} className={`seg-b ${s === x ? "on" : ""}`} onClick={() => setAst(e, x)}>{x}</button>)}
        </div>
        <p className="pmeta" style={{ marginTop: ".5rem" }}>Students can show their QR only while this is Ongoing. When you set it to Finished, anyone not scanned is marked Absent.</p>

        {s === "Ongoing" && (
          <div style={{ marginTop: ".75rem" }}>
            {on ? <button className="pbtn" onClick={() => { stopCam(); setMsg(""); }}>Stop camera</button> : <button className="pbtn p" onClick={startCam}>Start camera scanner</button>}
            <div style={{ marginTop: ".75rem" }}>
              {on && <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: "22rem", borderRadius: ".75rem", background: "#0f172a", display: "block" }} />}
            </div>
            <p className="pmeta" style={{ marginTop: ".5rem" }}>{msg || "Start the camera and point it at a student's QR code. A student is marked Present only when their QR is detected."}</p>
            {manual && (
              <div className="flex items-center gap-2" style={{ marginTop: ".5rem" }}>
                <input className="pf-input" style={{ flex: 1 }} value={code} placeholder="Type the code under the student's QR" onChange={(x) => setCode(x.target.value)} onKeyDown={(x) => { if (x.key === "Enter") doManual(); }} />
                <button className="pbtn" onClick={doManual}>Check in</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <div className="pfilters">
          <input className="pf-input" value={rq} onChange={(x) => setRq(x.target.value)} placeholder="Search student name or ID…" />
          <select className="pf-input" value={rf} onChange={(x) => setRf(x.target.value)}>
            {[["All", "All registrations"], ["Pending", "Pending"], ["Approved", "Approved"], ["Declined", "Declined"], ["Cancelled", "Cancelled"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="pf-input" value={af} onChange={(x) => setAf(x.target.value)}>
            {[["All", "All attendance"], ["Pending", "Pending"], ["Present", "Present"], ["Absent", "Absent"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <p className="pmeta" style={{ marginTop: ".5rem" }}>{all.length} registered · {ap.length} approved · {cnt("Present")} present · {cnt("Absent")} absent · {cnt("Pending")} pending</p>
      </div>

      <div className="card" style={{ padding: "1rem", overflowX: "auto" }}>
        <table className="ptable">
          <thead><tr><th>Student</th><th>Registration</th><th>Attendance</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="4" className="pmeta">Nothing here yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.name}</b><div className="pmeta">{r.sid} · {r.course}</div></td>
                <td><span className={`ptag s-${r.status}`}>{r.status}</span></td>
                <td>{r.status === "Approved" ? <span className={`ptag s-${attOf(r)}`}>{attOf(r)}</span> : <span className="pmeta">—</span>}</td>
                <td>
                  {r.status === "Pending" && (
                    <>
                      <button className="pbtn p" onClick={() => setRegStatus(r, "Approved")}>Approve</button>{" "}
                      <button className="pbtn" onClick={() => setRegStatus(r, "Declined")}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
