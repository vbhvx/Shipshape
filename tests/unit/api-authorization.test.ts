import { describe, it, expect, beforeEach } from 'vitest';
import { getOwnedProject } from '@/lib/auth/session';
import { db } from '@/lib/db';

describe('API Authorization & Multi-tenant Isolation', () => {
  beforeEach(async () => {
    // Ensure default user exists
    await db.getDefaultUser();
  });

  describe('getOwnedProject isolation check', () => {
    it('returns null if the project does not exist', async () => {
      const result = await getOwnedProject('non_existent_project_id', 'usr_user_a');
      expect(result).toBeNull();
    });

    it('returns the project if the owner matches', async () => {
      const project = await db.createProject({
        id: `proj_test_owner_${Date.now()}`,
        ownerUserId: 'usr_user_a',
        name: 'User A Project',
        description: 'Private project for User A',
        status: 'draft',
      });

      const result = await getOwnedProject(project.id, 'usr_user_a');
      expect(result).not.toBeNull();
      expect(result?.id).toBe(project.id);
      expect(result?.ownerUserId).toBe('usr_user_a');
    });

    it('returns null if another user tries to access the project (IDOR protection)', async () => {
      const project = await db.createProject({
        id: `proj_test_tenant_${Date.now()}`,
        ownerUserId: 'usr_user_a',
        name: 'Secret Project',
        description: 'Top secret',
        status: 'draft',
      });

      // User B attempts to access User A's project
      const result = await getOwnedProject(project.id, 'usr_user_b');
      expect(result).toBeNull();
    });
  });

  describe('Production database guard', () => {
    it('throws error when NODE_ENV is production and DATABASE_URL is unset', () => {
      const origEnv = process.env.NODE_ENV;
      const origDbUrl = process.env.DATABASE_URL;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        delete process.env.DATABASE_URL;

        // Accessing db in production without DATABASE_URL must throw
        expect(() => {
          // Trigger getActiveAdapter via Proxy
          void db.getUser('test');
        }).toThrow(/DATABASE_URL is required in production environment/);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origDbUrl) {
          process.env.DATABASE_URL = origDbUrl;
        }
      }
    });
  });

  describe('Clerk identity isolation', () => {
    it('creates a user with clerkId and does not alias to default builder', async () => {
      const testClerkId = `user_clerk_test_${Date.now()}`;
      const newUser = await db.createUser({
        clerkId: testClerkId,
        email: `tester_${Date.now()}@example.com`,
        name: 'Clerk User',
      });

      expect(newUser.clerkId).toBe(testClerkId);
      expect(newUser.id).not.toBe('usr_default_builder');

      const retrieved = await db.getUserByClerkId(testClerkId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(newUser.id);
      expect(retrieved?.id).not.toBe('usr_default_builder');

      const defaultUser = await db.getDefaultUser();
      expect(defaultUser.id).toBe('usr_default_builder');
      expect(defaultUser.id).not.toBe(newUser.id);
    });
  });
});
