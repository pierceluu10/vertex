"use client";

import { motion } from "framer-motion";
import type { FocusLevel } from "@/types";

interface ParentAvatarProps {
  parentName: string;
  focusLevel: FocusLevel;
  isSpeaking?: boolean;
}

export function ParentAvatar({
  parentName,
  focusLevel,
  isSpeaking,
}: ParentAvatarProps) {
  const ringColor = {
    high: "ring-green-400",
    medium: "ring-yellow-400",
    low: "ring-orange-400",
    critical: "ring-red-400",
  }[focusLevel];

  const bgColor = {
    high: "from-violet-500 to-violet-700",
    medium: "from-yellow-500 to-orange-500",
    low: "from-orange-500 to-red-500",
    critical: "from-red-500 to-red-700",
  }[focusLevel];

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative">
        <motion.div
          className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${bgColor} flex items-center justify-center ring-4 ${ringColor} shadow-lg`}
          animate={
            isSpeaking
              ? { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 0.8 } }
              : {}
          }
        >
          <span className="text-2xl font-bold text-white">
            {parentName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </span>
        </motion.div>
        {isSpeaking && (
          <motion.div
            className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.6 }}
          >
            <div className="w-2 h-2 bg-white rounded-full" />
          </motion.div>
        )}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {parentName.split(" ")[0]}
      </span>
    </motion.div>
  );
}
