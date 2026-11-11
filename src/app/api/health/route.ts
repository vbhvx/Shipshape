import { connection } from 'next/server';

/**
 * Liveness probe: answers whether this process can serve HTTP at all.
 * Deliberately touches no dependencies so a database outage does not cause
 * orchestrators to restart healthy instances. Use `/api/ready` for readiness.
 */
export async function GET() {
  await connection();

  return Response.json(
    {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? 'dev',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
