"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MathVisualConfig {
  type: string;
  label?: string;
  // numberline
  min?: number;
  max?: number;
  points?: number[];
  // fraction
  numerator?: number;
  denominator?: number;
  // shapes
  shapes?: Array<{ shape: string; count: number; color?: string }>;
  // function / parabola / graph
  expression?: string;
  expressions?: Array<{ expr: string; color?: string; label?: string }>;
  // coordinate / scatter
  coordinates?: Array<{ x: number; y: number; label?: string }>;
  // bar chart
  bars?: Array<{ label: string; value: number; color?: string }>;
  // pie chart
  slices?: Array<{ label: string; value: number; color?: string }>;
  // geometry
  vertices?: Array<{ x: number; y: number; label?: string }>;
  segments?: Array<[number, number, number, number]>;
  circles?: Array<{ cx: number; cy: number; r: number; label?: string }>;
  angles?: Array<{ a: [number, number]; b: [number, number]; c: [number, number] }>;
  // table
  headers?: string[];
  rows?: (string | number)[][];
}

interface MathVisualProps {
  config: MathVisualConfig;
}

const COLORS = ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4"];

function safeExprToFn(expr: string): (x: number) => number {
  const sanitized = expr
    .replace(/\^(\d+)/g, "**$1")
    .replace(/\^(\([^)]+\))/g, "**$1")
    .replace(/sin/g, "Math.sin")
    .replace(/cos/g, "Math.cos")
    .replace(/tan/g, "Math.tan")
    .replace(/sqrt/g, "Math.sqrt")
    .replace(/abs/g, "Math.abs")
    .replace(/log/g, "Math.log")
    .replace(/pi/gi, "Math.PI")
    .replace(/e(?![a-zA-Z])/g, "Math.E");
  try {
    return new Function("x", `return ${sanitized}`) as (x: number) => number;
  } catch {
    return (x: number) => x;
  }
}

