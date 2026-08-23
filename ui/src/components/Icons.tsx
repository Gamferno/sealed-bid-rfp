import type { CSSProperties, SVGProps } from 'react';

type IconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
};

function base(size: number, className?: string, style?: CSSProperties): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    style,
  };
}

export function IconWallet({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="17" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconLogout({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconShield({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

export function IconLock({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function IconUnlock({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}

export function IconTrophy({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4a3 3 0 0 0 3 5" />
      <path d="M17 6h3a3 3 0 0 1-3 5" />
    </svg>
  );
}

export function IconFile({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" />
      <path d="M14 3v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

export function IconCopy({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconCheck({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function IconX({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  );
}

export function IconExternal({ size = 14, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

export function IconClock({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconUsers({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
      <path d="M17.5 14.3a6.5 6.5 0 0 1 4 5.7" />
    </svg>
  );
}

export function IconEye({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function IconSparkles({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
    </svg>
  );
}

export function IconCode({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export function IconRefresh({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size, className, style)}>
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

