import { db } from '@/lib/db';
import type { User } from '@/types';

/**
 * The local JSON store's demo user. Tests run without DATABASE_URL, so the JSON
 * adapter is active; the Postgres adapter deliberately has no such user.
 */
export async function getDefaultTestUser(): Promise<User> {
  if (!db.getDefaultUser) {
    throw new Error('getDefaultTestUser needs the local JSON store; unset DATABASE_URL for unit tests');
  }
  return db.getDefaultUser();
}
