import { useState } from "react";
import { usePortal } from "../context/PortalContext";
import { TODAY } from "../utils";
import { putImgs, STORE_MSG } from "../images";
import { MultiImages } from "../components/ImageFields";
import Avatar from "../components/Avatar";
import PostCard from "../components/PostCard";
import { Heading, Empty } from "../components/Feed";

// staff: post composer + everything this page has published
export default function MyPage() {
  const { S, P, own, update, say, setModal } = usePortal();
  const [text, setText] = useState("");
  const [imgs, setImgs] = useState([]);

  const add = () => {
    if (!text.trim() && !imgs.length) return say("Write something or add a photo first");
    const im = putImgs(imgs);
    if (!im) return say(STORE_MSG);
    update((s) => { s.posts.unshift({ id: s.nid++, author: s.P.name, text: text.trim(), imgs: im, date: TODAY, dept: s.P.dept }); });
    setText(""); setImgs([]);
    say("Posted as " + P.short);
  };

  const items = [
    ...S.posts.filter(own).map((o) => ({ t: "p", o, d: o.date })),
    ...S.ann.filter(own).map((o) => ({ t: "a", o, d: o.date })),
    ...S.evt.filter(own).map((o) => ({ t: "e", o, d: o.posted })),
  ].sort((a, b) => b.d.localeCompare(a.d));

  return (
    <>
      <Heading right={<span><button className="pbtn" onClick={() => setModal({ type: "annform" })}>+ Announcement</button>{" "}<button className="pbtn" onClick={() => setModal({ type: "evform" })}>+ Event</button></span>}>My Page</Heading>

      <div className="card" style={{ padding: "1.25rem" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: ".75rem" }}>
          <Avatar name={P.name} />
          <b style={{ fontSize: ".875rem" }}>{P.name}</b>
        </div>
        <textarea className="pf-input" rows="3" placeholder="Share something with your followers…" value={text} onChange={(e) => setText(e.target.value)} />
        <MultiImages list={imgs} setList={setImgs} />
        <div className="prow" style={{ marginTop: ".75rem" }}><span></span><button className="pbtn p" onClick={add}>Post</button></div>
      </div>

      {items.length ? items.map((x) => <PostCard key={x.t + x.o.id} t={x.t} o={x.o} />) : <Empty>Nothing published yet.</Empty>}
    </>
  );
}
