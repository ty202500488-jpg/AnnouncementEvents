import Feed, { Heading } from "../components/Feed";
import { usePortal } from "../context/PortalContext";

export default function Events() {
  const { staff, setModal } = usePortal();
  return (
    <>
      <Heading right={staff && <button className="pbtn p" onClick={() => setModal({ type: "evform" })}>+ New event</button>}>Events</Heading>
      <Feed view="events" filters />
    </>
  );
}
