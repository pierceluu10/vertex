"use client";

import { useEffect, useRef } from "react";

interface MathVisualProps {
  config: {
    type: string;
    min?: number;
    max?: number;
    points?: number[];
    label?: string;
    shapes?: Array<{ shape: string; count: number }>;
    numerator?: number;
    denominator?: number;
  };
}

export function MathVisual({ config }: MathVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    // Dynamic import to avoid SSR issues
    import("jsxgraph").then((JXG) => {
      const boardId = `jxg-${Math.random().toString(36).slice(2)}`;
      containerRef.current!.id = boardId;

      if (config.type === "numberline") {
        const board = JXG.JSXGraph.initBoard(boardId, {
          boundingbox: [
            (config.min ?? 0) - 1,
            3,
            (config.max ?? 10) + 1,
            -1,
          ],
          axis: false,
          showNavigation: false,
          showCopyright: false,
        });

        board.create("axis", [
          [config.min ?? 0, 0],
          [1, 0],
        ]);

        config.points?.forEach((p) => {
          board.create("point", [p, 0], {
            size: 6,
            color: "#7c3aed",
            name: String(p),
            label: { fontSize: 14, color: "#374151" },
          });
        });
      } else if (config.type === "fraction") {
        const board = JXG.JSXGraph.initBoard(boardId, {
          boundingbox: [-1, 5, 5, -1],
          axis: false,
          showNavigation: false,
          showCopyright: false,
        });

        const denom = config.denominator ?? 4;
        const numer = config.numerator ?? 1;
        const width = 4;
        const sliceWidth = width / denom;

        for (let i = 0; i < denom; i++) {
          const color = i < numer ? "#7c3aed" : "#e5e7eb";
          board.create(
            "polygon",
            [
              [i * sliceWidth, 0],
              [(i + 1) * sliceWidth, 0],
              [(i + 1) * sliceWidth, 2],
              [i * sliceWidth, 2],
            ],
            {
              fillColor: color,
              fillOpacity: 0.6,
              borders: {
                strokeColor: "#6d28d9",
                strokeWidth: 2,
              },
              vertices: { visible: false },
            }
          );
        }
      }
    });

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [config]);

  return (
    <div className="my-3 rounded-xl bg-white border border-violet-100 overflow-hidden">
      {config.label && (
        <div className="px-3 py-2 bg-violet-50 text-sm font-medium text-violet-700 border-b border-violet-100">
          {config.label}
        </div>
      )}
      {config.type === "shapes" ? (
        <div className="p-4 flex flex-wrap gap-2 justify-center">
          {config.shapes?.map((group, gi) => (
            <div key={gi} className="flex gap-1 items-center">
              {Array.from({ length: group.count }).map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-lg ${
                    gi === 0
                      ? "bg-violet-400"
                      : "bg-pink-400"
                  } flex items-center justify-center text-white text-xs font-bold shadow-sm`}
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
      ) : (
        <div ref={containerRef} className="w-full h-48" />
      )}
    </div>
  );
}
