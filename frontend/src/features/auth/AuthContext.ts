import { createContext, useContext } from 'react';

export type Role = 'ADMIN' | 'MEMBER';
export type SessionUser = { memberId: string; roles: Role[] };
export const AuthContext = createContext<{ user: SessionUser; signOut: () => Promise<void> } | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within RequireSession');
  return context;
}

export function sessionUser(value: unknown): SessionUser {
  const user = value as SessionUser | null;
  if (!user || typeof user.memberId !== 'string' || !Array.isArray(user.roles)
      || !user.roles.length || user.roles.some(role => role !== 'ADMIN' && role !== 'MEMBER')) {
    throw new Error('Unable to verify your account roles. Please sign in again.');
  }
  return user;
}
