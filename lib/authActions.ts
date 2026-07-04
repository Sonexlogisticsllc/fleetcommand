'use server';

import { cookies } from 'next/headers';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { lucia } from './lucia';
import type { SonexUser, SonexRole } from './sonexTypes';

export async function loginAction(email: string, password: string): Promise<{ success: boolean; user?: SonexUser; error?: string }> {
  try {
    const formattedEmail = email.trim().toLowerCase();
    
    // 1. Fetch user from DB
    const results = await db.select().from(users).where(eq(users.email, formattedEmail)).limit(1);
    if (results.length === 0) {
      return { success: false, error: 'Invalid email or password.' };
    }
    
    const user = results[0];
    
    // 2. Verify password with Argon2
    const validPassword = await verify(user.passwordHash, password);
    if (!validPassword) {
      return { success: false, error: 'Invalid email or password.' };
    }
    
    // 3. Create Lucia session
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    
    const cookieStore = await cookies();
    cookieStore.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );
    
    const sonexUser: SonexUser = {
      id: user.id,
      email: user.email,
      role: user.role as SonexRole,
      displayName: user.displayName,
      carrierId: user.carrierId || undefined,
      avatar: user.avatar || 'NU',
    };
    
    return { success: true, user: sonexUser };
  } catch (err) {
    console.error('Error logging in user:', err);
    return { success: false, error: 'An unexpected authentication error occurred.' };
  }
}

export async function logoutAction(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(lucia.sessionCookieName)?.value;
    
    if (sessionId) {
      // Invalidate the session on the server
      await lucia.invalidateSession(sessionId);
    }
    
    // Generate blank cookie to clear client side session
    const sessionCookie = lucia.createBlankSessionCookie();
    cookieStore.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );
    
    return { success: true };
  } catch (err) {
    console.error('Error logging out:', err);
    return { success: false };
  }
}

export async function getCurrentUserAction(): Promise<SonexUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(lucia.sessionCookieName)?.value;
    if (!sessionId) {
      return null;
    }
    
    const { session, user } = await lucia.validateSession(sessionId);
    
    if (session && session.fresh) {
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookieStore.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      );
    }
    
    if (!session || !user) {
      const sessionCookie = lucia.createBlankSessionCookie();
      cookieStore.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      );
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      role: user.role as SonexRole,
      displayName: user.displayName,
      carrierId: user.carrierId || undefined,
      avatar: user.avatar || 'NU',
    };
  } catch (err) {
    console.error('Error checking current session:', err);
    return null;
  }
}
