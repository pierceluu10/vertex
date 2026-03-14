"use client";

export function HeroScene() {
  return (
    <section className="vtx-hero">
      <div className="vtx-hero-tagline">
        <span>AI-Powered Learning for the Next Generation</span>
      </div>

      <div className="vtx-scene-wrapper">
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

          {/* Brain */}
          <ellipse cx="430" cy="196" rx="96" ry="88" fill="url(#brainAura)"/>
          <ellipse cx="430" cy="196" rx="64" ry="60" fill="url(#brainAura)"/>

          <g style={{ animation: "vtxBrainPulse 3.5s ease-in-out infinite" }}>
            <path d="M412 158 C396 149,374 151,366 165 C358 179,360 198,369 210 C360 221,358 244,371 256 C381 267,400 268,412 260 C416 265,424 268,430 266 L430 158 Z" fill="#c8416a" opacity="0.94" filter="url(#brainGlow)"/>
            <path d="M448 158 C464 149,486 151,494 165 C502 179,500 198,491 210 C500 221,502 244,489 256 C479 267,460 268,448 260 C444 265,436 268,430 266 L430 158 Z" fill="#b83060" opacity="0.91" filter="url(#brainGlow)"/>
            <path d="M416 158 Q430 146,444 158" fill="#d4607e" opacity="0.95" filter="url(#brainGlow)"/>
            <line x1="430" y1="148" x2="430" y2="266" stroke="#9c2850" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.55"/>
            <path d="M376 181 Q392 170,403 181 Q392 193,376 181" fill="none" stroke="#9c2850" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
            <path d="M371 210 Q388 198,399 210 Q388 222,371 210" fill="none" stroke="#9c2850" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
            <path d="M374 237 Q389 228,400 237" fill="none" stroke="#9c2850" strokeWidth="1.5" strokeLinecap="round" opacity="0.42"/>
            <path d="M484 181 Q468 170,457 181 Q468 193,484 181" fill="none" stroke="#9c2850" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
            <path d="M489 210 Q472 198,461 210 Q472 222,489 210" fill="none" stroke="#9c2850" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
            <path d="M486 237 Q471 228,460 237" fill="none" stroke="#9c2850" strokeWidth="1.5" strokeLinecap="round" opacity="0.42"/>
            <path d="M382 258 Q393 270,411 269" fill="none" stroke="#9c2850" strokeWidth="1.5" strokeLinecap="round" opacity="0.38"/>
            <path d="M478 258 Q467 270,449 269" fill="none" stroke="#9c2850" strokeWidth="1.5" strokeLinecap="round" opacity="0.38"/>
          </g>

          {/* Neural connection lines */}
          <path d="M262 210 Q314 208 366 207" stroke="url(#connL)" strokeWidth="1.5" filter="url(#lineGlow)">
            <animate attributeName="opacity" values=".3;.85;.3" dur="2.6s" repeatCount="indefinite"/>
          </path>
          <circle r="3.5" fill="#c8416a">
            <animateMotion dur="2s" repeatCount="indefinite" path="M262 210 Q314 208 366 207"/>
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle r="2" fill="#c8416a">
            <animateMotion dur="2s" begin=".65s" repeatCount="indefinite" path="M262 210 Q314 208 366 207"/>
            <animate attributeName="opacity" values="0;.7;0" dur="2s" begin=".65s" repeatCount="indefinite"/>
          </circle>

          <path d="M494 207 Q546 208 598 210" stroke="url(#connR)" strokeWidth="1.5" filter="url(#lineGlow)">
            <animate attributeName="opacity" values=".3;.85;.3" dur="2.6s" begin=".35s" repeatCount="indefinite"/>
          </path>
          <circle r="3.5" fill="#c8416a">
            <animateMotion dur="2s" begin=".4s" repeatCount="indefinite" path="M494 207 Q546 208 598 210"/>
            <animate attributeName="opacity" values="0;1;0" dur="2s" begin=".4s" repeatCount="indefinite"/>
          </circle>
          <circle r="2" fill="#c8416a">
            <animateMotion dur="2s" begin="1.1s" repeatCount="indefinite" path="M494 207 Q546 208 598 210"/>
            <animate attributeName="opacity" values="0;.7;0" dur="2s" begin="1.1s" repeatCount="indefinite"/>
          </circle>

          {/* Floating sparks */}
          <circle cx="420" cy="140" r="2.5" fill="#c8416a" opacity=".5" style={{ animation: "vtxDrift 3.2s ease-in-out infinite" }}/>
          <circle cx="440" cy="136" r="1.8" fill="#c8416a" opacity=".4" style={{ animation: "vtxDrift 2.8s ease-in-out infinite .5s" }}/>
          <circle cx="408" cy="272" r="2" fill="#c8416a" opacity=".35" style={{ animation: "vtxDrift 4s ease-in-out infinite 1s" }}/>
          <circle cx="452" cy="269" r="1.6" fill="#c8416a" opacity=".3" style={{ animation: "vtxDrift 3.6s ease-in-out infinite 1.4s" }}/>
          <circle cx="360" cy="200" r="1.5" fill="#c8416a" opacity=".28" style={{ animation: "vtxDrift 3s ease-in-out infinite .2s" }}/>
          <circle cx="500" cy="202" r="1.5" fill="#c8416a" opacity=".28" style={{ animation: "vtxDrift 3.4s ease-in-out infinite .9s" }}/>

          {/* Labels */}
          <text x="210" y="398" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="9" fill="#afa598" letterSpacing="3.5">PARENT</text>
          <text x="650" y="398" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="9" fill="#afa598" letterSpacing="3.5">STUDENT</text>
          <text x="430" y="292" textAnchor="middle" fontFamily="Calibri,Trebuchet MS,sans-serif" fontSize="10" fill="#c8416a" letterSpacing="5" opacity=".65">VERTEX</text>

          <line x1="60" y1="370" x2="800" y2="370" stroke="rgba(26,22,14,.06)" strokeWidth="1"/>
        </svg>
      </div>

      <div className="vtx-hero-bottom">
        <div className="vtx-scroll-hint">
          <span>Explore</span>
          <div className="vtx-scroll-line"></div>
        </div>
      </div>
    </section>
  );
}
