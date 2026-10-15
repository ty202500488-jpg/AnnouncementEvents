import { usePortal } from "../context/PortalContext";

// blocking dialog shown when the account is deactivated / deleted, or the staff member left as admin
export default function Gate() {
  const { S, staff, update, say, nav } = usePortal();
  const dead = staff ? S.P.deleted : S.U.deleted;
  const off = !staff && S.U.status === "deactivated";
  const left = staff && S.P.left && !dead;
  if (!dead && !off && !left) return null;

  let box;
  if (left) {
    box = (
      <div className="lo">
        <div className="lo-ic"><i className="fa-solid fa-right-from-bracket"></i></div>
        <h3 className="ph3">You left as admin</h3>
        <p className="pmeta" style={{ lineHeight: 1.5 }}>You are no longer an admin of this page.</p>
        <div className="lo-actions">
          <button type="button" className="pbtn" onClick={() => { update((s) => { delete s.P.left; }); say("You are an admin of this page again."); }}>Rejoin as admin</button>
          <button type="button" className="pbtn p" onClick={() => nav("/")}>Go to student account</button>
        </div>
      </div>
    );
  } else if (dead) {
    box = (
      <div className="lo">
        <div className="lo-ic danger"><i className="fa-solid fa-user-slash"></i></div>
        <h3 className="ph3">{staff ? "This page was deleted" : "This account was deleted"}</h3>
        <p className="pmeta" style={{ lineHeight: 1.5 }}>{staff ? "The page and everything it published have been removed." : "Your profile, registrations and preferences have been removed."}</p>
        <div className="lo-actions one"><button type="button" className="pbtn p" onClick={() => nav("/login")}>Go to login</button></div>
      </div>
    );
  } else {
    box = (
      <div className="lo">
        <div className="lo-ic"><i className="fa-solid fa-user-clock"></i></div>
        <h3 className="ph3">Your account is deactivated</h3>
        <p className="pmeta" style={{ lineHeight: 1.5 }}>Reactivate it to keep using CRIMSON, or log out.</p>
        <div className="lo-actions">
          <button type="button" className="pbtn" onClick={() => nav("/login")}>Log out</button>
          <button type="button" className="pbtn p" onClick={() => { update((s) => { delete s.U.status; }); say("Welcome back! Your account is active again."); }}>Reactivate</button>
        </div>
      </div>
    );
  }
  return (
    <div className="pmodal show" style={{ zIndex: 90 }}>
      <div className="pbox pbox-sm" role="dialog" aria-modal="true">{box}</div>
    </div>
  );
}
