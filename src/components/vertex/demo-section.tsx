import Link from "next/link";

export function DemoSection() {
  return (
    <div className="vtx-section-wrap">
      <section className="vtx-demo-section">
        <div className="vtx-demo-video-box">
          <button className="vtx-play-btn">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div className="vtx-demo-label">Product Demo — 2:47</div>
        </div>
        <div className="vtx-demo-copy">
          <span className="vtx-section-num">01 / Overview</span>
          <h2>Learning that<br/>feels like <em>play</em></h2>
          <p>Vertex pairs adaptive AI with curriculum-aligned content to meet every child exactly where they are. Our system learns how your child thinks — and teaches in the way they learn best.</p>
          <Link href="/demo" className="vtx-cta-link">Watch the full demo <span></span></Link>
        </div>
      </section>
    </div>
  );
}
