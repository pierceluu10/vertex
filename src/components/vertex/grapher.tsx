"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const COLORS = ["#c8416a", "#4a8fd4", "#4aaa6a", "#c89020", "#8050c0", "#d06040"];

interface FnEntry {
  id: string;
  expr: string;
  color: string;
}

function safeEval(expr: string, x: number): number {
  let e = expr.trim()
    .replace(/^y\s*=/, "")
    .replace(/\^/g, "**")
    .replace(/(\d)(x)/g, "$1*x")
    .replace(/(x)(\()/g, "x*$2")
    .replace(/(\d)(\()/g, "$1*$2")
    .replace(/\bsin\b/g, "Math.sin")
    .replace(/\bcos\b/g, "Math.cos")
    .replace(/\btan\b/g, "Math.tan")
    .replace(/\bsqrt\b/g, "Math.sqrt")
    .replace(/\babs\b/g, "Math.abs")
    .replace(/\blog\b/g, "Math.log10")
    .replace(/\bln\b/g, "Math.log")
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\be\b(?![a-zA-Z])/g, "Math.E")
    .trim();
  if (!e || e === "heart") return NaN;
  try {
    return new Function("x", "return (" + e + ");")(x) as number;
  } catch {
    return NaN;
  }
}

function fmt(n: number): string {
  return Math.abs(n) < 1e-9 ? "0" : parseFloat(n.toFixed(2)).toString();
}

export function Grapher() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fns, setFns] = useState<FnEntry[]>([
    { id: "1", expr: "heart", color: "#c8416a" },
    { id: "2", expr: "sin(x)", color: "#4a8fd4" },
    { id: "3", expr: "x^2 / 4", color: "#4aaa6a" },
  ]);
  const [xR, setXR] = useState(10);
  const [yR, setYR] = useState(10);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, x: 0, y: 0 });
  const mouseRef = useRef({ onCanvas: false, x: 0, y: 0 });
  const fnsRef = useRef(fns);
  const xRRef = useRef(xR);
  const yRRef = useRef(yR);

  useEffect(() => { fnsRef.current = fns; }, [fns]);
  useEffect(() => { xRRef.current = xR; }, [xR]);
  useEffect(() => { yRRef.current = yR; }, [yR]);

  const drawGraph = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const W = cv.offsetWidth || 800;
    cv.width = W;
    cv.height = 500;
    const H = cv.height;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const curXR = xRRef.current;
    const curYR = yRRef.current;
    const pan = panRef.current;
    const curFns = fnsRef.current;
    const mouse = mouseRef.current;

    const toSX = (mx: number) => ((mx - pan.x) / curXR + 0.5) * W;
    const toSY = (my: number) => (0.5 - (my - pan.y) / curYR) * H;
    const toMX = (sx: number) => (sx / W - 0.5) * curXR + pan.x;
    const toMY = (sy: number) => (0.5 - sy / H) * curYR + pan.y;

    ctx.fillStyle = "#f8f3e8";
    ctx.fillRect(0, 0, W, H);

    const gStep = curXR <= 3 ? 0.5 : curXR <= 8 ? 1 : curXR <= 16 ? 2 : curXR <= 30 ? 5 : 10;

    ctx.strokeStyle = "rgba(26,22,14,.06)";
    ctx.lineWidth = 1;
    for (let gx = Math.floor((-curXR + pan.x) / gStep) * gStep; gx <= curXR + pan.x; gx += gStep) {
      const sx = toSX(gx);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = Math.floor((-curYR + pan.y) / gStep) * gStep; gy <= curYR + pan.y; gy += gStep) {
      const sy = toSY(gy);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    ctx.strokeStyle = "rgba(26,22,14,.18)";
    ctx.lineWidth = 1.5;
    const axY = toSY(0);
    if (axY >= 0 && axY <= H) { ctx.beginPath(); ctx.moveTo(0, axY); ctx.lineTo(W, axY); ctx.stroke(); }
    const axX = toSX(0);
    if (axX >= 0 && axX <= W) { ctx.beginPath(); ctx.moveTo(axX, 0); ctx.lineTo(axX, H); ctx.stroke(); }

    ctx.fillStyle = "rgba(26,22,14,.3)";
    ctx.font = "11px Calibri,sans-serif";
    for (let gx = Math.floor((-curXR + pan.x) / gStep) * gStep; gx <= curXR + pan.x; gx += gStep) {
      if (Math.abs(gx) < 1e-9) continue;
      const sx = toSX(gx);
      const ly = Math.min(Math.max(axY, 14), H - 6);
      ctx.textAlign = "center";
      ctx.fillText(fmt(gx), sx, ly + 13);
    }
    for (let gy = Math.floor((-curYR + pan.y) / gStep) * gStep; gy <= curYR + pan.y; gy += gStep) {
      if (Math.abs(gy) < 1e-9) continue;
      const sy = toSY(gy);
      const lx = Math.min(Math.max(axX, 30), W - 4);
      ctx.textAlign = "right";
      ctx.fillText(fmt(gy), lx - 4, sy + 4);
    }
    ctx.textAlign = "center";

    curFns.forEach(fn => {
      const expr = fn.expr.trim();
      if (!expr) return;

      if (expr === "heart") {
        ctx.strokeStyle = fn.color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        ctx.beginPath();
        const steps = 600;
        const scale = 0.38;
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * 2 * Math.PI;
          const hx = 16 * Math.pow(Math.sin(t), 3) * scale;
          const hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scale;
          const sx = toSX(hx), sy = toSY(hy);
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeStyle = fn.color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        ctx.beginPath();
        let pen = false;
        const steps = W * 1.5;
        for (let i = 0; i <= steps; i++) {
          const mx2 = toMX((i / steps) * W);
          const my2 = safeEval(expr, mx2);
          if (!isFinite(my2) || isNaN(my2)) { pen = false; continue; }
          const sx = toSX(mx2), sy = toSY(my2);
          if (!pen) { ctx.moveTo(sx, sy); pen = true; } else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    });

    if (mouse.onCanvas) {
      ctx.strokeStyle = "rgba(200,65,106,.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(mouse.x, 0); ctx.lineTo(mouse.x, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, mouse.y); ctx.lineTo(W, mouse.y); ctx.stroke();
      ctx.setLineDash([]);
      const coordX = fmt(toMX(mouse.x));
      const coordY = fmt(toMY(mouse.y));
      ctx.fillStyle = "rgba(200,65,106,.8)";
      ctx.font = '11px Calibri,sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(`(${coordX}, ${coordY})`, mouse.x + 8, mouse.y - 6);
    }
  }, []);

  useEffect(() => {
    drawGraph();
  }, [fns, xR, yR, drawGraph]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const onEnter = () => { mouseRef.current.onCanvas = true; };
    const onLeave = () => { mouseRef.current.onCanvas = false; drawGraph(); };
    const onMove = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect();
      mouseRef.current.x = e.clientX - r.left;
      mouseRef.current.y = e.clientY - r.top;
      if (dragRef.current.active) {
        panRef.current.x -= (e.clientX - dragRef.current.x) / cv.offsetWidth * xRRef.current * 2;
        panRef.current.y += (e.clientY - dragRef.current.y) / cv.height * yRRef.current * 2;
        dragRef.current.x = e.clientX;
        dragRef.current.y = e.clientY;
      }
      drawGraph();
    };
    const onDown = (e: MouseEvent) => {
      dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    };
    const onUp = () => { dragRef.current.active = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 1.1 : 0.91;
      setXR(prev => Math.min(50, Math.max(0.5, prev * f)));
      setYR(prev => Math.min(50, Math.max(0.5, prev * f)));
    };
    const onResize = () => drawGraph();

    cv.addEventListener("mouseenter", onEnter);
    cv.addEventListener("mouseleave", onLeave);
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    cv.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);

    return () => {
      cv.removeEventListener("mouseenter", onEnter);
      cv.removeEventListener("mouseleave", onLeave);
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      cv.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
    };
  }, [drawGraph]);

  const addFn = () => {
    setFns(prev => [
      ...prev,
      { id: Date.now().toString(), expr: "", color: COLORS[prev.length % COLORS.length] },
    ]);
  };

  const removeFn = (idx: number) => {
    setFns(prev => prev.filter((_, i) => i !== idx));
  };

  const updateFnExpr = (idx: number, expr: string) => {
    setFns(prev => prev.map((f, i) => (i === idx ? { ...f, expr } : f)));
  };

  return (
    <div className="vtx-section-wrap">
      <section className="vtx-graph-section">
        <div className="vtx-section-header">
          <h2>Explore <em>functions</em></h2>
          <p>Type any equation and watch it come alive. Math stops being abstract.</p>
        </div>
        <div className="vtx-grapher-wrap">
          <div className="vtx-grapher-sidebar">
            <div className="vtx-g-sidebar-top"><span>Functions</span></div>
            <div className="vtx-fn-list">
              {fns.map((f, i) => (
                <div key={f.id} className="vtx-fn-item">
                  <div className="vtx-fn-color-dot" style={{ background: f.color }} />
                  <input
                    className="vtx-fn-input"
                    value={f.expr}
                    onChange={e => updateFnExpr(i, e.target.value)}
                    placeholder="e.g. sin(x)  or  x^2 - 3"
                    spellCheck={false}
                  />
                  <button className="vtx-fn-remove" onClick={() => removeFn(i)}>&times;</button>
                </div>
              ))}
            </div>
            <button className="vtx-add-fn-btn" onClick={addFn}>+ Add function</button>
            <div className="vtx-grapher-controls">
              <div className="vtx-ctrl-row">
                <span className="vtx-ctrl-label">X Range</span>
                <span className="vtx-ctrl-val">&minus;{Math.round(xR * 10) / 10} to {Math.round(xR * 10) / 10}</span>
              </div>
              <input
                type="range"
                className="vtx-ctrl-slider"
                min="2"
                max="40"
                value={xR}
                onChange={e => setXR(+e.target.value)}
              />
              <div className="vtx-ctrl-row">
                <span className="vtx-ctrl-label">Y Range</span>
                <span className="vtx-ctrl-val">&minus;{Math.round(yR * 10) / 10} to {Math.round(yR * 10) / 10}</span>
              </div>
              <input
                type="range"
                className="vtx-ctrl-slider"
                min="2"
                max="40"
                value={yR}
                onChange={e => setYR(+e.target.value)}
              />
            </div>
          </div>
          <div className="vtx-grapher-canvas-area">
            <canvas ref={canvasRef} height={500} />
            <span className="vtx-canvas-top-label">Vertex Grapher</span>
            <span className="vtx-axis-hint">Scroll to zoom &middot; drag to pan</span>
          </div>
        </div>
      </section>
    </div>
  );
}
