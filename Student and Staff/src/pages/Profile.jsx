import { usePortal } from "../context/PortalContext";
import { collegeName } from "../data/options";
import { PHOTO, onImgError } from "../components/Avatar";

const Meta = ({ icon, children }) => <div className="meta-item"><i className={icon}></i><span>{children}</span></div>;
const Row = ({ k, children, style }) => <div className="info-row"><span className="info-label">{k}</span><span className="info-value" style={style}>{children}</span></div>;

export default function Profile() {
  const { U, P, staff, setModal } = usePortal();
  const name = staff ? P.name : U.name;
  const college = collegeName(staff ? P.dept : U.dept);
  const org = P.org || "Student Council";

  return (
    <>
      <div className="card overflow-hidden">
        <div className="profile-banner"></div>
        <div className="profile-header-content">
          <div className="profile-avatar-container">
            <img src={PHOTO} alt={name} className="profile-large-avatar" onError={onImgError} />
            <span className="profile-status-online"></span>
          </div>
          <div className="profile-user-details">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="profile-name">{name}</h2>
                <p className="profile-headline">{(staff ? org : U.course) + " • Western Mindanao State University"}</p>
                {staff && <p className="profile-desc">{P.desc}</p>}
              </div>
              <button className="btn-nav" style={{ fontSize: ".8125rem", padding: ".5rem 1rem" }} onClick={() => setModal({ type: "editprof" })}>
                <i className="fa-solid fa-pen-to-square" style={{ marginRight: ".375rem" }}></i> Edit Profile
              </button>
            </div>
            <div className="profile-meta-grid">
              <Meta icon="fa-solid fa-id-card">{staff ? "Staff Account • " + P.short : "Student ID: " + U.id}</Meta>
              <Meta icon="fa-solid fa-graduation-cap">{college}</Meta>
              <Meta icon="fa-regular fa-envelope">{staff ? P.email : U.email}</Meta>
              <Meta icon="fa-solid fa-location-dot">Zamboanga City, Philippines</Meta>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <h3 style={{ fontWeight: 700, color: "var(--slate-900)", fontSize: "1rem", marginBottom: "1rem" }}>
          {staff ? "Account & Organization Overview" : "Academic & Account Details"}
        </h3>
        <div className="space-y-3-5">
          {staff ? (
            <>
              <Row k="Page name">{P.name}</Row>
              <Row k="Organization">{org}</Row>
              <Row k="College">{college + " (" + P.dept + ")"}</Row>
              <Row k="Role">Council Staff</Row>
              <Row k="Email">{P.email}</Row>
              <Row k="Account Status" style={{ color: "var(--emerald-600)" }}>Active Staff</Row>
            </>
          ) : (
            <>
              <Row k="Full name">{U.name}</Row>
              <Row k="Program">{U.course}</Row>
              <Row k="Year level">{U.year}</Row>
              <Row k="College">{college + " (" + U.dept + ")"}</Row>
              <Row k="Contact">{U.contact || "—"}</Row>
              <Row k="Account Status" style={{ color: "var(--emerald-600)" }}>{U.status === "deactivated" ? "Deactivated" : "Active Student"}</Row>
            </>
          )}
        </div>
      </div>
    </>
  );
}
