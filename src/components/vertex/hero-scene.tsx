"use client";

import { motion } from "framer-motion";

export function HeroScene() {
  return (
    <section className="vtx-hero">
      <motion.div
        className="vtx-scene-wrapper"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
      >
        <svg className="vtx-scene-svg" viewBox="0 0 860 508" xmlns="http://www.w3.org/2000/svg" fill="none">

          {/* Ghost title */}
          <text x="430" y="66" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="68" fontWeight="700" fill="rgba(58,48,38,.44)" letterSpacing="26">VERTEX</text>
          <text x="430" y="98" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="15" fontWeight="600" fill="rgba(112,97,80,.8)" letterSpacing="8">INTELLIGENCE &middot; CURIOSITY &middot; GROWTH</text>

          {/* Parent — stroke outline: broader shoulders, collar, composed silhouette */}
          <g fill="none" stroke="#1a1610" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,48)">
            <path d="M210 106 C172 106,142 124,138 154 C134 182,142 206,154 222 C146 232,144 252,152 266 C160 278,182 284,210 284 C238 284,260 278,268 266 C276 252,274 232,266 222 C278 206,282 182,278 154 C274 124,248 106,210 106 Z"/>
            <path d="M158 154 C156 130,168 110,182 104 C192 98,204 96,210 96 C216 96,228 98,238 104 C250 110,260 130,260 150 Q246 140,210 138 Q174 140,158 154 Z"/>
            <path d="M198 232 L222 232 M198 238 L218 238"/>
            <path d="M181 198 Q209 194 237 198"/>
            <ellipse cx="266" cy="212" rx="9" ry="14"/>
            <path d="M194 276 Q210 282 226 276 L228 306 Q210 312 192 306 Z"/>
            <path d="M136 308 Q168 292,210 290 Q252 292,280 306 L288 358 Q210 372,132 358 Z"/>
          </g>

          {/* Student — stroke outline: no cap, glasses, more hair, no book or cheek shape */}
          <g fill="none" stroke="#1a1610" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,48)">
            <path d="M650 108 C608 108,580 124,578 154 C576 182,584 204,596 218 C588 228,586 248,594 262 C602 274,620 280,650 280 C680 280,698 274,706 262 C714 248,712 228,704 218 C716 204,722 182,720 154 C718 124,692 108,650 108 Z"/>
            <path d="M598 152 C598 118,618 92,650 92 C682 92,702 118,702 152 Q686 138,650 136 Q614 138,598 152 Z"/>
            <ellipse cx="612" cy="206" rx="24" ry="18"/>
            <ellipse cx="688" cy="206" rx="24" ry="18"/>
            <path d="M636 206 L664 206"/>
            <ellipse cx="650" cy="208" rx="6" ry="7"/>
            <path d="M582 152 Q570 200,571 258 Q572 314,578 364"/>
            <path d="M592 156 Q582 198,583 256 Q584 312,589 364"/>
            <path d="M606 158 Q598 198,599 256 Q600 312,605 364"/>
            <path d="M718 152 Q730 198,728 256 Q726 310,722 362"/>
            <path d="M708 158 Q718 196,717 254 Q716 310,712 362"/>
            <path d="M698 162 Q706 198,705 256 Q704 312,700 362"/>
            <path d="M634 276 Q650 282 666 276 L668 306 Q650 312 632 306 Z"/>
            <path d="M586 308 Q614 294,650 292 Q686 294,714 308 L722 358 Q650 371,578 358 Z"/>
          </g>

          {/* Connection lines (drawn under logo): parent → logo → student — paths meet the triangle */}
          <path d="M262 258 Q318 256 378 255" stroke="rgba(200,65,106,0.65)" strokeWidth="2.5">
            <animate attributeName="opacity" values=".4;.9;.4" dur="2.6s" repeatCount="indefinite"/>
          </path>
          <circle r="5" fill="#c8416a">
            <animateMotion dur="2s" repeatCount="indefinite" path="M262 258 Q318 256 378 255"/>
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle r="3" fill="#c8416a">
            <animateMotion dur="2s" begin=".65s" repeatCount="indefinite" path="M262 258 Q318 256 378 255"/>
            <animate attributeName="opacity" values="0;.7;0" dur="2s" begin=".65s" repeatCount="indefinite"/>
          </circle>
          <path d="M482 255 Q546 256 598 258" stroke="rgba(200,65,106,0.65)" strokeWidth="2.5">
            <animate attributeName="opacity" values=".4;.9;.4" dur="2.6s" begin=".35s" repeatCount="indefinite"/>
          </path>
          <circle r="5" fill="#c8416a">
            <animateMotion dur="2s" begin=".4s" repeatCount="indefinite" path="M482 255 Q546 256 598 258"/>
            <animate attributeName="opacity" values="0;1;0" dur="2s" begin=".4s" repeatCount="indefinite"/>
          </circle>
          <circle r="3" fill="#c8416a">
            <animateMotion dur="2s" begin="1.1s" repeatCount="indefinite" path="M482 255 Q546 256 598 258"/>
            <animate attributeName="opacity" values="0;.7;0" dur="2s" begin="1.1s" repeatCount="indefinite"/>
          </circle>

          {/* Logo + "Vertex" label — transparent PNG, no blend */}
          <image
            href="/vertex-logo.png"
            x="330"
            y="164"
            width="200"
            height="140"
            preserveAspectRatio="xMidYMid meet"
          />
          <text x="430" y="320" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="18" fill="#c8416a" letterSpacing="6" fontWeight="600">Vertex</text>

          {/* Labels */}
          <text x="210" y="446" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="15" fontWeight="600" fill="rgba(112,97,80,.9)" letterSpacing="4">PARENT</text>
          <text x="650" y="446" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="15" fontWeight="600" fill="rgba(112,97,80,.9)" letterSpacing="4">STUDENT</text>

          <line x1="60" y1="418" x2="800" y2="418" stroke="rgba(26,22,14,.06)" strokeWidth="1"/>
        </svg>
      </motion.div>

      <motion.div
        className="vtx-hero-bottom"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <div className="vtx-scroll-hint">
          <span>Interactive learning</span>
          <div className="vtx-scroll-line"></div>
        </div>
      </motion.div>
    </section>
  );
}
