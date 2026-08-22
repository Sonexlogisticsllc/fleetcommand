import { Lucia, TimeSpan } from 'lucia';
import { DrizzleSQLiteAdapter } from '@lucia-auth/adapter-drizzle';
import { db } from '../db/client';
import { users, sessions } from '../db/schema';

const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(30, 'd'), // explicitly enforce 30-day session lifetime
  sessionCookie: {
    expires: false,
    attributes: {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      role: attributes.role,
      displayName: attributes.displayName,
      carrierId: attributes.carrierId,
      mcOwnerId: attributes.mcOwnerId,
      avatar: attributes.avatar,
    };
  },
});

export type AuthenticatedSonexUser = {
  id: string;
  email: string;
  role: string;
  displayName: string;
  carrierId: string | null;
  mcOwnerId: string | null;
  avatar: string | null;
};

export async function validateSonexSession(sessionId: string) {
  const { session, user } = await lucia.validateSession(sessionId);
  return { session, user: user as AuthenticatedSonexUser | null };
}

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      role: string;
      displayName: string;
      carrierId: string | null;
      mcOwnerId: string | null;
      avatar: string | null;
    };
  }
}
