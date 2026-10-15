import { usePortal } from "../context/PortalContext";
import { ini } from "../utils";

export const PHOTO = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop";
export const PHOTO_FB = "https://placehold.co/100x100/2563eb/ffffff?text=AR";
export const onImgError = (e) => { if (e.currentTarget.src !== PHOTO_FB) e.currentTarget.src = PHOTO_FB; };

// round initials badge (brand colour for the staff page, amber for others)
export default function Avatar({ name }) {
  const { P } = usePortal();
  const page = name === P.name;
  return (
    <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "5.75rem", backgroundColor: `var(${page ? "--brand-100" : "--amber-100"})`, color: `var(${page ? "--brand-600" : "--amber-700"})`, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem", flexShrink: 0 }}>
      {ini(name, P.name, P.short)}
    </div>
  );
}
