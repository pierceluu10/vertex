"use client";

import { motion } from "framer-motion";

export function HeroScene() {
  return (
    <section className="vtx-hero">
      <motion.div
        className="vtx-hero-tagline"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <span>AI-Powered Learning for the Next Generation</span>
      </motion.div>

      <motion.div
        className="vtx-scene-wrapper"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
      >
        <svg className="vtx-scene-svg" viewBox="0 0 860 460" xmlns="http://www.w3.org/2000/svg" fill="none">
          <defs>
            <filter id="brainGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="12" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="figShadow" x="-20%" y="-10%" width="140%" height="130%">
              <feDropShadow dx="0" dy="10" stdDeviation="18" floodColor="rgba(26,22,14,.13)"/>
            </filter>
            <filter id="lineGlow" x="-20%" y="-80%" width="140%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <radialGradient id="brainAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(200,65,106,.18)"/>
              <stop offset="100%" stopColor="rgba(200,65,106,0)"/>
            </radialGradient>
            <linearGradient id="connL" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(26,22,14,.1)"/>
              <stop offset="100%" stopColor="rgba(200,65,106,.75)"/>
            </linearGradient>
            <linearGradient id="connR" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(200,65,106,.75)"/>
              <stop offset="100%" stopColor="rgba(26,22,14,.1)"/>
            </linearGradient>
            <linearGradient id="manGrad" x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="#2c2720"/>
              <stop offset="100%" stopColor="#16130e"/>
            </linearGradient>
            <linearGradient id="girlGrad" x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="#201c16"/>
              <stop offset="100%" stopColor="#0e0c08"/>
            </linearGradient>
          </defs>

          {/* Ghost title */}
          <text x="430" y="54" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="50" fontWeight="700" fill="rgba(26,22,14,.35)" letterSpacing="22">VERTEX</text>
          <text x="430" y="76" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="9.5" fill="rgba(138,127,110,.45)" letterSpacing="7">INTELLIGENCE &middot; CURIOSITY &middot; GROWTH</text>

          {/* Man — stroke outline */}
          <g fill="none" stroke="#1a1610" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M210 108 C175 108,148 124,144 152 C140 178,148 202,158 218 C150 228,148 248,155 262 C162 274,180 280,210 280 C240 280,256 272,262 260 C268 246,264 228,258 218 C268 202,272 178,268 152 C264 124,245 108,210 108 Z"/>
            <path d="M160 152 C158 130,168 112,180 106 C190 100,202 98,210 98 C218 98,228 100,236 106 C246 112,254 130,254 148 Q240 140,210 140 Q180 140,160 152 Z"/>
            <ellipse cx="258" cy="210" rx="9" ry="14"/>
            <path d="M196 278 Q210 284 224 278 L226 308 Q210 315 194 308 Z"/>
            <path d="M140 310 Q170 296,210 294 Q250 296,264 306 L272 360 Q210 374,148 360 Z"/>
          </g>

          {/* Girl — stroke outline */}
          <g fill="none" stroke="#1a1610" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M650 106 C615 106,590 122,586 150 C582 176,590 200,600 216 C592 226,590 246,597 260 C604 272,622 278,650 278 C678 278,694 270,700 258 C706 244,702 226,696 216 C706 200,714 176,710 150 C706 122,685 106,650 106 Z"/>
            <path d="M598 148 C598 126,610 108,622 102 C632 96,642 94,650 94 C658 94,668 96,676 102 C686 108,700 128,700 148 Q685 134,650 132 Q615 134,598 148 Z"/>
            <path d="M596 148 Q584 200,585 260 Q586 320,592 368"/>
            <path d="M610 156 Q601 198,602 258 Q603 318,608 368"/>
            <path d="M704 148 Q716 195,714 255 Q713 310,708 360"/>
            <path d="M690 158 Q701 194,700 254 Q699 312,694 360"/>
            <ellipse cx="602" cy="208" rx="8" ry="13"/>
            <circle cx="602" cy="223" r="3" stroke="#c8416a" strokeWidth="1.5" fill="none"/>
            <path d="M636 276 Q650 282 664 276 L666 306 Q650 313 634 306 Z"/>
            <path d="M588 308 Q616 294,650 292 Q684 294,712 308 L720 360 Q650 373,580 360 Z"/>
          </g>

          {/* Connection lines (drawn under logo): parent → logo → student — paths meet the triangle */}
          <path d="M262 210 Q318 208 378 207" stroke="url(#connL)" strokeWidth="1.5" filter="url(#lineGlow)">
            <animate attributeName="opacity" values=".3;.85;.3" dur="2.6s" repeatCount="indefinite"/>
          </path>
          <circle r="3.5" fill="#c8416a">
            <animateMotion dur="2s" repeatCount="indefinite" path="M262 210 Q318 208 378 207"/>
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle r="2" fill="#c8416a">
            <animateMotion dur="2s" begin=".65s" repeatCount="indefinite" path="M262 210 Q318 208 378 207"/>
            <animate attributeName="opacity" values="0;.7;0" dur="2s" begin=".65s" repeatCount="indefinite"/>
          </circle>
          <path d="M482 207 Q546 208 598 210" stroke="url(#connR)" strokeWidth="1.5" filter="url(#lineGlow)">
            <animate attributeName="opacity" values=".3;.85;.3" dur="2.6s" begin=".35s" repeatCount="indefinite"/>
          </path>
          <circle r="3.5" fill="#c8416a">
            <animateMotion dur="2s" begin=".4s" repeatCount="indefinite" path="M482 207 Q546 208 598 210"/>
            <animate attributeName="opacity" values="0;1;0" dur="2s" begin=".4s" repeatCount="indefinite"/>
          </circle>
          <circle r="2" fill="#c8416a">
            <animateMotion dur="2s" begin="1.1s" repeatCount="indefinite" path="M482 207 Q546 208 598 210"/>
            <animate attributeName="opacity" values="0;.7;0" dur="2s" begin="1.1s" repeatCount="indefinite"/>
          </circle>

          {/* Logo + "Vertex" label — transparent PNG, no blend */}
          <image
            href="/vertex-logo.png"
            x="330"
            y="116"
            width="200"
            height="140"
            preserveAspectRatio="xMidYMid meet"
          />
          <text x="430" y="268" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="10" fill="#c8416a" letterSpacing="5" opacity="0.9">Vertex</text>

          {/* Labels */}
          <text x="210" y="398" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="9" fill="#afa598" letterSpacing="3.5">PARENT</text>
          <text x="650" y="398" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="9" fill="#afa598" letterSpacing="3.5">STUDENT</text>

          <line x1="60" y1="370" x2="800" y2="370" stroke="rgba(26,22,14,.06)" strokeWidth="1"/>
        </svg>
      </motion.div>

      <motion.div
        className="vtx-hero-bottom"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <div className="vtx-scroll-hint">
          <span>Explore</span>
          <div className="vtx-scroll-line"></div>
        </div>
      </motion.div>
    </section>
  );
}
