import { useState } from "react";
import { usePortal } from "../context/PortalContext";
import { DEPTS } from "../data/seed";
import { TODAY, fmt, ampm } from "../utils";
import { putImgs, gcImgs, STORE_MSG } from "../images";
import { SingleImage, MultiImages } from "./ImageFields";
import { Field, Area, Select, ReadOnly, ProgramSelect, YearSelect, CollegeSelect, progName } from "./Fields";

const Foot = ({ onSave }) => {
  const { setModal } = usePortal();
  return (
    <div className="prow" style={{ marginTop: "1rem" }}>
      <button className="pbtn" onClick={() => setModal(null)}>Cancel</button>
      <button className="pbtn p" onClick={onSave}>Save</button>
    </div>
  );
};

// ---------------- student: register for an event ----------------
const DOCS = [["Copy of school ID", true], ["Certificate of Registration (COR)", true], ["Parent/guardian consent form", false]];

export function RegisterForm({ e }) {
  const { U, say, setModal, submitReg } = usePortal();
  const [name, setName] = useState(U.name);
  const [sid, setSid] = useState(U.id);
  const [contact, setContact] = useState(U.contact || "");
  const [remarks, setRemarks] = useState("");
  const [files, setFiles] = useState({});

  const go = () => {
    if (!name.trim() || !sid.trim()) return say("Enter your name and student ID");
    if (!contact.trim()) return say("Enter a contact number");
    for (let i = 0; i < DOCS.length; i++) if (DOCS[i][1] && !files[i]) return say("Attach: " + DOCS[i][0]);
    const docs = DOCS.map((d, i) => (files[i] ? d[0] + ": " + files[i].name : "")).filter(Boolean);
    submitReg(e, { name: name.trim(), sid: sid.trim(), contact: contact.trim(), remarks: remarks.trim(), docs });
  };

  return (
    <>
      <h3 className="ph3">Register for {e.title}</h3>
      <p className="pmeta">{fmt(e.date)} · {ampm(e.time)} – {ampm(e.end)} · {e.venue} · Register by {fmt(e.deadline)}</p>
      <Field label="Full name *" value={name} onChange={setName} />
      <Field label="Student ID *" value={sid} onChange={setSid} />
      <Field label="Contact number *" value={contact} onChange={setContact} />
      <label className="plbl">Required documents</label>
      {DOCS.map((d, i) => (
        <div key={d[0]}>
          <label className="pmeta" style={{ display: "block", marginTop: ".5rem" }}>{d[0]}{d[1] ? " *" : " (optional)"}</label>
          <input className="pf-input" type="file" onChange={(x) => setFiles({ ...files, [i]: x.target.files[0] })} />
        </div>
      ))}
      <Area label="Remarks (optional)" value={remarks} onChange={setRemarks} />
      <div className="prow" style={{ marginTop: "1rem" }}>
        <button className="pbtn" onClick={() => setModal(null)}>Cancel</button>
        <button className="pbtn p" onClick={go}>Submit registration</button>
      </div>
    </>
  );
}

// ---------------- staff: announcement ----------------
export function AnnForm({ id }) {
  const { S, update, say, setModal } = usePortal();
  const a = (id && S.ann.find((x) => x.id === id)) || { title: "", cat: "General", body: "", status: "Draft", img: "" };
  const [title, setTitle] = useState(a.title);
  const [cat, setCat] = useState(a.cat);
  const [body, setBody] = useState(a.body);
  const [img, setImg] = useState(a.img || "");
  const [status, setStatus] = useState(a.status);

  const save = () => {
    if (!title.trim()) return say("Title is required");
    const im = putImgs(img ? [img] : []);
    if (!im) return say(STORE_MSG);
    update((s) => {
      const x = { title: title.trim(), cat, body: body.trim(), status, img: im[0] || "" };
      const cur = id && s.ann.find((y) => y.id === id);
      if (cur) Object.assign(cur, x);
      else s.ann.unshift({ id: s.nid++, date: TODAY, author: s.P.name, dept: s.P.dept, ...x });
      gcImgs(s);
    });
    setModal(null);
    say("Announcement saved");
  };

  return (
    <>
      <h3 className="ph3">{id ? "Edit" : "New"} announcement</h3>
      <Field label="Title" value={title} onChange={setTitle} />
      <Select label="Category" value={cat} onChange={setCat} options={["Academic", "General", "Urgent"]} />
      <Area label="Message" value={body} onChange={setBody} />
      <SingleImage label="Pubmat / image (optional)" hint="Upload a poster or photo to show with this announcement." value={img} onChange={setImg} />
      <Select label="Status" value={status} onChange={setStatus} options={["Draft", "Published", "Archived"]} />
      <Foot onSave={save} />
    </>
  );
}

