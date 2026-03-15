"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { VertexLogo } from "@/components/vertex/vertex-logo";

export function VertexNavbar() {
  return (
    <motion.nav
      className="vtx-nav"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <VertexLogo href="/" height={38} className="vtx-nav-logo" />
      <ul className="vtx-nav-links">
        {["Login", "Register", "I'm a Student", "Mission", "Dashboard"].map((label, i) => {
          const hrefs = ["/login", "/signup", "/student", "/mission", "/dashboard/parent"];
          return (
            <motion.li
              key={label}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 + i * 0.05 }}
            >
              <Link href={hrefs[i]}>{label === "I'm a Student" ? <>I&apos;m a Student</> : label}</Link>
            </motion.li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
