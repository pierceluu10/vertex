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
  /** Show "Vertex" wordmark next to the logo. Default true. */
  showName?: boolean;
};

export function VertexLogo({ href, height = 32, className = "", transparentBg = false, showName = true }: VertexLogoProps) {
  const img = (
    <Image
      src={LOGO_SRC}
      alt=""
      width={height}
      height={height}
      className={transparentBg ? "vtx-logo-img vtx-logo-no-bg" : "vtx-logo-img"}
      style={{ height, width: "auto" }}
      priority
      unoptimized
    />
  );

  const content = (
    <>
      {img}
      {showName && <span className="vtx-logo-wordmark">Vertex</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`vtx-logo-link ${className}`.trim()} aria-label="Vertex home">
        {content}
      </Link>
    );
  }
  return <span className={`vtx-logo-wrap ${className}`.trim()}>{content}</span>;
}
