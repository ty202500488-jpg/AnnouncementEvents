// Uploaded images are kept in their own localStorage key and referenced as "@id"
const IMGKEY = "crimson_imgs_v1";
export const STORE_MSG = "Not enough browser storage for these images. Remove an old image or use a smaller one.";

let IMG = {};
export const reloadImgs = () => {
  try { IMG = JSON.parse(localStorage.getItem(IMGKEY)) || {}; } catch { IMG = {}; }
};
reloadImgs();

const persist = () => {
  try { localStorage.setItem(IMGKEY, JSON.stringify(IMG)); return true; } catch { return false; }
};

export const imgSrc = (r) => (r ? (r[0] === "@" ? IMG[r] || "" : r) : "");

// takes data URLs, returns refs ("@id"); returns null if storage is full
export const putImgs = (arr) => {
  const added = [];
  const out = arr.map((x) => {
    if (!x.startsWith("data:")) return x;
    const k = "@i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    IMG[k] = x;
    added.push(k);
    return k;
  });
  if (added.length && !persist()) { added.forEach((k) => delete IMG[k]); return null; }
  return out;
};

// remove images no longer used by any event / announcement / post
export const gcImgs = (S) => {
  const used = new Set([...S.evt.map((e) => e.img), ...S.ann.map((a) => a.img), ...S.posts.flatMap((p) => p.imgs || [])]);
  let ch = false;
  for (const k of Object.keys(IMG)) if (!used.has(k)) { delete IMG[k]; ch = true; }
  if (ch) persist();
};

export const imgBytes = () => JSON.stringify(IMG).length;

// read a File, resize to max 1200px, return a JPEG data URL
export const readImg = (f) =>
  new Promise((res, rej) => {
    if (!f || !/^image\//.test(f.type)) return rej(new Error("Please choose an image file (JPG, PNG, WebP or GIF)."));
    if (f.size > 15e6) return rej(new Error("That image is over 15 MB."));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("Could not read that file."));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => rej(new Error("That file is not a valid image."));
      im.onload = () => {
        const w = im.width || 1200, h = im.height || 800, k = Math.min(1, 1200 / Math.max(w, h));
        const c = document.createElement("canvas");
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        const x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.82));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  });
