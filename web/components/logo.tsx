import Link from "next/link";
export function Logo({ compact = false }: { compact?: boolean }) { return <Link className="logo" href="/" aria-label="IDS Automate bosh sahifa"><span className="logo-mark"><span /></span>{!compact && <span>IDS Automate</span>}</Link>; }

