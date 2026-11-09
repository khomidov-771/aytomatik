"use client";

import { createContext, useContext } from "react";
import type { Session, User } from "@/lib/types";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside AppShell");
  return session;
}

export function roleAtLeast(role: User["role"], minimum: User["role"]) {
  const rank: Record<User["role"], number> = { customer: 1, operator: 2, manager: 3, owner: 4 };
  return rank[role] >= rank[minimum];
}
