import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { usePortal } from "../context/PortalContext";
import { fmt, ampm, qrCode, astOf } from "../utils";
import { EventAction, PP, Pimg } from "./PostCard";
import { RegisterForm, AnnForm, EventForm, PostEditForm, EditProfileForm } from "./Forms";

const qrSvg = (t) => {
  const q = qrcode(0, "M");
  q.addData(t);
  q.make();
  return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
};

function QrModal({ regId }) {
  const { S, setModal, say, evOf } = usePortal();
  const r = S.regs.find((x) => x.id === regId);
  const e = r && evOf(r);

  // close automatically when staff scans it or ends attendance (works across tabs)
  useEffect(() => {
    if (!r) return;
    if (r.att === "Present") { setModal(null); say("QR detected. You are marked present."); }
    else if (astOf(e) !== "Ongoing") { setModal(null); say("Attendance finished. QR is no longer available."); }
  }, [r, e, setModal, say]);

  if (!r) return null;
  const c = qrCode(r);
  return (
    <>
      <h3 className="ph3">Attendance QR</h3>
      <p className="pmeta">{e.title} · {fmt(e.date)}</p>
      <div style={{ width: "14rem", margin: "1rem auto" }} dangerouslySetInnerHTML={{ __html: qrSvg(c) }} />
      <p style={{ textAlign: "center", fontWeight: 700, letterSpacing: ".08em" }}>{c}</p>
      <p className="pmeta" style={{ textAlign: "center" }}>
        {r.name} · {r.sid}<br />This code is unique to you. Hold it up to the staff camera. You are marked Present once it is detected.
      </p>
      <div className="prow" style={{ marginTop: "1rem" }}><span></span><button className="pbtn" onClick={() => setModal(null)}>Close</button></div>
    </>
  );
}

function ConfirmDelete() {
  const { staff, deleteAccount, setModal } = usePortal();
  const [txt, setTxt] = useState("");
  const w = staff ? "page" : "account";
  return (
    <div className="lo">
      <div className="lo-ic danger"><i className="fa-solid fa-trash-can"></i></div>
      <h3 className="ph3">Delete your {w}?</h3>
      <p className="pmeta" style={{ lineHeight: 1.5 }}>
        {staff ? "This permanently deletes the page and everything it has published, including its events and registrations." : "This permanently deletes your account, event registrations and preferences."} This cannot be undone.
      </p>
      <div style={{ textAlign: "left", marginTop: ".75rem" }}>
        <label className="plbl" htmlFor="delc">Type <b>DELETE</b> to confirm</label>
        <input className="pf-input" id="delc" autoComplete="off" autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} />
      </div>
      <div className="lo-actions">
        <button type="button" className="pbtn" onClick={() => setModal(null)}>Cancel</button>
        <button type="button" className="pbtn danger" disabled={txt.trim() !== "DELETE"} onClick={deleteAccount}>Delete {w}</button>
      </div>
    </div>
  );
}

