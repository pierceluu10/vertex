"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" },
  }),
};

export function FeaturesSection() {
  return (
    <div className="vtx-section-wrap">
      <section className="vtx-demo-section">
        <motion.div
          className="vtx-demo-video-box"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <button className="vtx-play-btn">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div className="vtx-demo-label">Product Demo &mdash; 2:47</div>
        </motion.div>
        <motion.div
          className="vtx-demo-copy"
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <span className="vtx-section-num">01 / Overview</span>
          <h2>Learning that<br/>feels like <em>play</em></h2>
          <p>Vertex pairs adaptive AI with curriculum-aligned content to meet every child exactly where they are. Our system learns how your child thinks &mdash; and teaches in the way they learn best.</p>
          <Link href="/signup" className="vtx-cta-link">Get started <span></span></Link>
        </motion.div>
      </section>

      <section className="vtx-features-grid">
        {[
          {
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
            title: "Focus Detection",
            desc: "Our webcam-based attention system detects when your child loses focus \u2014 tracking gaze, tab switching, and idle time \u2014 so the tutor can gently re-engage them in real time.",
          },
          {
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z"/><path d="M12 6v6l4 2"/></svg>,
            title: "Adaptive Pacing",
            desc: "Exercises adjust difficulty in real time. When your child struggles, the AI simplifies. When they excel, it challenges them further \u2014 keeping them in the optimal learning zone.",
          },
          {
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            title: "Parent Avatar Tutor",
            desc: "Your child learns from an AI tutor that looks and sounds like you. Record a short video and your digital twin guides every session with warmth and familiarity.",
          },
          {
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
            title: "AI Practice Exercises",
            desc: "No more static worksheets. Vertex generates personalized practice problems aligned to your child\u2019s curriculum, targeting the exact areas where they need reinforcement.",
          },
        ].map((feature, i) => (
          <motion.div
            key={feature.title}
            className="vtx-feature-card"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            custom={i}
          >
            <div className="vtx-feature-icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.desc}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
