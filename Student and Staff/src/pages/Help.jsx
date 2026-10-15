import { useState } from "react";
import { usePortal } from "../context/PortalContext";
import { Heading } from "../components/Feed";
import { TODAY } from "../utils";

const FAQ_STUDENT = [
  ["How do I register for an event?", "Press Register on the event post. Your registration stays Pending until the organizer approves it."],
  ["Where can I see my registration status?", "Open My Events. It shows Pending, Approved, Declined or Cancelled, plus attendance."],
  ["Why can't I register anymore?", "Registration closes at the deadline shown on the event, or when the event is full or closed."],
];
const FAQ_STAFF = [
  ["How do I create an event?", "Open Events and press + New event. Set the status to Open so students can register."],
  ["How do I approve registrations?", "Open Register and Attendance, pick your event, then Approve or Reject pending students."],
  ["How does QR attendance work?", "Set the event to Ongoing, start the camera scanner, and scan each student's QR. Set it to Finished to mark everyone else Absent."],
];

export default function Help() {
  const { staff, update, say } = usePortal();
  const [subj, setSubj] = useState("");
  const [msg, setMsg] = useState("");

  const send = () => {
    if (!subj.trim() || !msg.trim()) return say("Add a subject and a message");
    update((s) => { s.notifs.unshift({ id: s.nid++, for: staff ? "staff" : "student", t: "sys", src: "CRIMSON", title: "Support", text: "We received your message “" + subj.trim() + "”.", date: TODAY, read: false }); });
    setSubj(""); setMsg("");
    say("Message sent");
  };

  return (
    <>
      <Heading>Help & Support</Heading>
      <div className="card" style={{ padding: "1.5rem" }}>
        <b>Frequently asked questions</b>
        {(staff ? FAQ_STAFF : FAQ_STUDENT).map(([q, a]) => (
          <details className="pdet" key={q}><summary>{q}</summary><p className="pmeta" style={{ margin: ".375rem 0" }}>{a}</p></details>
        ))}
      </div>
      <div className="card" style={{ padding: "1.5rem" }}>
        <b>Contact support</b>
        <label className="plbl">Subject</label>
        <input className="pf-input" value={subj} onChange={(e) => setSubj(e.target.value)} />
        <label className="plbl">Message</label>
        <textarea className="pf-input" rows="3" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <p style={{ marginTop: "1rem" }}><button className="pbtn p" onClick={send}>Send message</button></p>
      </div>
    </>
  );
}
