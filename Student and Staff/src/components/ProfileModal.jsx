import { useEffect } from "react";
import { usePortal } from "../context/PortalContext";
import Avatar, { PHOTO, onImgError } from "./Avatar";

// the dropdown that opens from the profile button in the header
export default function ProfileModal({ onClose, onLogout }) {
  const { S, U, P, staff, base, nav, setTheme } = usePortal();

  useEffect(() => {
    const down = (e) => { if (!e.target.closest("#accm") && !e.target.closest(".profile-btn")) onClose(); };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);

  const stuAv = <img className="avatar-img" style={{ width: "2.5rem", height: "2.5rem" }} src={PHOTO} alt="" onError={onImgError} />;
  const me = staff ? { n: P.name, s: P.email, a: <Avatar name={P.name} /> } : { n: U.name, s: U.email, a: stuAv };

  const acc = (on, to, av, name) => (
    <button type="button" role="menuitem" className={`pmi pmp ${on ? "cur" : ""}`} onClick={() => { onClose(); if (!on) nav(to); }}>
      {av}<b>{name}</b>{on && <i className="fa-solid fa-circle-check"></i>}
    </button>
  );

  return (
    <div className="pmenu" id="accm" role="menu" aria-label="Account menu">
      <div className="pm-who">
        {me.a}
        <div className="pm-wt"><div className="pm-name">{me.n}</div><div className="pm-sub">{me.s}</div></div>
      </div>
      <hr />
      <button type="button" role="menuitem" className="pmi pmr" onClick={() => { onClose(); nav(base + "/settings"); }}>
        <i className="fa-solid fa-gear pm-ic"></i>Settings
      </button>
      <button type="button" role="menuitem" className="pmi pmr" onClick={() => { setTheme(S.set.theme === "dark" ? "light" : "dark"); onClose(); }}>
        <i className="fa-solid fa-circle-half-stroke pm-ic"></i>{S.set.theme === "dark" ? "Light" : "Dark"} theme
      </button>
      <hr />
      <div className="pm-label">Switch account</div>
      {acc(!staff, "/", stuAv, U.name)}
      {acc(staff, "/staff", <Avatar name={P.name} />, P.name)}
      <hr />
      <button type="button" role="menuitem" className="pmi pmr danger" onClick={onLogout}>
        <i className="fa-solid fa-right-from-bracket pm-ic"></i>Log out
      </button>
    </div>
  );
}
