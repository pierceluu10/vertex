"use client";

import { motion } from "framer-motion";

function FloatingShape({
  children,
  className,
  delay = 0,
  duration = 6,
  y = 15,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={`absolute ${className}`}
      animate={{ y: [0, -y, 0] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

export function HeroShapes() {
  return (
    <div className="relative w-full h-full min-h-[500px]">
      {/* Large cylinder */}
      <FloatingShape className="top-[15%] left-[20%] z-10" delay={0} duration={7}>
        <div className="w-28 h-36 rounded-2xl bg-gradient-to-b from-[#f9a8d4] to-[#f472b6] shadow-xl relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-gradient-to-b from-[#fecdd3] to-[#f9a8d4]" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </FloatingShape>

      {/* Cone */}
      <FloatingShape className="top-[5%] left-[55%] z-20" delay={0.5} duration={5}>
        <div
          className="w-0 h-0 drop-shadow-lg"
          style={{
            borderLeft: "30px solid transparent",
            borderRight: "30px solid transparent",
            borderBottom: "55px solid #fda4af",
            filter: "drop-shadow(0 8px 16px rgba(253,164,175,0.4))",
          }}
        />
      </FloatingShape>

      {/* Large sphere with stripes */}
      <FloatingShape className="top-[0%] right-[5%] z-10" delay={1} duration={8}>
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#c4b5fd] to-[#8b5cf6] shadow-lg relative overflow-hidden">
          <div className="absolute top-1/4 inset-x-0 h-[3px] bg-white/30 rotate-[-15deg]" />
          <div className="absolute top-1/2 inset-x-0 h-[3px] bg-white/20 rotate-[-15deg]" />
          <div className="absolute top-3/4 inset-x-0 h-[3px] bg-white/30 rotate-[-15deg]" />
        </div>
      </FloatingShape>

      {/* Main large shape cluster - pink arch/torus */}
      <FloatingShape className="top-[25%] left-[35%] z-30" delay={0.2} duration={6}>
        <div className="w-20 h-12 rounded-t-full border-[8px] border-[#7c3aed] border-b-0 opacity-80" />
      </FloatingShape>

      {/* Pink cube */}
      <FloatingShape className="top-[40%] left-[10%] z-20" delay={0.8} duration={7} y={12}>
        <div
          className="w-20 h-20 bg-gradient-to-br from-[#fecdd3] to-[#fda4af] shadow-xl relative"
          style={{ transform: "perspective(200px) rotateX(10deg) rotateY(-15deg)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
        </div>
      </FloatingShape>

      {/* Pyramid */}
      <FloatingShape className="bottom-[25%] left-[50%] z-20" delay={1.2} duration={6} y={10}>
        <div className="relative">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: "35px solid transparent",
              borderRight: "35px solid transparent",
              borderBottom: "60px solid #f9a8d4",
              filter: "drop-shadow(0 4px 12px rgba(249,168,212,0.5))",
            }}
          />
          <div
            className="absolute top-0 left-0 w-0 h-0"
            style={{
              borderLeft: "35px solid transparent",
              borderRight: "35px solid transparent",
              borderBottom: "60px solid rgba(244,114,182,0.3)",
              clipPath: "polygon(50% 0%, 100% 100%, 50% 100%)",
            }}
          />
        </div>
      </FloatingShape>

      {/* Small sphere */}
      <FloatingShape className="top-[35%] right-[10%] z-10" delay={1.5} duration={5} y={20}>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fecdd3] to-[#f9a8d4] shadow-md" />
      </FloatingShape>

      {/* Striped sphere bottom */}
      <FloatingShape className="bottom-[15%] right-[15%] z-20" delay={0.3} duration={7} y={12}>
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ddd6fe] to-[#8b5cf6] shadow-lg relative overflow-hidden">
          <div className="absolute top-[30%] inset-x-0 h-[3px] bg-white/30 rotate-[20deg]" />
          <div className="absolute top-[50%] inset-x-0 h-[3px] bg-white/20 rotate-[20deg]" />
          <div className="absolute top-[70%] inset-x-0 h-[3px] bg-white/30 rotate-[20deg]" />
        </div>
      </FloatingShape>

      {/* Math symbols — subtle, not cluttered */}
      <FloatingShape className="top-[60%] left-[15%] z-40" delay={2} duration={9} y={8}>
        <span className="text-3xl font-bold text-violet-400/60 select-none">π</span>
      </FloatingShape>

      <FloatingShape className="top-[12%] left-[42%] z-40" delay={1.8} duration={8} y={10}>
        <span className="text-2xl font-bold text-violet-300/50 select-none">÷</span>
      </FloatingShape>

      <FloatingShape className="bottom-[30%] right-[25%] z-40" delay={2.5} duration={7} y={6}>
        <span className="text-xl font-bold text-pink-400/50 select-none">×</span>
      </FloatingShape>

      <FloatingShape className="top-[50%] right-[0%] z-40" delay={1} duration={10} y={12}>
        <span className="text-4xl font-light text-violet-300/40 select-none">∑</span>
      </FloatingShape>

      <FloatingShape className="bottom-[10%] left-[40%] z-40" delay={0.6} duration={6} y={8}>
        <span className="text-2xl font-bold text-violet-400/40 select-none">+</span>
      </FloatingShape>

      {/* Diagonal decorative lines */}
      <motion.div
        className="absolute -top-10 -right-10 w-[300px] h-[3px] bg-gradient-to-r from-violet-400 to-violet-300/0 rounded-full z-0"
        style={{ transform: "rotate(-55deg)", transformOrigin: "right top" }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-[10%] -right-5 w-[250px] h-[2px] bg-gradient-to-r from-violet-500 to-violet-300/0 rounded-full z-0"
        style={{ transform: "rotate(-55deg)", transformOrigin: "right top" }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
      />
      <motion.div
        className="absolute top-[20%] right-[10%] w-[200px] h-[2px] bg-gradient-to-r from-violet-400/80 to-transparent rounded-full z-0"
        style={{ transform: "rotate(-55deg)" }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
      />
      <motion.div
        className="absolute top-[5%] right-[25%] w-[180px] h-[3px] bg-gradient-to-r from-violet-500 to-transparent rounded-full z-0"
        style={{ transform: "rotate(-55deg)" }}
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, delay: 2 }}
      />
      <motion.div
        className="absolute top-[15%] right-[5%] w-[150px] h-[2px] bg-gradient-to-r from-violet-300 to-transparent rounded-full z-0"
        style={{ transform: "rotate(-55deg)" }}
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 4.5, repeat: Infinity, delay: 1.5 }}
      />
    </div>
  );
}
