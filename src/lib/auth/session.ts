import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { notFound } from '@/lib/http/errors';
import type { User } from '@/types';

export class AuthSessionError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'AuthSessionError';
  }
}

/**
 * Resolves the authenticated Clerk identity to a Shipshape user.
 *
 * Never falls back to the legacy demo user.
 * Never links an existing account by email alone.
 */
export async function requireAuth(): Promise<User> {
  const { userId } = await auth();

  if (!userId) {
    throw new AuthSessionError('Authentication required', 401);
  }

  // Existing Shipshape account for this Clerk identity.
  const existingUser = await db.getUserByClerkId(userId);

  if (existingUser) {
    return existingUser;
  }

  // First sign-in: provision a Shipshape user from Clerk.
  const clerkUser = await currentUser();

  if (!clerkUser || clerkUser.id !== userId) {
    throw new AuthSessionError(
      'Unable to verify the authenticated account',
      401
    );
  }

  const primaryEmail = clerkUser.primaryEmailAddress;

  if (
    !primaryEmail ||
    primaryEmail.verification?.status !== 'verified'
  ) {
    throw new AuthSessionError(
      'A verified primary email address is required',
      403
    );
  }

  const name = [
    clerkUser.firstName,
    clerkUser.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  try {
    return await db.createUser({
      clerkId: userId,
      email: primaryEmail.emailAddress,
      name: name || primaryEmail.emailAddress,
      ...(clerkUser.imageUrl
        ? { avatarUrl: clerkUser.imageUrl }
        : {}),
    });
  } catch {
    // Another concurrent request may have provisioned this identity.
    const concurrentlyCreatedUser =
      await db.getUserByClerkId(userId);

    if (concurrentlyCreatedUser) {
      return concurrentlyCreatedUser;
    }

    // Do not silently link a pre-existing account by email.
    throw new AuthSessionError(
      'Unable to provision this account. Please contact support if the problem persists.',
      409
    );
  }
}

/**
 * Returns a project only when it belongs to the supplied user.
 * Returns null for both missing and unauthorized projects.
 */
export async function getOwnedProject(
  projectId: string,
  userId: string
) {
  const project = await db.getProject(projectId);

  if (!project || project.ownerUserId !== userId) {
    return null;
  }

  return project;
}

/**
 * Like `getOwnedProject`, but throws a 404 `ApiError` for route handlers.
 * Unauthorized and missing projects are indistinguishable to the caller, so
 * project IDs cannot be enumerated across tenants.
 */
export async function requireOwnedProject(projectId: string, userId: string) {
  const project = await getOwnedProject(projectId, userId);
  if (!project) {
    throw notFound('Project not found');
  }
  return project;
}

/** Resolves a generation run only when its project belongs to the user. */
export async function requireOwnedRun(runId: string, userId: string) {
  const run = await db.getGenerationRun(runId);
  if (!run || !(await getOwnedProject(run.projectId, userId))) {
    throw notFound('Generation run not found');
  }
  return run;
}

/** Resolves a version only when it belongs to the given (already authorized) project. */
export async function requireProjectVersion(projectId: string, versionId: string, label = 'Version') {
  const version = await db.getVersion(versionId);
  if (!version || version.projectId !== projectId) {
    throw notFound(`${label} not found`);
  }
  return version;
}
