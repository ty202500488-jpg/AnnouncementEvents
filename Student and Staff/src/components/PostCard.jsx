import { useState, useEffect } from "react";
import { usePortal } from "../context/PortalContext";
import { TODAY, fmt, fmtS, rel, ampm, pubmat } from "../utils";
import { imgSrc } from "../images";
import Avatar from "./Avatar";

const H4 = ({ children }) => <h4 style={{ fontWeight: 700, color: "var(--slate-900)", fontSize: "1rem", lineHeight: 1.375 }}>{children}</h4>;
export const PP = ({ children }) => <p style={{ color: "var(--slate-600)", fontSize: ".875rem", marginTop: ".5rem", lineHeight: 1.625 }}>{children}</p>;

export const Pimg = ({ r }) => { const s = imgSrc(r); return s ? <img className="pimg1" src={s} alt="" /> : null; };
export const Gallery = ({ arr }) => {
  const s = (arr || []).map(imgSrc).filter(Boolean);
  if (!s.length) return null;
  if (s.length === 1) return <img className="pimg1" src={s[0]} alt="" />;
  return <div className="pgal">{s.map((x, i) => <img key={i} src={x} alt="" />)}</div>;
};

function Cover({ e }) {
  const src = imgSrc(e.img) || pubmat(e);
  const st = e.img
    ? { width: "100%", maxHeight: "28rem", objectFit: "contain", background: "var(--slate-100)", display: "block" }
    : { width: "100%", height: "16rem", objectFit: "cover", display: "block" };
  return (
    <div style={{ marginTop: "1rem", borderRadius: ".75rem", overflow: "hidden", position: "relative" }}>
      <img src={src} alt="" style={st} />
      <div style={{ position: "absolute", bottom: ".75rem", right: ".75rem", backgroundColor: "rgba(15,23,42,.8)", backdropFilter: "blur(12px)", color: "#fff", fontSize: "11px", fontWeight: 500, padding: ".375rem .75rem", borderRadius: ".5rem", border: "1px solid rgba(255,255,255,.2)" }}>
        Registration Deadline: {fmtS(e.deadline)}
      </div>
    </div>
  );
}

// the action button at the bottom right of an event card
export function EventAction({ e }) {
  const { staff, base, own, myReg, used, setModal, setAttEv, nav } = usePortal();
  if (staff) {
    return own(e)
      ? <button className="action-btn" onClick={() => { setModal(null); setAttEv(e.id); nav(base + "/attendance"); }}><i className="fa-solid fa-users"></i><span>Registrations</span></button>
      : <span className="pmeta">Managed by {e.host}</span>;
  }
  const r = myReg(e.id);
  const late = e.deadline < TODAY;
  if (r) return <span className={`ptag s-${r.status}`}>Registered · {r.status}</span>;
  if (e.status !== "Open" || late) return <span className="pmeta">{late && e.status === "Open" ? "Deadline passed" : "Registration closed"}</span>;
  if (used(e) >= e.cap) return <span className="pmeta">Full</span>;
  return (
    <button className="action-btn" onClick={() => setModal({ type: "reg", e })}>
      <i className="fa-solid fa-user-plus" style={{ fontSize: ".875rem" }}></i><span>Register</span>
    </button>
  );
}

function Kebab({ t, o }) {
  const { own, setModal, say, delPost, delAnn, delEvt } = usePortal();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!e.target.closest(".kebab-wrap")) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const item = (label, fn) => <div className="pmi" onClick={() => { setOpen(false); fn(); }}>{label}</div>;
  let items;
  if (!own(o)) items = item("Report", () => say("Thanks, your report was submitted"));
  else if (t === "p") items = <>{item("Edit post", () => setModal({ type: "editpost", id: o.id }))}{item("Delete post", () => delPost(o.id))}</>;
  else if (t === "a") items = <>{item("Edit announcement", () => setModal({ type: "annform", id: o.id }))}{item("Delete announcement", () => delAnn(o.id))}</>;
  else items = <>{item("Edit event", () => setModal({ type: "evform", id: o.id }))}{item("Delete event", () => delEvt(o.id))}</>;

  return (
    <div className="kebab-wrap" style={{ position: "relative" }}>
      <button className="action-btn" style={{ padding: ".25rem" }} onClick={() => setOpen(!open)}>
        <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: "1rem", color: "var(--slate-400)" }}></i>
      </button>
      {open && <div className="pmenu" style={{ position: "absolute", right: 0, top: "100%" }}>{items}</div>}
    </div>
  );
}

export default function PostCard({ t, o }) {
  const { used, setModal } = usePortal();
  const author = t === "e" ? o.host : o.author;
  const sub = t === "p" ? "Post" : t === "a" ? "Announcement" : "Event";

  return (
    <article className="card card-interactive" style={{ padding: "1.5rem" }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={author} />
          <div>
            <h3 style={{ fontWeight: 700, color: "var(--slate-900)", fontSize: ".875rem" }}>{author}</h3>
            <p style={{ fontSize: "11px", color: "var(--slate-400)", marginTop: ".125rem" }}>
              {rel(o.posted || o.date)} · {o.dept} · {sub}{o.status === "Draft" ? " · Draft" : ""}
            </p>
          </div>
        </div>
        <Kebab t={t} o={o} />
      </div>

      <div style={{ marginTop: "1rem" }}>
        {t === "p" && <>{o.text && <PP>{o.text}</PP>}<Gallery arr={o.imgs} /></>}
        {t === "a" && <><H4>{o.title}</H4><PP>{o.body}</PP><span className="ptag" style={{ marginTop: ".5rem" }}>{o.cat}</span><Pimg r={o.img} /></>}
        {t === "e" && (
          <>
            <H4>{o.title}</H4>
            <PP>{o.desc}</PP>
            <div className="pmeta" style={{ marginTop: ".5rem" }}>
              <i className="fa-regular fa-calendar"></i> {fmt(o.date)} · {ampm(o.time)} – {ampm(o.end)} ·{" "}
              <i className="fa-solid fa-location-dot"></i> {o.venue} · <i className="fa-solid fa-users"></i> {used(o)}/{o.cap}
            </div>
            <Cover e={o} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--slate-100)", fontSize: ".75rem", color: "var(--slate-500)" }}>
        <div className="flex items-center gap-6">
          <button className="action-btn" onClick={() => setModal({ type: "details", t, o })}>
            <i className="fa-regular fa-eye" style={{ fontSize: ".875rem" }}></i><span>View Details</span>
          </button>
        </div>
        {t === "e" ? <EventAction e={o} /> : <span />}
      </div>
    </article>
  );
}
