'use server';

import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../db/client';
import { users } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { lucia, validateSonexSession } from './lucia';
import type { SonexUser, SonexRole } from './sonexTypes';

const PORTAL_PREVIEW_COOKIE = 'sonex_admin_portal_return';
const PORTAL_PREVIEW_TTL_SECONDS = 60 * 60 * 4;

function getPortalPreviewSecret(): string | null {
  if (process.env.SONEX_PORTAL_SWITCH_SECRET) return process.env.SONEX_PORTAL_SWITCH_SECRET;
  return process.env.NODE_ENV === 'production' ? null : 'sonex-local-development-preview-secret';
}

function signPortalPreview(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function createPortalPreviewToken(adminId: string, secret: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + PORTAL_PREVIEW_TTL_SECONDS;
  const payload = `${adminId}.${expiresAt}`;
  return `${payload}.${signPortalPreview(payload, secret)}`;
}

function verifyPortalPreviewToken(token: string | undefined, secret: string | null): boolean {
  if (!token || !secret) return false;
  const [adminId, expiresAt, signature, ...extra] = token.split('.');
  if (!adminId || !expiresAt || !signature || extra.length || Number(expiresAt) < Math.floor(Date.now() / 1000)) return false;
  const expected = signPortalPreview(`${adminId}.${expiresAt}`, secret);
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

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
      mcOwnerId: user.mcOwnerId || undefined,
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

/**
 * Admin-authorized role switching. The signed, short-lived return token never exposes credentials.
 */
export async function startPortalPreviewAction(targetUserId: string): Promise<{ success: boolean; destination?: string; error?: string }> {
  const secret = getPortalPreviewSecret();
  if (!secret) return { success: false, error: 'Set SONEX_PORTAL_SWITCH_SECRET before enabling portal switching.' };
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(lucia.sessionCookieName)?.value;
    if (!sessionId) return { success: false, error: 'Sign in as an administrator first.' };

    const { user: currentUser } = await validateSonexSession(sessionId);
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Administrator access is required.' };
    }

    const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!target || !['mc_owner', 'carrier'].includes(target.role)) {
      return { success: false, error: 'Choose an MC owner or carrier portal account.' };
    }

    await lucia.invalidateSession(sessionId);
    const previewSession = await lucia.createSession(target.id, {});
    const sessionCookie = lucia.createSessionCookie(previewSession.id);
    cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    cookieStore.set(PORTAL_PREVIEW_COOKIE, createPortalPreviewToken(currentUser.id, secret), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: PORTAL_PREVIEW_TTL_SECONDS,
    });

    return { success: true, destination: target.role === 'carrier' ? '/carrier' : '/sonex' };
  } catch (err) {
    console.error('Error starting portal preview:', err);
    return { success: false, error: 'Could not open the portal.' };
  }
}

export async function startMcOwnerPortalPreviewAction(mcOwnerId: string): Promise<{ success: boolean; destination?: string; error?: string }> {
  const [target] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.mcOwnerId, mcOwnerId), eq(users.role, 'mc_owner')))
    .limit(1);
  if (!target) return { success: false, error: 'This MC owner does not have a portal account.' };
  return startPortalPreviewAction(target.id);
}

export async function returnFromPortalPreviewAction(): Promise<{ success: boolean; error?: string }> {
  const secret = getPortalPreviewSecret();
  if (!secret) return { success: false, error: 'Portal switching is not configured.' };
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PORTAL_PREVIEW_COOKIE)?.value;
    if (!verifyPortalPreviewToken(token, secret)) return { success: false, error: 'The portal switch has expired. Sign in as admin again.' };
    const adminId = token!.split('.')[0];

    const [admin] = await db.select().from(users).where(eq(users.id, adminId)).limit(1);
    if (!admin || admin.role !== 'admin') return { success: false, error: 'The original admin account is unavailable.' };

    const existingSessionId = cookieStore.get(lucia.sessionCookieName)?.value;
    if (existingSessionId) await lucia.invalidateSession(existingSessionId);
    const adminSession = await lucia.createSession(admin.id, {});
    const sessionCookie = lucia.createSessionCookie(adminSession.id);
    cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    cookieStore.set(PORTAL_PREVIEW_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    return { success: true };
  } catch (err) {
    console.error('Error returning from portal preview:', err);
    return { success: false, error: 'Could not return to the admin portal.' };
  }
}

export async function getCurrentUserAction(): Promise<SonexUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(lucia.sessionCookieName)?.value;
    if (!sessionId) {
      return null;
    }
    
    const { session, user } = await validateSonexSession(sessionId);
    
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
      mcOwnerId: user.mcOwnerId || undefined,
      avatar: user.avatar || 'NU',
      adminPreview: verifyPortalPreviewToken(cookieStore.get(PORTAL_PREVIEW_COOKIE)?.value, getPortalPreviewSecret()),
    };
  } catch (err) {
    console.error('Error checking current session:', err);
    return null;
  }
}
