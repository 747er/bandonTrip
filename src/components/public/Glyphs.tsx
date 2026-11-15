// Line icons drawn for this site: weather states and event types. All inherit text color.

type Props = { size?: number; className?: string };

function Svg({ size = 24, className = "", children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const cloud = "M7 18.5h9.5a3.5 3.500 0 0 0 .6-6.950A5 5 0 0 0 7.600 10.200 4.200 4.200 0 0 0 7 18.500Z";

export function WeatherGlyph({ kind, ...props }: Props & { kind: string }) {
  switch (kind) {
    case "clear":
      return (
        <Svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600l1.400 1.400M17 17l1.400 1.400M5.600 18.400 7 17M17 7l1.400-1.400" />
        </Svg>
      );
    case "partly":
      return (
        <Svg {...props}>
          <circle cx="8.500" cy="8" r="3" />
          <path d="M8.500 2.500v1.300M3 8h1.300M4.600 4.100l.9.900M12.400 4.100l-.9.900" />
          <path d="M9 19.500h8a3 3 0 0 0 .5-5.950 4.300 4.300 0 0 0-8.100-1.150A3.600 3.600 0 0 0 9 19.500Z" />
        </Svg>
      );
    case "fog":
      return (
        <Svg {...props}>
          <path d="M4 9h13M7 13h13M4 17h11" />
        </Svg>
      );
    case "drizzle":
      return (
        <Svg {...props}>
          <path d={cloud} transform="translate(0 -3)" />
          <path d="M9 19v1.500M13 19v1.500" />
        </Svg>
      );
    case "rain":
      return (
        <Svg {...props}>
          <path d={cloud} transform="translate(0 -3)" />
          <path d="M8.500 18.500l-1 2.500M12.500 18.500l-1 2.500M16.500 18.500l-1 2.500" />
        </Svg>
      );
    case "snow":
      return (
        <Svg {...props}>
          <path d={cloud} transform="translate(0 -3)" />
          <path d="M9 19.500h.01M12.500 21h.01M16 19.500h.01" strokeWidth="2" />
        </Svg>
      );
    case "storm":
      return (
        <Svg {...props}>
          <path d={cloud} transform="translate(0 -3)" />
          <path d="M12.500 17l-2 3h3l-2 3" />
        </Svg>
      );
    default:
      return (
        <Svg {...props}>
          <path d={cloud} />
        </Svg>
      );
  }
}

export function WindGlyph(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 9h10.500a2.500 2.500 0 1 0-2.500-2.500M3 13h15a2.500 2.500 0 1 1-2.500 2.500M3 17h7" />
    </Svg>
  );
}

export function TypeGlyph({ type, ...props }: Props & { type: string }) {
  switch (type) {
    case "golf":
      return (
        <Svg {...props}>
          <path d="M9 20V4l9 3.500L9 11" />
          <path d="M5 20.500c1.300-.700 2.600-1 4-1s2.700.300 4 1" />
        </Svg>
      );
    case "dining":
      return (
        <Svg {...props}>
          <path d="M7 3v7a2 2 0 0 0 2 2v9M5 3v5M9 3v5M11 3v5" />
          <path d="M17 21V3c-2 1.500-3 4-3 7 0 1.700 1 3 3 3" />
        </Svg>
      );
    case "lodging":
      return (
        <Svg {...props}>
          <path d="M3 18v-8M3 15h18v3M21 15v-2a3 3 0 0 0-3-3h-7v5" />
          <circle cx="7" cy="11.500" r="1.500" />
        </Svg>
      );
    default:
      return (
        <Svg {...props}>
          <path d="M12 21s6-5.400 6-10a6 6 0 1 0-12 0c0 4.600 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2" />
        </Svg>
      );
  }
}
