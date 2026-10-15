import Feed, { Heading } from "../components/Feed";
import { usePortal } from "../context/PortalContext";

export default function Announcements() {
  const { staff, setModal } = usePortal();
  return (
    <>
      <Heading right={staff && <button className="pbtn p" onClick={() => setModal({ type: "annform" })}>+ New announcement</button>}>Announcements</Heading>
      <Feed view="announcements" filters />
    </>
  );
}
