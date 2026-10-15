import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { seed } from "../data/seed";
import { TODAY, astOf, qrCode } from "../utils";
import { reloadImgs, gcImgs } from "../images";

export const KEY = "crimson_portal_v2";
const Ctx = createContext(null);
export const usePortal = () => useContext(Ctx);

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.U) return s;
  } catch { /* ignore */ }
  return seed();
}

export function PortalProvider({ children }) {
  const { pathname } = useLocation();
  const nav = useNavigate();

  // Role comes from the URL: /staff/... = staff, everything else = student
  const staff = pathname === "/staff" || pathname.startsWith("/staff/");
  const base = staff ? "/staff" : "";

  const [S, setS] = useState(load);
  const [q, setQ] = useState("");
  const [sf, setSf] = useState("");
  const [dept, setDept] = useState(() => load().set.scope);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [attEv, setAttEv] = useState(null); // event picked on the staff attendance page
  const [, setImgTick] = useState(0);
  const tt = useRef();
  const Sref = useRef(S);
  Sref.current = S;

  // save + apply theme
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { say("Browser storage is full. Remove some images or posts."); }
    const r = document.documentElement;
    if (S.set.theme === "dark") r.setAttribute("data-theme", "dark");
    else r.removeAttribute("data-theme");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S]);

  // keep two open tabs (student + staff) in sync, like the old localStorage "storage" event
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "crimson_imgs_v1") { reloadImgs(); setImgTick((t) => t + 1); return; }
      if (e.key !== KEY || !e.newValue) return;
      try { setS(JSON.parse(e.newValue)); } catch { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn) => {
    setS((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  function say(m) {
    setToast(m);
    clearTimeout(tt.current);
    tt.current = setTimeout(() => setToast(""), 2200);
  }

  const U = S.U;
  const P = S.P;

  // ---------- helpers ----------
  const own = (o) => staff && (o.author === P.name || o.host === P.name);
  const forMe = (o) => ["WMSU", U.dept].includes(o.dept) && (!o.courses || o.courses.includes(U.cc));
  const inScope = (o) => dept === "all" || (dept === "mine" ? staff || S.fol.includes(o.dept) : o.dept === dept);
  const myReg = (id) => S.regs.find((r) => r.mine && r.ev === id && r.status !== "Cancelled");
  const used = (e) => S.regs.filter((r) => r.ev === e.id && !["Cancelled", "Declined"].includes(r.status)).length;
  const evOf = (r) => S.evt.find((e) => e.id === r.ev) || { title: "(deleted event)", venue: "", date: TODAY };
  const attOf = (r) => (r.att === "Present" ? "Present" : astOf(evOf(r)) === "Finished" ? "Absent" : "Pending");
  const resetFilters = () => { setSf(""); setQ(""); setDept(S.set.scope); };

  const notify = (s, to, title, text, t = "sys") =>
    s.notifs.unshift({ id: s.nid++, for: to, t, src: "CRIMSON", title, text, date: TODAY, read: false });

  // ---------- feed ----------
  const feedItems = (view) => {
    const ql = q.toLowerCase();
    const w = view === "announcements" || view === "events" ? sf : "";
    const visA = (a) => a.status === "Published" || own(a);
    const visE = (e) => e.status !== "Draft" || own(e);
    const Pp = S.posts.map((o) => ({ t: "p", o, d: o.date }));
    const A = S.ann.filter(visA).map((o) => ({ t: "a", o, d: o.date }));
    const E = S.evt.filter(visE).map((o) => ({ t: "e", o, d: view === "events" ? o.date : o.posted }));
    const base0 = view === "announcements" ? A : view === "events" ? E : [...Pp, ...A, ...E];
    return base0
      .filter(
        (x) =>
          inScope(x.o) &&
          (staff || dept !== "mine" || view === "home" || forMe(x.o)) &&
          (!w || (w === "wide" ? x.o.dept === "WMSU" : x.o.dept === U.dept && (staff || forMe(x.o)))) &&
          [x.o.title, x.o.body, x.o.text, x.o.desc, x.o.venue, x.o.author, x.o.host, x.o.cat]
            .filter(Boolean).join(" ").toLowerCase().includes(ql)
      )
      .sort((a, b) => (view === "events" ? a.d.localeCompare(b.d) : b.d.localeCompare(a.d)));
  };

  const toggleFollow = (c) => {
    const on = S.fol.includes(c);
    update((s) => { if (on) s.fol = s.fol.filter((x) => x !== c); else s.fol.push(c); });
    say(on ? "Unfollowed " + c : "Following " + c);
  };

  // ---------- student: registrations ----------
  const submitReg = (e, f) => {
    update((s) => {
      s.regs.push({ id: s.nid++, ev: e.id, sid: f.sid, name: f.name, course: s.U.cc, contact: f.contact, remarks: f.remarks, docs: f.docs, status: "Pending", att: "—", date: TODAY, mine: true });
      s.U.contact = f.contact;
      notify(s, "student", "Registration submitted", "You registered for " + e.title + ". Status: Pending.");
      notify(s, "staff", "New registration", f.name + " registered for " + e.title + ".");
    });
    setModal(null);
    say("Registration submitted. See it in My Events.");
  };

  const cancelReg = (r) => {
    const t = evOf(r).title;
    update((s) => {
      s.regs.find((x) => x.id === r.id).status = "Cancelled";
      notify(s, "student", "Registration cancelled", "You cancelled your registration for " + t + ".");
      notify(s, "staff", "Registration cancelled", r.name + " cancelled their registration for " + t + ".");
    });
    say("Registration cancelled");
  };

  // ---------- staff: registrations + attendance ----------
  const setRegStatus = (r, status) => {
    update((s) => {
      const x = s.regs.find((y) => y.id === r.id);
      x.status = status;
      if (x.mine) notify(s, "student", "Registration " + status.toLowerCase(), "Your registration for " + evOf(r).title + " was " + status.toLowerCase() + ".");
    });
    say(r.name + ": " + status.toLowerCase());
  };

  const setAst = (e, status) => {
    if (astOf(e) === status) return;
    update((s) => {
      s.evt.find((x) => x.id === e.id).ast = status;
      if (s.regs.some((r) => r.mine && r.ev === e.id && r.status === "Approved")) {
        if (status === "Ongoing") notify(s, "student", "Attendance is open", "Attendance for " + e.title + " is now ongoing. Open My Events to show your QR code.");
        if (status === "Finished") notify(s, "student", "Attendance closed", "Attendance for " + e.title + " has finished. Your QR code is no longer available.");
      }
    });
    say("Attendance: " + status.toLowerCase());
  };

  // returns the message to show in the scanner panel
  const scanned = (raw, evId) => {
    const c = String(raw).trim().toUpperCase();
    const cur = Sref.current;
    const e = cur.evt.find((x) => x.id === evId);
    if (!e || astOf(e) !== "Ongoing") return "Attendance is not ongoing.";
    const r = cur.regs.find((x) => qrCode(x) === c);
    if (!r) return "That is not a CRIMSON attendance QR code.";
    if (r.ev !== e.id) return r.name + "'s QR is for a different event.";
    if (r.status !== "Approved") return r.name + " is not approved for this event.";
    if (r.att === "Present") return r.name + " is already checked in.";
    update((s) => {
      const x = s.regs.find((y) => y.id === r.id);
      x.att = "Present";
      if (x.mine) notify(s, "student", "Attendance recorded", "You were marked present for " + e.title + ".");
    });
    say(r.name + " marked present");
    return "QR detected: " + r.name + " is marked Present.";
  };

  // ---------- staff: content ----------
  const delPost = (id) => { update((s) => { s.posts = s.posts.filter((x) => x.id !== id); gcImgs(s); }); say("Post deleted"); };
  const delAnn = (id) => { update((s) => { s.ann = s.ann.filter((x) => x.id !== id); gcImgs(s); }); say("Announcement deleted"); };
  const delEvt = (id) => {
    update((s) => { s.evt = s.evt.filter((x) => x.id !== id); s.regs = s.regs.filter((r) => r.ev !== id); gcImgs(s); });
    setAttEv(null);
    say("Event deleted");
  };

  // rename / re-college the staff page and carry its content along
  const setPage = (o) => {
    update((s) => {
      const p = s.P, old = p.name, n = (o.name || "").trim() || old, d = o.dept || p.dept;
      s.ann.forEach((a) => { if (a.author === old) { a.author = n; a.dept = d; } });
      s.posts.forEach((x) => { if (x.author === old) { x.author = n; x.dept = d; } });
      s.evt.forEach((e) => { if (e.host === old) { e.host = n; e.dept = d; } });
      p.name = n; p.dept = d; p.short = d;
      if (o.desc != null) p.desc = o.desc;
      if (o.org != null && o.org.trim()) p.org = o.org.trim();
      if (o.email != null) p.email = o.email;
    });
  };

  const setTheme = (t) => { update((s) => { s.set.theme = t; }); say((t === "dark" ? "Dark" : "Light") + " theme on"); };

  // ---------- account ----------
  const logout = () => { setModal(null); nav("/login"); };

  const deleteAccount = () => {
    update((s) => {
      if (staff) {
        const n = s.P.name, ids = s.evt.filter((e) => e.host === n).map((e) => e.id);
        s.ann = s.ann.filter((a) => a.author !== n);
        s.posts = s.posts.filter((p) => p.author !== n);
        s.evt = s.evt.filter((e) => e.host !== n);
        s.regs = s.regs.filter((r) => !ids.includes(r.ev));
        s.notifs = s.notifs.filter((x) => x.for !== "staff");
        s.P.deleted = true;
      } else {
        s.regs = s.regs.filter((r) => !r.mine);
        s.notifs = s.notifs.filter((x) => x.for !== "student");
        s.U.deleted = true;
      }
      gcImgs(s);
    });
    setModal(null);
    nav("/login");
  };

  const value = {
    S, U, P, staff, base, update, say, toast, nav,
    q, setQ, sf, setSf, dept, setDept, modal, setModal, attEv, setAttEv,
    own, forMe, myReg, used, evOf, attOf, notify, resetFilters, feedItems, toggleFollow,
    submitReg, cancelReg, setRegStatus, setAst, scanned,
    delPost, delAnn, delEvt, setPage, setTheme, logout, deleteAccount,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
