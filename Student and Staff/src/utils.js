export const D = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
export const TODAY = D(0);
export const fmt = (d) => new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
export const fmtS = (d) => new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const rel = (d) => {
  const n = Math.round((new Date(TODAY + "T00:00") - new Date(d + "T00:00")) / 864e5);
  return n <= 0 ? "Today" : n === 1 ? "Yesterday" : n < 7 ? n + " days ago" : fmt(d);
};
export const ampm = (t) => {
  const [h, m] = t.split(":").map(Number);
  return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h < 12 ? "AM" : "PM");
};

export const ini = (n, pageName, pageShort) =>
  n === pageName
    ? pageShort
    : n.split(" ").filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).slice(0, 3).join("").toUpperCase();

// event attendance status: "Not started" | "Ongoing" | "Finished"
export const astOf = (e) => e.ast || "Not started";

// unique QR text for a registration
export const qrCode = (r) => {
  let h = 2166136261;
  for (const c of r.sid + "|" + r.ev + "|" + r.id + "|crimson") {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return "CRM-" + r.ev + "-" + r.id + "-" + h.toString(36).toUpperCase().padStart(7, "0");
};

const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PM = [["#9f1239", "#fb7185"], ["#1e3a8a", "#38bdf8"], ["#065f46", "#34d399"], ["#92400e", "#fbbf24"], ["#4c1d95", "#c084fc"]];

// auto-generated poster for events that have no uploaded image
export const pubmat = (e) => {
  const c = PM[e.id % PM.length];
  const w = (e.title.match(/.{1,22}(\s|$)/g) || [])
    .slice(0, 3)
    .map((l, i) => `<text x="40" y="${250 + i * 56}" font-size="44" font-weight="800" fill="#fff" font-family="Arial Black,Arial,sans-serif">${esc(l.trim().toUpperCase())}</text>`)
    .join("");
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect width="800" height="400" fill="url(#g)"/><circle cx="680" cy="90" r="120" fill="#fff" fill-opacity=".12"/><circle cx="740" cy="360" r="90" fill="#fff" fill-opacity=".1"/><text x="40" y="70" font-size="22" font-weight="700" fill="#fff" fill-opacity=".85" font-family="Arial,sans-serif">${esc(e.host)}</text><text x="40" y="110" font-size="20" fill="#fff" fill-opacity=".85" font-family="Arial,sans-serif">${fmt(e.date)} · ${esc(e.venue)}</text>${w}</svg>`
    )
  );
};
