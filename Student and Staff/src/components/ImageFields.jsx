import { usePortal } from "../context/PortalContext";
import { imgSrc, imgBytes, readImg, STORE_MSG } from "../images";

const tooBig = (S, extra) => JSON.stringify(S).length + imgBytes() + extra.length > 4.5e6;

// one image (announcement / event poster). value is a data URL, an "@id" ref, or a URL
export function SingleImage({ label, hint, value, onChange }) {
  const { S, say } = usePortal();
  const pick = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    try {
      const d = await readImg(f);
      if (tooBig(S, d)) return say(STORE_MSG);
      onChange(d);
    } catch (e) { say(e.message); }
  };
  return (
    <>
      <label className="plbl">{label}</label>
      <input className="pf-input" type="file" accept="image/*" onChange={pick} />
      <div style={{ marginTop: ".5rem" }}>
        {value ? (
          <>
            <img src={imgSrc(value)} alt="" style={{ maxWidth: "100%", maxHeight: "12rem", borderRadius: ".5rem", display: "block" }} />
            <button type="button" className="pbtn" style={{ marginTop: ".5rem" }} onClick={() => onChange("")}>Remove image</button>
          </>
        ) : <span className="pmeta">No image selected.</span>}
      </div>
      {hint && <p className="pmeta" style={{ marginTop: ".25rem" }}>{hint}</p>}
    </>
  );
}

// up to 4 photos for a post
export function MultiImages({ list, setList, max = 4 }) {
  const { S, say } = usePortal();
  const pick = async (ev) => {
    const files = [...ev.target.files];
    ev.target.value = "";
    let cur = [...list];
    for (const f of files) {
      if (cur.length >= max) { say("You can attach up to " + max + " images"); break; }
      try {
        const d = await readImg(f);
        if (tooBig(S, d + cur.filter((x) => x.startsWith("data:")).join(""))) { say(STORE_MSG); break; }
        cur = [...cur, d];
      } catch (e) { say(e.message); break; }
    }
    setList(cur);
  };
  return (
    <>
      {list.length > 0 && (
        <div className="pthumbs">
          {list.map((s, i) => (
            <div className="pthumb" key={i}>
              <img src={imgSrc(s)} alt="" />
              <button type="button" className="pthumb-x" title="Remove" onClick={() => setList(list.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: ".5rem" }}>
        <label className="pbtn" style={{ display: "inline-flex", gap: ".375rem", alignItems: "center", cursor: "pointer" }}>
          <i className="fa-regular fa-image"></i> Add photos
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={pick} />
        </label>{" "}
        <span className="pmeta">Up to {max} images</span>
      </div>
    </>
  );
}
