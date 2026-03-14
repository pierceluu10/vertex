import Link from "next/link";

export function FeaturesSection() {
  return (
    <div className="vtx-section-wrap">
      <section className="vtx-demo-section">
        <div className="vtx-demo-video-box">
          <button className="vtx-play-btn">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div className="vtx-demo-label">Product Demo &mdash; 2:47</div>
        </div>
        <div className="vtx-demo-copy">
          <span className="vtx-section-num">01 / Overview</span>
          <h2>Learning that<br/>feels like <em>play</em></h2>
          <p>Vertex pairs adaptive AI with curriculum-aligned content to meet every child exactly where they are. Our system learns how your child thinks &mdash; and teaches in the way they learn best.</p>
          <Link href="/signup" className="vtx-cta-link">Get started <span></span></Link>
        </div>
      </section>

      <section className="vtx-features-grid">
        <div className="vtx-feature-card">
          <div className="vtx-feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <h3>Focus Detection</h3>
          <p>Our webcam-based attention system detects when your child loses focus &mdash; tracking gaze, tab switching, and idle time &mdash; so the tutor can gently re-engage them in real time.</p>
        </div>
        <div className="vtx-feature-card">
          <div className="vtx-feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <h3>Adaptive Pacing</h3>
          <p>Exercises adjust difficulty in real time. When your child struggles, the AI simplifies. When they excel, it challenges them further &mdash; keeping them in the optimal learning zone.</p>
        </div>
        <div className="vtx-feature-card">
          <div className="vtx-feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h3>Parent Avatar Tutor</h3>
          <p>Your child learns from an AI tutor that looks and sounds like you. Record a short video and your digital twin guides every session with warmth and familiarity.</p>
        </div>
        <div className="vtx-feature-card">
          <div className="vtx-feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <h3>AI Practice Exercises</h3>
          <p>No more static worksheets. Vertex generates personalized practice problems aligned to your child&apos;s curriculum, targeting the exact areas where they need reinforcement.</p>
        </div>
      </section>
    </div>
  );
}
