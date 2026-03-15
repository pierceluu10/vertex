"use client";

import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = "/vertex-logo.png";

type VertexLogoProps = {
  /** Use as link to home (e.g. in navbar). Omit for static display. */
  href?: string;
  /** Height in pixels; width scales to preserve aspect ratio. */
  height?: number;
  /** Optional className for the wrapper. */
  className?: string;
  /** Remove white background by blending (use on light/cream backgrounds). */
  transparentBg?: boolean;
};

export function VertexLogo({ href, height = 32, className = "", transparentBg = false }: VertexLogoProps) {
  const img = (
    <Image
      src={LOGO_SRC}
      alt="Vertex"
      width={height}
      height={height}
      className={transparentBg ? "vtx-logo-img vtx-logo-no-bg" : "vtx-logo-img"}
      style={{ height, width: "auto" }}
      priority
      unoptimized
    />
  );

  if (href) {
    return (
      <Link href={href} className={`vtx-logo-link ${className}`.trim()} aria-label="Vertex home">
        {img}
      </Link>
    );
  }
  return <span className={className}>{img}</span>;
}