export default function Modals() {
  const { modal, setModal, U, P, staff, used, update, say, logout, nav } = usePortal();
  const close = () => setModal(null);

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [setModal]);

  const m = modal;
  const small = m && ["logout", "deact", "del", "leave"].includes(m.type);

  return (
    <div className={`pmodal ${m ? "show" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      {m && (
        <div className={`pbox ${small ? "pbox-sm" : ""}`} role="dialog" aria-modal="true">
          {m.type === "logout" && (
            <div className="lo">
              <div className="lo-ic"><i className="fa-solid fa-right-from-bracket"></i></div>
              <h3 className="ph3">Log out of CRIMSON?</h3>
              <p className="pmeta" style={{ lineHeight: 1.5 }}>You are signed in as <b>{staff ? P.name : U.name}</b>. You will need to log in again to get back to your account.</p>
              <div className="lo-actions">
                <button type="button" className="pbtn" autoFocus onClick={close}>Stay logged in</button>
                <button type="button" className="pbtn p" onClick={logout}>Log out</button>
              </div>
            </div>
          )}

          {m.type === "details" && (
            <>
              <h3 className="ph3">{m.o.title || m.o.author}</h3>
              <PP>{m.o.body || m.o.text || m.o.desc}</PP>
              {m.t === "e" && <Pimg r={m.o.img} />}
              {m.t === "a" && <Pimg r={m.o.img} />}
              {m.t === "p" && (m.o.imgs || []).map((r, i) => <Pimg key={i} r={r} />)}
              {m.t === "e" ? (
                <p className="pmeta" style={{ marginTop: ".75rem" }}>
                  {fmt(m.o.date)} · {ampm(m.o.time)} – {ampm(m.o.end)}<br />
                  {m.o.venue} · {used(m.o)}/{m.o.cap} slots · Hosted by {m.o.host}<br />
                  Register by {fmt(m.o.deadline)}
                </p>
              ) : (
                <p className="pmeta" style={{ margin: ".75rem 0" }}>{m.o.author} · {fmt(m.o.date)} · {m.o.dept}</p>
              )}
              <div className="prow" style={{ marginTop: "1rem" }}>
                <button className="pbtn" onClick={close}>Close</button>
                {m.t === "e" && <span><EventAction e={m.o} /></span>}
              </div>
            </>
          )}

          {m.type === "reg" && <RegisterForm e={m.e} />}

          {m.type === "regview" && (
            <>
              <h3 className="ph3">{m.e.title}</h3>
              <p><span className={`ptag s-${m.r.status}`}>{m.r.status}</span></p>
              {[["Name", m.r.name], ["Student ID", m.r.sid], ["Course", m.r.course], ["Contact", m.r.contact], ["Remarks", m.r.remarks], ["Documents", (m.r.docs || []).join("; ")], ["Registered on", fmt(m.r.date)]].map(([k, v]) => (
                <div key={k} className="prow" style={{ padding: ".375rem 0", borderBottom: "1px solid var(--slate-100)" }}>
                  <span className="pmeta">{k}</span><span style={{ fontSize: ".8125rem", textAlign: "right" }}>{v || "—"}</span>
                </div>
              ))}
              <button className="pbtn" style={{ marginTop: "1rem" }} onClick={close}>Close</button>
            </>
          )}

          {m.type === "showqr" && <QrModal regId={m.id} />}
          {m.type === "annform" && <AnnForm id={m.id} />}
          {m.type === "evform" && <EventForm id={m.id} />}
          {m.type === "editpost" && <PostEditForm id={m.id} />}
          {m.type === "editprof" && <EditProfileForm />}

          {m.type === "deact" && (
            <div className="lo">
              <div className="lo-ic"><i className="fa-solid fa-user-clock"></i></div>
              <h3 className="ph3">Deactivate your account?</h3>
              <p className="pmeta" style={{ lineHeight: 1.5 }}>Your account will be hidden and you will be logged out. You can reactivate it any time by logging back in.</p>
              <div className="lo-actions">
                <button type="button" className="pbtn" autoFocus onClick={close}>Cancel</button>
                <button type="button" className="pbtn danger" onClick={() => { update((s) => { s.U.status = "deactivated"; }); setModal(null); nav("/login"); }}>Deactivate</button>
              </div>
            </div>
          )}

          {m.type === "leave" && (
            <div className="lo">
              <div className="lo-ic danger"><i className="fa-solid fa-right-from-bracket"></i></div>
              <h3 className="ph3">Leave as admin?</h3>
              <p className="pmeta" style={{ lineHeight: 1.5 }}>You will no longer be an admin of <b>{P.name}</b> and will lose access to managing its posts, events and registrations. The page itself will not be deleted.</p>
              <div className="lo-actions">
                <button type="button" className="pbtn" onClick={close}>Cancel</button>
                <button type="button" className="pbtn danger" onClick={() => { update((s) => { s.P.left = true; }); setModal(null); nav("/"); say("You left as admin."); }}>Leave as admin</button>
              </div>
            </div>
          )}

          {m.type === "del" && <ConfirmDelete />}
        </div>
      )}
    </div>
  );
}
