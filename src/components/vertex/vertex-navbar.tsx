"use client";

import Link from "next/link";

export function VertexNavbar() {
  return (
    <nav className="vtx-nav">
      <Link className="vtx-nav-logo" href="/">Vertex</Link>
      <ul className="vtx-nav-links">
        <li><Link href="/signup">Register</Link></li>
        <li><Link href="/mission">Mission</Link></li>
        <li><Link href="/dashboard">Dashboard</Link></li>
      </ul>
    </nav>
  );
}
