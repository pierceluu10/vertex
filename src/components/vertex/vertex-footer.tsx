"use client";

import { motion } from "framer-motion";

export function VertexFooter() {
  return (
    <motion.footer
      className="vtx-footer"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.5 }}
    >
      <div className="vtx-footer-logo">Vertex</div>
      <p>&copy; 2026 Vertex Learning Inc.</p>
    </motion.footer>
  );
}
