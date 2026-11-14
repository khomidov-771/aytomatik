import Link from "next/link";
export function Logo({ compact = false }: { compact?: boolean }) {
  return <Link className="logo" href="/" aria-label="REPLEO bosh sahifa">
    <span className="logo-mark" aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false"><path d="m7 27 10.1-13.2a8.1 8.1 0 0 1 12.4 10.3l-2 2.5M33 13 22.9 26.2a8.1 8.1 0 0 1-12.4-10.3l2-2.5"/><circle cx="7" cy="27" r="2.2"/><circle cx="33" cy="13" r="2.2"/></svg></span>
    {!compact && <span className="logo-wordmark">REPLEO</span>}
  </Link>;
}

