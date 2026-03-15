"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function DemoSection() {
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
          <div className="vtx-demo-label">Product Demo — 2:47</div>
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
          <p>Vertex pairs adaptive AI with curriculum-aligned content to meet every child exactly where they are. Our system learns how your child thinks — and teaches in the way they learn best.</p>
          <Link href="/demo" className="vtx-cta-link">Watch the full demo <span></span></Link>
        </motion.div>
      </section>
    </div>
  );
}