// ---------------- staff: event ----------------
export function EventForm({ id }) {
  const { S, update, say, setModal } = usePortal();
  const e = (id && S.evt.find((x) => x.id === id)) || { title: "", date: "", time: "08:00", end: "17:00", venue: "", cap: 50, desc: "", status: "Draft", deadline: "", img: "" };
  const [f, setF] = useState({ ...e });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!f.title.trim() || !f.date) return say("Title and date are required");
    const im = putImgs(f.img ? [f.img] : []);
    if (!im) return say(STORE_MSG);
    update((s) => {
      const x = { title: f.title.trim(), date: f.date, time: f.time || "08:00", end: f.end || "17:00", venue: f.venue, deadline: f.deadline || f.date, cap: +f.cap || 1, desc: f.desc, status: f.status, img: im[0] || "" };
      const cur = id && s.evt.find((y) => y.id === id);
      if (cur) Object.assign(cur, x);
      else s.evt.push({ id: s.nid++, host: s.P.name, dept: s.P.dept, posted: TODAY, ...x });
      gcImgs(s);
    });
    setModal(null);
    say("Event saved");
  };

  return (
    <>
      <h3 className="ph3">{id ? "Edit" : "New"} event</h3>
      <Field label="Title" value={f.title} onChange={set("title")} />
      <Field label="Date" type="date" value={f.date} onChange={set("date")} />
      <Field label="Start time" type="time" value={f.time} onChange={set("time")} />
      <Field label="End time" type="time" value={f.end} onChange={set("end")} />
      <Field label="Venue" value={f.venue} onChange={set("venue")} />
      <Field label="Registration deadline" type="date" value={f.deadline} onChange={set("deadline")} />
      <Field label="Capacity" type="number" value={f.cap} onChange={set("cap")} />
      <Area label="Description" value={f.desc} onChange={set("desc")} />
      <SingleImage label="Pubmat (image)" hint="Optional. Upload a poster for this event. If you skip it, a pubmat is generated from the title and venue. Images are resized to fit." value={f.img} onChange={set("img")} />
      <Select label="Status" value={f.status} onChange={set("status")} options={["Draft", "Open", "Closed", "Cancelled"]} />
      <Foot onSave={save} />
    </>
  );
}

// ---------------- staff: edit a post ----------------
export function PostEditForm({ id }) {
  const { S, update, say, setModal } = usePortal();
  const p = S.posts.find((x) => x.id === id);
  const [text, setText] = useState(p ? p.text : "");
  const [imgs, setImgs] = useState(p ? p.imgs || [] : []);
  if (!p) return null;

  const save = () => {
    if (!text.trim() && !imgs.length) return say("Post can't be empty");
    const im = putImgs(imgs);
    if (!im) return say(STORE_MSG);
    update((s) => { const x = s.posts.find((y) => y.id === id); x.text = text.trim(); x.imgs = im; gcImgs(s); });
    setModal(null);
    say("Post updated");
  };

  return (
    <>
      <h3 className="ph3">Edit post</h3>
      <Area label="Post" value={text} onChange={setText} />
      <MultiImages list={imgs} setList={setImgs} />
      <Foot onSave={save} />
    </>
  );
}

// ---------------- edit profile (student or staff page) ----------------
export function EditProfileForm() {
  const { U, P, staff, update, setPage, say, setModal } = usePortal();
  const [f, setF] = useState(
    staff
      ? { name: P.name, desc: P.desc || "", dept: P.dept, org: P.org || "Student Council" }
      : { name: U.name, cc: U.cc, year: U.year, contact: U.contact || "" }
  );
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const d = DEPTS.find((x) => x[0] === U.dept) || DEPTS[1];

  const save = () => {
    if (staff) {
      if (!f.name.trim()) return say("Enter a page name");
      setPage({ name: f.name, desc: f.desc, dept: f.dept, org: f.org });
    } else {
      update((s) => {
        s.U.name = f.name.trim() || s.U.name;
        s.U.cc = f.cc; s.U.course = progName(f.cc, s.U); s.U.year = f.year; s.U.contact = f.contact;
        delete s.U.first; delete s.U.last;
      });
    }
    setModal(null);
    say("Profile saved");
  };

  return (
    <>
      <h3 className="ph3">Edit profile</h3>
      {staff ? (
        <>
          <Field label="Page name" value={f.name} onChange={set("name")} />
          <Area label="Description" value={f.desc} onChange={set("desc")} />
          <CollegeSelect value={f.dept} onChange={set("dept")} />
          <Field label="Organization" value={f.org} onChange={set("org")} />
        </>
      ) : (
        <>
          <Field label="Full name" value={f.name} onChange={set("name")} />
          <div className="sgrid"><ReadOnly label="Student ID" value={U.id} /><ReadOnly label="Department" value={d[2]} /></div>
          <ReadOnly label="WMSU email" value={U.email} />
          <ReadOnly label="College" value={d[1]} />
          <p className="pmeta" style={{ margin: ".25rem 0 .5rem" }}>Student ID, email, college and department are managed by the university and cannot be edited.</p>
          <ProgramSelect U={U} value={f.cc} onChange={set("cc")} />
          <YearSelect value={f.year} onChange={set("year")} />
          <Field label="Contact number" value={f.contact} onChange={set("contact")} />
        </>
      )}
      <Foot onSave={save} />
    </>
  );
}
