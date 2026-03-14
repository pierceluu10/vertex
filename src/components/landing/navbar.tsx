"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";

export function Navbar() {
  return (
    <motion.nav
      className="flex items-center justify-between px-8 md:px-16 py-6 relative z-50"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Link href="/" className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3L2 20h20L12 3z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-foreground tracking-tight">
          Vertex
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-8">
        <Link
          href="/"
          className="text-sm font-medium text-violet-600 border-b-2 border-violet-600 pb-0.5"
        >
          Home
        </Link>
        <Link
          href="#features"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Features
        </Link>
        <Link
          href="#how-it-works"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          How It Works
        </Link>
        <Link
          href="#about"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          About
        </Link>
        <Link
          href="/signup"
          className={buttonVariants({
            className:
              "bg-violet-600 hover:bg-violet-700 text-white rounded-full px-6 shadow-lg shadow-violet-500/25",
          })}
        >
          Get Started
        </Link>
      </div>
    </motion.nav>
  );
}