export function MathVisual({ config }: MathVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<{ zoomIn: () => void; zoomOut: () => void; zoom100: () => void } | null>(null);
  const [showZoom, setShowZoom] = useState(false);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    const t = config.type;

    // Types rendered as HTML (no JSXGraph)
    if (["shapes", "bar", "pie", "table"].includes(t)) return;

    import("jsxgraph").then((JXG) => {
      boardRef.current = null;
      setShowZoom(false);
      const boardId = `jxg-${Math.random().toString(36).slice(2)}`;
      containerRef.current!.id = boardId;

      if (t === "numberline") {
        const lo = config.min ?? 0;
        const hi = config.max ?? 10;
        const board = JXG.JSXGraph.initBoard(boardId, {
          boundingbox: [lo - 1, 3, hi + 1, -1],
          axis: false,
          showNavigation: false,
          showCopyright: false,
        });
        board.create("axis", [[lo, 0], [1, 0]]);
        config.points?.forEach((p) => {
          board.create("point", [p, 0], {
            size: 6, color: "#7c3aed", name: String(p),
            label: { fontSize: 14, color: "#374151" },
          });
        });

      } else if (t === "parabola" || t === "function" || t === "graph") {
        const xMin = config.min ?? -5;
        const xMax = config.max ?? 5;
        const exprs = config.expressions ?? [{ expr: config.expression ?? "x*x", color: "#7c3aed" }];
        let yMin = -2, yMax = 12;
        exprs.forEach((e) => {
          const fn = safeExprToFn(e.expr);
          for (let x = xMin; x <= xMax; x += 0.25) {
            const y = fn(x);
            if (isFinite(y)) {
              if (y < yMin) yMin = y;
              if (y > yMax) yMax = y;
            }
          }
        });
        // Normal scale: cap default y range so axis ticks are 2, 5, 10 not 50, 100
        const maxYExtent = 24;
        const yExtent = yMax - yMin;
        if (yExtent > maxYExtent) {
          const mid = (yMin + yMax) / 2;
          yMin = mid - maxYExtent / 2;
          yMax = mid + maxYExtent / 2;
        }
        const pad = Math.max((yMax - yMin) * 0.1, 0.5);
        const board = JXG.JSXGraph.initBoard(boardId, {
          boundingbox: [xMin - 0.3, yMax + pad, xMax + 0.3, yMin - pad],
          axis: true,
          showNavigation: false,
          showCopyright: false,
          keepAspectRatio: true,
          zoom: { wheel: true, needshift: false, factorX: 1.25, factorY: 1.25 },
          pan: { needShift: true },
        });
        exprs.forEach((e, i) => {
          const fn = safeExprToFn(e.expr);
          board.create("functiongraph", [fn, config.min ?? -10, config.max ?? 10], {
            strokeColor: e.color ?? COLORS[i % COLORS.length],
            strokeWidth: 3,
          });
        });
        boardRef.current = {
          zoomIn: () => board.zoomIn(),
          zoomOut: () => board.zoomOut(),
          zoom100: () => board.zoom100(),
        };
        setShowZoom(true);

      } else if (t === "coordinate" || t === "scatter") {
        const coords = config.coordinates ?? [];
        const xs = coords.map((c) => c.x);
        const ys = coords.map((c) => c.y);
        const xMin = Math.min(...xs, 0) - 1;
        const xMax = Math.max(...xs, 5) + 1;
        const yMin = Math.min(...ys, 0) - 1;
        const yMax = Math.max(...ys, 5) + 1;
        const board = JXG.JSXGraph.initBoard(boardId, {
          boundingbox: [xMin, yMax, xMax, yMin],
          axis: true,
          showNavigation: false,
          showCopyright: false,
        });
        coords.forEach((c, i) => {
          board.create("point", [c.x, c.y], {
            size: 6, color: COLORS[i % COLORS.length],
            name: c.label ?? `(${c.x},${c.y})`,
            label: { fontSize: 12, color: "#374151" },
          });
        });

      } else if (t === "geometry") {
        const verts = config.vertices ?? [];
        const allX = verts.map((v) => v.x);
        const allY = verts.map((v) => v.y);
        const xMin = Math.min(...allX, 0) - 2;
        const xMax = Math.max(...allX, 5) + 2;
        const yMin = Math.min(...allY, 0) - 2;
        const yMax = Math.max(...allY, 5) + 2;
        const board = JXG.JSXGraph.initBoard(boardId, {
          boundingbox: [xMin, yMax, xMax, yMin],
          axis: true,
          showNavigation: false,
          showCopyright: false,
        });
        const pts = verts.map((v, i) => {
          return board.create("point", [v.x, v.y], {
            size: 5, color: COLORS[i % COLORS.length],
            name: v.label ?? "",
            label: { fontSize: 13, color: "#374151" },
          });
        });
        if (pts.length >= 3) {
          board.create("polygon", pts, {
            fillColor: "#7c3aed", fillOpacity: 0.12,
            borders: { strokeColor: "#7c3aed", strokeWidth: 2 },
          });
        } else if (pts.length === 2) {
          board.create("segment", [pts[0], pts[1]], {
            strokeColor: "#7c3aed", strokeWidth: 2,
          });
        }
        config.segments?.forEach((s) => {
          const a = board.create("point", [s[0], s[1]], { visible: false });
          const b = board.create("point", [s[2], s[3]], { visible: false });
          board.create("segment", [a, b], { strokeColor: "#6d28d9", strokeWidth: 2 });
        });
        config.circles?.forEach((c, i) => {
          const center = board.create("point", [c.cx, c.cy], {
            visible: false, name: c.label ?? "",
          });
          board.create("circle", [center, c.r], {
            strokeColor: COLORS[i % COLORS.length], strokeWidth: 2,
            fillColor: COLORS[i % COLORS.length], fillOpacity: 0.08,
          });
        });

      } else if (t === "fraction") {
        const denom = config.denominator ?? 4;
        const numer = config.numerator ?? 1;
        const width = 4;
        const sliceWidth = width / denom;
        const board = JXG.JSXGraph.initBoard(boardId, {
          boundingbox: [-1, 5, 5, -1],
          axis: false,
          showNavigation: false,
          showCopyright: false,
        });
        for (let i = 0; i < denom; i++) {
          const color = i < numer ? "#7c3aed" : "#e5e7eb";
          board.create("polygon", [
            [i * sliceWidth, 0],
            [(i + 1) * sliceWidth, 0],
            [(i + 1) * sliceWidth, 2],
            [i * sliceWidth, 2],
          ], {
            fillColor: color, fillOpacity: 0.6,
            borders: { strokeColor: "#6d28d9", strokeWidth: 2 },
            vertices: { visible: false },
          });
        }
      }
    });

    return () => {
      boardRef.current = null;
      setShowZoom(false);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [config]);

  // ── HTML-rendered types ──

  if (config.type === "shapes") {
    return (
      <div className="my-3 rounded-xl bg-white border border-violet-100 overflow-hidden">
        {config.label && <Label text={config.label} />}
        <div className="p-4 flex flex-wrap gap-2 justify-center">
          {config.shapes?.map((group, gi) => (
            <div key={gi} className="flex gap-1 items-center">
              {Array.from({ length: group.count }).map((_, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: group.color ?? COLORS[gi % COLORS.length] }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                >
                  {group.shape === "circle" ? "●" : "■"}
                </div>
              ))}
              {gi < (config.shapes?.length ?? 0) - 1 && (
                <span className="text-xl font-bold text-violet-600 mx-2">+</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (config.type === "bar") {
    const bars = config.bars ?? [];
    const maxVal = Math.max(...bars.map((b) => b.value), 1);
    return (
      <div className="my-3 rounded-xl bg-white border border-violet-100 overflow-hidden">
        {config.label && <Label text={config.label} />}
        <div className="p-4 space-y-2">
          {bars.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-medium w-16 text-right truncate text-gray-600">{b.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(b.value / maxVal) * 100}%`,
                    backgroundColor: b.color ?? COLORS[i % COLORS.length],
                  }}
                />
              </div>
              <span className="text-xs font-semibold w-8 text-gray-700">{b.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (config.type === "pie") {
    const slices = config.slices ?? [];
    const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
    let cumAngle = 0;
    const size = 120;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;
    const paths = slices.map((sl, i) => {
      const angle = (sl.value / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(cumAngle);
      const y1 = cy + r * Math.sin(cumAngle);
      cumAngle += angle;
      const x2 = cx + r * Math.cos(cumAngle);
      const y2 = cy + r * Math.sin(cumAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      return (
        <path
          key={i}
          d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`}
          fill={sl.color ?? COLORS[i % COLORS.length]}
          stroke="white"
          strokeWidth="2"
        />
      );
    });
    return (
      <div className="my-3 rounded-xl bg-white border border-violet-100 overflow-hidden">
        {config.label && <Label text={config.label} />}
        <div className="p-4 flex items-center gap-4 justify-center">
          <svg width={size} height={size}>{paths}</svg>
          <div className="space-y-1">
            {slices.map((sl, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: sl.color ?? COLORS[i % COLORS.length] }} />
                <span className="text-gray-700">{sl.label} ({sl.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (config.type === "table") {
    return (
      <div className="my-3 rounded-xl bg-white border border-violet-100 overflow-hidden">
        {config.label && <Label text={config.label} />}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {config.headers && (
              <thead>
                <tr className="bg-violet-50">
                  {config.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 font-semibold text-violet-700 text-left border-b border-violet-100">{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {config.rows?.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-violet-50/30"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 border-b border-violet-50 text-gray-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // JSXGraph-rendered types (including graph with zoom)
  const isGraph = ["parabola", "function", "graph"].includes(config.type);
  return (
    <div className="my-3 rounded-xl bg-white border border-violet-100 overflow-hidden">
      {config.label && <Label text={config.label} />}
      {isGraph && showZoom && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-violet-100 bg-violet-50/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-violet-600 hover:bg-violet-100"
            onClick={() => boardRef.current?.zoomIn()}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-violet-600 hover:bg-violet-100"
            onClick={() => boardRef.current?.zoomOut()}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-violet-600 hover:bg-violet-100"
            onClick={() => boardRef.current?.zoom100()}
            title="Reset view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] text-violet-500 ml-1">Scroll to zoom</span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-56" />
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div className="px-3 py-2 bg-violet-50 text-sm font-medium text-violet-700 border-b border-violet-100">
      {text}
    </div>
  );
}
