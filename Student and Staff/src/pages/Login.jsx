import { useNavigate } from "react-router-dom";
import { KEY } from "../context/PortalContext";

// placeholder login: replace with your real login page when you convert index.html / login.html
export default function Login() {
  const nav = useNavigate();
  const reset = () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem("crimson_imgs_v1");
    window.location.href = "/login";
  };
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: "24rem", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Bungee', sans-serif", color: "#561C24", fontSize: "2rem" }}>CRIM<span style={{ color: "#881337" }}>SON</span></h1>
        <p className="pmeta" style={{ margin: ".5rem 0 1.25rem" }}>Choose how to sign in</p>
        <div className="space-y-3">
          <button className="pbtn p" style={{ width: "100%", padding: ".75rem" }} onClick={() => nav("/")}>Continue as Student</button>
          <button className="pbtn p" style={{ width: "100%", padding: ".75rem" }} onClick={() => nav("/staff")}>Continue as Staff</button>
          <button className="pbtn" style={{ width: "100%" }} onClick={reset}>Reset demo data</button>
        </div>
      </div>
    </div>
  );
}
