import { D, TODAY } from "../utils";

export const PN = "COLLEGE OF COMPUTING STUDIES - COUNCIL";

// [code, name, subtitle, font-awesome icon]
export const DEPTS = [
  ["WMSU", "Western Mindanao State University", "General updates & notices", "graduation-cap"],
  ["CCS", "College of Computing Studies", "CSS Department", "laptop-code"],
  ["CM", "College of Medicine", "CM Department", "compass-drafting"],
  ["CLA", "College of Liberal Arts", "CLA Department", "flask"],
  ["CTE", "College of Education", "CTE Department", "chalkboard-user"],
  ["COE", "College of Engineering", "COE Department", "gear"],
  ["CN", "College of Nursing", "CN Department", "user-nurse"],
  ["CCJE", "College of Criminal Justice Education", "CCEJE Department", "users-gear"],
  ["CA", "College of Architecture", "CA Department", "ruler-combined"],
  ["CL", "College of Law", "CL Department", "scale-balanced"],
  ["CSM", "College of Science & Mathematics", "CSM Department", "atom"],
  ["CSSPE", "College of Sports Science & PE", "CSSPE Department", "dumbbell"],
];

export const seed = () => ({
  nid: 100,
  U: { name: "Alex Rivera", id: "2026-00123", email: "alex.rivera@wmsu.edu.ph", course: "BS Computer Science", cc: "BSCS", year: "2nd Year", contact: "", dept: "CCS" },
  P: { name: PN, short: "CCS", dept: "CCS", desc: "Official student council page of the College of Computing Studies.", email: "ccs.council@wmsu.edu.ph", org: "Student Council" },
  ann: [
    { id: 1, title: "Midterm Examination Schedule", cat: "Academic", body: "Midterm exams run from October 20 to 24. Bring your ID and writing materials.", date: D(-6), author: "Registrar's Office", dept: "WMSU", status: "Published" },
    { id: 2, title: "Classes Suspended on Oct 8", cat: "Urgent", body: "Classes are suspended due to a typhoon warning. Follow the modular learning guide.", date: D(-2), author: "Office of the President", dept: "WMSU", status: "Published" },
    { id: 3, title: "CCS Week 2026 Schedule Released", cat: "General", body: "CCS Week runs from October 14 to 18. Check the events tab for the full program.", date: D(-3), author: PN, dept: "CCS", status: "Published" },
    { id: 4, title: "BSCS Thesis Defense Schedule", cat: "Academic", body: "Thesis defense schedules for BSCS 4th year students are posted at the department office.", date: D(-2), author: "CCS Department Office", dept: "CCS", status: "Published", courses: ["BSCS"] },
  ],
  evt: [
    { id: 1, title: "Annual Campus Tech Innovation Expo Registration Open", date: D(42), time: "09:00", end: "17:00", venue: "Main Lobby", cap: 500, desc: "Join fellow student innovators and developers this coming month! Registration is open for project exhibits and hackathon tracks. Certificates and prize grants will be awarded.", status: "Open", host: "Student Affairs Office", dept: "WMSU", posted: D(-1), deadline: D(32), img: "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1200&auto=format&fit=crop" },
    { id: 2, title: "CCS Week Opening Ceremony", date: D(5), time: "07:30", end: "12:00", venue: "University Gym", cap: 200, desc: "Wear the official CCS shirt.", status: "Open", host: PN, dept: "CCS", posted: D(-3), deadline: D(3) },
    { id: 3, title: "CCS Hackathon 2026", date: D(13), time: "09:00", end: "17:00", venue: "Computer Lab 3", cap: 8, desc: "A build challenge. Bring your laptop.", status: "Open", host: PN, dept: "CCS", posted: D(-1), deadline: D(11) },
    { id: 4, title: "Medical Mission 2026", date: D(21), time: "08:00", end: "12:00", venue: "CM Quadrangle", cap: 100, desc: "Volunteer for the community medical mission.", status: "Open", host: "CM Student Council", dept: "CM", posted: D(-2), deadline: D(16) },
    { id: 5, title: "CCS Quiz Bee 2026", date: D(9), time: "13:00", end: "16:00", venue: "AVR", cap: 40, desc: "Individual quiz bee on programming, networking and databases. Top 3 win prizes and certificates.", status: "Open", host: PN, dept: "CCS", posted: D(0), deadline: D(6) },
  ],
  posts: [
    { id: 1, author: "Maria Santos", text: "Our hackathon team is ready! 💻", date: D(-1), dept: "CCS" },
    { id: 2, author: PN, text: "Reminder: wear the official CCS shirt for the opening ceremony. See you there!", date: D(-1), dept: "CCS" },
    { id: 3, author: "Student Affairs Office", text: "Reminder: student IDs must be validated before October 15.", date: D(-3), dept: "WMSU" },
  ],
  regs: [
    { id: 1, ev: 2, sid: "2026-00123", name: "Alex Rivera", course: "BSCS", status: "Approved", att: "—", date: D(-4), mine: true },
    { id: 2, ev: 3, sid: "2026-0098", name: "Maria Santos", course: "BSCS", status: "Pending", att: "—", date: D(-2) },
    { id: 3, ev: 3, sid: "2026-0120", name: "Carlos Reyes", course: "BSIT", status: "Approved", att: "—", date: D(-2) },
    { id: 4, ev: 2, sid: "2026-0155", name: "Angela Cruz", course: "BSIS", status: "Pending", att: "—", date: D(-1) },
  ],
  notifs: [
    { id: 1, for: "student", t: "ann", acad: 1, src: "College of Computing Studies", title: "Midterm Examination Schedule Update", text: "Revised exam room assignments for BSCS 2nd Year students have been posted.", date: TODAY, read: false },
    { id: 2, for: "student", t: "evt", src: "WMSU Student Council", title: "Upcoming Campus Hackathon 2026", text: "Registration is now open. Register before the deadline.", date: D(-1), read: false },
    { id: 3, for: "student", t: "sys", src: "CRIMSON", title: "Registration approved", text: "Your registration for CCS Week Opening Ceremony was approved.", date: D(-3), read: true },
    { id: 4, for: "staff", t: "sys", src: "CRIMSON", title: "Registrations to review", text: "2 registrations are waiting for your review.", date: TODAY, read: false },
  ],
  fol: ["WMSU", "CCS", "CM", "COE", "CN"],
  set: { scope: "mine", campus: true, dept: true, evt: true, urgent: true, theme: "light" },
});
