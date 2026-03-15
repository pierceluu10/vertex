"use client";

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const curRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.cursor = "none";

    const onMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      if (curRef.current) {
        curRef.current.style.left = x + "px";
        curRef.current.style.top = y + "px";
      }
      if (ringRef.current) {
        ringRef.current.style.left = x + "px";
        ringRef.current.style.top = y + "px";
      }
    };

    document.addEventListener("mousemove", onMove);

    return () => {
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <>
      <div className="vtx-cursor" ref={curRef} />
      <div className="vtx-cursor-ring" ref={ringRef} />
    </>
  );
}
