import { useState } from "react";
import { useLocation } from "react-router-dom";
import { usePortal } from "../context/PortalContext";
import { DEPTS } from "../data/seed";
import { Heading } from "../components/Feed";
import { Field, Area, Select, ReadOnly, ProgramSelect, YearSelect, CollegeSelect, progName } from "../components/Fields";

// ---------- small building blocks ----------
const Row = ({ t, s, children }) => (
  <div className="srow">
    <div><div className="srow-t">{t}</div>{s && <div className="srow-s">{s}</div>}</div>
    {children}
  </div>
);

function Switch({ k, label, sub }) {
  const { S, update, say } = usePortal();
  return (
    <Row t={label} s={sub}>
      <input type="checkbox" className="sw" aria-label={label} checked={S.set[k] !== false}
        onChange={(e) => { const v = e.target.checked; update((s) => { s.set[k] = v; }); say("Notification preferences saved"); }} />
    </Row>
  );
}

function Theme() {
  const { S, setTheme } = usePortal();
  const th = S.set.theme === "dark" ? "dark" : "light";
  return (
    <Row t="Theme" s="Switch between a light and a dark appearance.">
      <div className="seg">
        {["light", "dark"].map((t) => (
          <button key={t} type="button" className={`seg-b ${th === t ? "on" : ""}`} aria-pressed={th === t} onClick={() => setTheme(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </Row>
  );
}

function Sessions() {
  const ua = navigator.userAgent;
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "this device";
  return (
    <>
      <Row t="Active sessions" s={`${br} on ${os} · this device`}><span className="ptag s-Approved">Active now</span></Row>
      <p className="pmeta" style={{ marginTop: ".25rem" }}>Only this device is shown. Sign-ins on other devices are not tracked yet.</p>
    </>
  );
}

function Password() {
  const { say } = usePortal();
  const [a, setA] = useState(""), [b, setB] = useState(""), [c, setC] = useState("");
  const go = () => {
    if (!a || !b) return say("Fill in all password fields");
    if (b !== c) return say("New passwords do not match");
    setA(""); setB(""); setC("");
    say("Password updated");
  };
  return (
    <>
      <b className="sub-t">Change password</b>
      <Field label="Current password" type="password" value={a} onChange={setA} />
      <Field label="New password" type="password" value={b} onChange={setB} />
      <Field label="Confirm new password" type="password" value={c} onChange={setC} />
      <p style={{ marginTop: "1rem" }}><button className="pbtn" onClick={go}>Update password</button></p>
    </>
  );
}

function Acc({ id, icon, title, sub, open, toggle, danger, children }) {
  return (
    <section className={`card sacc ${danger ? "sacc-danger" : ""} ${open ? "open" : ""}`} id={"set-" + id}>
      <button type="button" className="sacc-h" id={"sh-" + id} aria-expanded={open} aria-controls={"sp-" + id} onClick={() => toggle(id)}>
        <span className="sset-ic"><i className={`fa-solid fa-${icon}`}></i></span>
        <span className="sacc-tx"><span className="sset-t">{title}</span><span className="sset-s">{sub}</span></span>
        <i className="fa-solid fa-chevron-down sacc-chev"></i>
      </button>
      <div className="sacc-p" id={"sp-" + id} role="region" aria-labelledby={"sh-" + id} hidden={!open}>{children}</div>
    </section>
  );
}

// ---------- student sections ----------
function StudentAccount() {
  const { U, update, say } = usePortal();
  const sp = U.name.trim().split(/\s+/);
  const keep = U.first && U.last && U.first + " " + U.last === U.name;
  const last0 = keep ? U.last : sp.length > 1 ? sp.pop() : "";
  const first0 = keep ? U.first : sp.join(" ");
  const [f, setF] = useState({ first: first0, last: last0, cc: U.cc, year: U.year, contact: U.contact || "" });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const d = DEPTS.find((x) => x[0] === U.dept) || DEPTS[1];

  const save = () => {
    if (!f.first.trim() || !f.last.trim()) return say("Enter your first and last name");
    update((s) => {
      s.U.first = f.first.trim(); s.U.last = f.last.trim(); s.U.name = f.first.trim() + " " + f.last.trim();
      s.U.cc = f.cc; s.U.course = progName(f.cc, s.U); s.U.year = f.year; s.U.contact = f.contact;
    });
    say("Account settings saved");
  };

  return (
    <>
      <div className="sgrid"><div><Field label="First name" value={f.first} onChange={set("first")} /></div><div><Field label="Last name" value={f.last} onChange={set("last")} /></div></div>
      <div className="sgrid"><ReadOnly label="Student ID" value={U.id} /><ReadOnly label="WMSU email" value={U.email} /></div>
      <div className="sgrid"><ReadOnly label="College" value={d[1]} /><ReadOnly label="Department" value={d[2]} /></div>
      <p className="pmeta" style={{ marginTop: ".5rem" }}>Student ID, WMSU email, college and department are managed by the university and cannot be changed here.</p>
      <div className="sgrid"><div><ProgramSelect U={U} value={f.cc} onChange={set("cc")} /></div><div><YearSelect value={f.year} onChange={set("year")} /></div></div>
      <div className="sgrid"><div><Field label="Contact number" value={f.contact} onChange={set("contact")} /></div></div>
      <p style={{ marginTop: "1rem" }}><button className="pbtn p" onClick={save}>Save changes</button></p>
    </>
  );
}

function StaffAccount() {
  const { P, setPage, say } = usePortal();
  const [f, setF] = useState({ name: P.name, desc: P.desc || "", dept: P.dept, org: P.org || "Student Council", email: P.email || "" });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.name.trim()) return say("Enter a page name");
    setPage(f);
    say("Page settings saved");
  };
  return (
    <>
      <Field label="Page name" value={f.name} onChange={set("name")} />
      <Area label="Description" value={f.desc} onChange={set("desc")} />
      <div className="sgrid"><div><CollegeSelect value={f.dept} onChange={set("dept")} /></div><div><Field label="Organization" value={f.org} onChange={set("org")} /></div></div>
      <Field label="Contact email" type="email" value={f.email} onChange={set("email")} />
      <p style={{ marginTop: "1rem" }}><button className="pbtn p" onClick={save}>Save changes</button></p>
    </>
  );
}

// ---------- page ----------
export default function Settings() {
  const { S, staff, update, say, setDept, setModal } = usePortal();
  const { hash } = useLocation();
  const first = hash.replace("#", "");
  const [open, setOpen] = useState(first ? [first] : []);
  const toggle = (id) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const A = (id) => ({ id, open: open.includes(id), toggle });

  return (
    <>
      <Heading>Settings</Heading>

      <Acc {...A("account")} icon="user" title="Account" sub={staff ? "Manage your page information." : "Manage personal account information."}>
        {staff ? <StaffAccount /> : <StudentAccount />}
      </Acc>

      <Acc {...A("security")} icon="shield-halved" title="Security" sub="Protect your account.">
        {!staff && <><Password /><hr className="shr" /></>}
        <Sessions />
      </Acc>

      <Acc {...A("display")} icon="sliders" title="Display" sub={staff ? "Choose how CRIMSON looks." : "Choose your theme and what you see first."}>
        <Theme />
        {!staff && (
          <Row t="Feed preferences" s="Which posts appear on your home feed by default.">
            <select className="pf-input" style={{ width: "auto", maxWidth: "100%" }} aria-label="Default feed" value={S.set.scope}
              onChange={(e) => { const v = e.target.value; update((s) => { s.set.scope = v; }); setDept(v); say("Feed preference saved"); }}>
              <option value="mine">Colleges I follow</option>
              <option value="all">All departments</option>
            </select>
          </Row>
        )}
      </Acc>

      <Acc {...A("notification")} icon="bell" title="Notification" sub="Choose which updates to receive.">
        {staff ? (
          <>
            <Switch k="s_reg" label="New event registrations" sub="When students register for your events." />
            <Switch k="s_evt" label="Event reminders" sub="Reminders before your events start." />
            <Switch k="s_urg" label="Urgent announcements" sub="Time-sensitive notices from the university." />
          </>
        ) : (
          <>
            <Switch k="campus" label="New campus-wide announcements" sub="Updates from WMSU offices and the university." />
            <Switch k="dept" label="Department announcements" sub="Posts from your college and department." />
            <Switch k="evt" label="Upcoming events and registration reminders" sub="Event updates, deadlines and your registration status." />
            <Switch k="urgent" label="Urgent announcements" sub="Time-sensitive notices such as class suspensions and schedule changes." />
          </>
        )}
      </Acc>

      <Acc {...A("danger")} danger icon="triangle-exclamation"
        title={staff ? "Delete page or leave as admin" : "Deactivate or delete account"}
        sub={staff ? "Leave this page as an admin or permanently delete it." : "Temporarily deactivate your account or permanently delete it."}>
        {staff ? (
          <>
            <Row t="Leave as admin" s="Step down as an admin of this page. The page, its posts and its events stay, but you will no longer be able to manage them.">
              <button type="button" className="pbtn danger" onClick={() => setModal({ type: "leave" })}>Leave as admin</button>
            </Row>
            <Row t="Delete page" s="Permanently delete this page and everything it has published, including its events and registrations. This cannot be undone.">
              <button type="button" className="pbtn danger" onClick={() => setModal({ type: "del" })}>Delete page</button>
            </Row>
          </>
        ) : (
          <>
            <Row t="Deactivate account" s="Temporarily hide your account and log out. You can reactivate it any time by logging back in.">
              <button type="button" className="pbtn" onClick={() => setModal({ type: "deact" })}>Deactivate</button>
            </Row>
            <Row t="Delete account" s="Permanently delete your account, registrations and preferences. This cannot be undone.">
              <button type="button" className="pbtn danger" onClick={() => setModal({ type: "del" })}>Delete account</button>
            </Row>
          </>
        )}
      </Acc>
    </>
  );
}
