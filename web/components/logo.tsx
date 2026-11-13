import Link from "next/link";
export function Logo({ compact = false }: { compact?: boolean }) {
  return <Link className="logo" href="/" aria-label="REPLIO bosh sahifa">
    <span className="logo-mark" aria-hidden="true">R</span>
    {!compact && <span className="logo-wordmark">REPLIO</span>}
  </Link>;
}


