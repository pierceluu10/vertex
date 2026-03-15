"use client";

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const curRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.cursor = "none";

    let cx = 0, cy = 0, rx = 0, ry = 0;
    let animId: number;

    const onMove = (e: MouseEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      if (curRef.current) {
        curRef.current.style.left = cx + "px";
        curRef.current.style.top = cy + "px";
      }
    };

    const loop = () => {
      rx += (cx - rx) * 0.11;
      ry += (cy - ry) * 0.11;
      if (ringRef.current) {
        ringRef.current.style.left = rx + "px";
        ringRef.current.style.top = ry + "px";
      }
      animId = requestAnimationFrame(loop);
    };

    document.addEventListener("mousemove", onMove);
    animId = requestAnimationFrame(loop);

    return () => {
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <>
      <div className="vtx-cursor" ref={curRef} />
      <div className="vtx-cursor-ring" ref={ringRef} />
    </>
  );
}
