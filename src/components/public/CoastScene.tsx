/**
 * The Bandon shoreline, drawn rather than photographed: sea stacks in the mist, a band of
 * surf, dunes, and one fairway running down to a flag. Original artwork, so there is
 * nothing to license. A trip can replace it with a photo (hero image URL in /admin).
 */
export function CoastScene({ className = "" }: { className?: string }) {
  const layer = (i: number) => ({ "--i": i }) as React.CSSProperties;
  return (
    <svg
      className={className}
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aebfbd" />
          <stop offset="0.45" stopColor="#c9d3cf" />
          <stop offset="0.62" stopColor="#e3ddcd" />
        </linearGradient>
        <radialGradient id="sun" cx="0.66" cy="0.52" r="0.42">
          <stop offset="0" stopColor="#f6ecd6" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#f1e6cf" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f1e6cf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fa9a6" />
          <stop offset="1" stopColor="#5f8482" />
        </linearGradient>
        <linearGradient id="fairway" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4d7a5f" />
          <stop offset="1" stopColor="#2c5644" />
        </linearGradient>
        <linearGradient id="fore" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f4034" />
          <stop offset="1" stopColor="#17332b" />
        </linearGradient>
        <filter id="soft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.13  0 0 0 0 0.1  0 0 0 0.55 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      <rect width="800" height="1000" fill="url(#sky)" />
      <rect width="800" height="1000" fill="url(#sun)" />

      {/* Far headland */}
      <g className="coast-layer" style={layer(0)}>
        <path
          d="M0 548 C60 530 120 522 190 528 C240 532 262 546 320 552 L320 566 L0 566 Z"
          fill="#93a8a4"
          opacity="0.7"
        />
      </g>

      {/* Ocean */}
      <g className="coast-layer" style={layer(1)}>
        <rect y="560" width="800" height="150" fill="url(#sea)" />
        <g stroke="#e8ebe4" strokeLinecap="round" opacity="0.5">
          <path d="M60 590 h120" strokeWidth="1.2" />
          <path d="M420 584 h170" strokeWidth="1" />
          <path d="M250 612 h200" strokeWidth="1.4" />
          <path d="M560 626 h180" strokeWidth="1.4" />
          <path d="M20 640 h150" strokeWidth="1.6" />
        </g>
      </g>

      {/* Sea stacks */}
      <g className="coast-layer" style={layer(2)} fill="#3d514c">
        <path d="M468 606 C470 566 484 520 502 508 C512 502 520 512 524 530 C532 560 540 584 542 606 Z" />
        <path d="M566 610 C570 590 578 572 590 566 C600 562 606 574 610 588 C613 598 615 604 616 610 Z" opacity="0.92" />
        <path d="M150 600 C154 584 164 572 178 570 C196 568 204 580 212 600 Z" opacity="0.8" />
        <path d="M640 616 C646 606 654 602 662 604 C670 606 674 612 676 616 Z" opacity="0.85" />
        <g fill="none" stroke="#eef0ea" strokeWidth="2" strokeLinecap="round" opacity="0.7">
          <path d="M458 608 q46 -7 92 0" />
          <path d="M560 612 q30 -5 62 0" />
          <path d="M142 602 q38 -6 76 0" />
        </g>
      </g>

      {/* Drifting mist over the water */}
      <g filter="url(#soft)" fill="#f1efe6">
        <ellipse className="coast-mist" cx="300" cy="560" rx="360" ry="26" opacity="0.75" />
        <ellipse className="coast-mist slow" cx="620" cy="596" rx="300" ry="18" opacity="0.5" />
      </g>

      {/* Surf and beach */}
      <g className="coast-layer" style={layer(3)}>
        <path d="M0 694 C140 676 300 706 470 690 C600 678 720 692 800 684 L800 760 L0 760 Z" fill="#eef0ea" />
        <path d="M0 704 C150 688 300 716 470 700 C610 688 720 702 800 694 L800 780 L0 780 Z" fill="#d6c8a4" />
      </g>

      {/* Back dunes */}
      <g className="coast-layer" style={layer(4)}>
        <path
          d="M0 742 C70 712 150 706 230 730 C300 750 360 716 450 712 C560 708 640 742 800 716 L800 860 L0 860 Z"
          fill="#bcae86"
        />
        <path
          d="M0 770 C90 744 190 748 270 770 C360 794 430 752 520 750 C630 748 700 778 800 758 L800 880 L0 880 Z"
          fill="#a39a72"
          opacity="0.75"
        />
        <g stroke="#6d7a56" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.8">
          <path d="M96 738 q-4 -16 -10 -22 M100 738 q0 -18 2 -26 M104 738 q5 -14 12 -20" />
          <path d="M420 716 q-4 -16 -10 -22 M424 716 q0 -18 2 -26 M428 716 q5 -14 12 -20" />
          <path d="M690 734 q-4 -14 -9 -20 M694 734 q0 -16 2 -24 M698 734 q5 -12 11 -18" />
        </g>
      </g>

      {/* The fairway, running down to the green */}
      <g className="coast-layer" style={layer(5)}>
        <path
          d="M800 792 C690 778 600 800 520 792 C440 784 396 800 352 822 C300 848 220 842 150 870 C90 894 40 930 0 944 L0 1000 L800 1000 Z"
          fill="url(#fairway)"
        />
        <path
          d="M800 826 C700 812 640 836 560 834 C480 832 440 850 396 872 C340 900 250 900 190 930 C150 950 110 978 80 1000 L800 1000 Z"
          fill="#2a5241"
          opacity="0.7"
        />
        {/* Green and pin */}
        <ellipse cx="470" cy="812" rx="74" ry="11" fill="#5a8a6b" />
        <ellipse cx="452" cy="814" rx="34" ry="5" fill="#c9b98f" opacity="0.9" transform="translate(96 14)" />
        <path d="M484 812 V752" stroke="#f3f1ec" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M485 753 L512 761 L485 770 Z" fill="#a65f36" />
        <ellipse cx="484" cy="813" rx="4" ry="1.4" fill="#17332b" />
      </g>

      {/* Foreground dune with marram grass and gorse */}
      <g className="coast-layer" style={layer(6)}>
        <path
          d="M0 880 C80 852 150 866 230 900 C300 930 380 944 470 938 C590 930 680 950 800 928 L800 1000 L0 1000 Z"
          fill="url(#fore)"
        />
        <g stroke="#3f6a53" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M40 886 q-8 -30 -20 -42 M46 884 q-2 -34 4 -50 M52 884 q8 -28 22 -38 M58 886 q12 -18 26 -24" />
          <path d="M150 872 q-8 -28 -18 -38 M156 870 q-1 -32 5 -46 M162 872 q9 -24 22 -32" />
          <path d="M690 942 q-8 -30 -20 -42 M696 940 q-2 -34 4 -50 M702 940 q8 -28 22 -38 M708 942 q12 -18 26 -24" />
          <path d="M600 940 q-6 -22 -14 -30 M605 938 q0 -24 4 -36 M610 940 q7 -18 17 -24" />
        </g>
        <g fill="#d3a52c">
          <circle cx="250" cy="912" r="4" />
          <circle cx="262" cy="906" r="3.2" />
          <circle cx="272" cy="916" r="3.6" />
          <circle cx="284" cy="909" r="2.6" />
          <circle cx="296" cy="920" r="3.2" />
          <circle cx="760" cy="938" r="3.4" />
          <circle cx="772" cy="932" r="2.6" />
        </g>
      </g>

      <rect width="800" height="1000" filter="url(#grain)" opacity="0.22" />
    </svg>
  );
}
