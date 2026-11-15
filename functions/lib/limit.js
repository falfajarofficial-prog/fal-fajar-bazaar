const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const ipOf = request => request.headers.get('CF-Connecting-IP') || 'unknown';

export async function isLocked(request, env) {
  const row = await env.DB.prepare(
    "SELECT locked_until FROM login_attempts WHERE ip = ?"
  ).bind(ipOf(request)).first();
  return !!(row && row.locked_until > Date.now());
}

export async function recordFail(request, env) {
  const ip = ipOf(request);
  await env.DB.prepare(
    "INSERT INTO login_attempts (ip, fails, locked_until) VALUES (?, 1, 0) ON CONFLICT(ip) DO UPDATE SET fails = fails + 1"
  ).bind(ip).run();
  await env.DB.prepare(
    "UPDATE login_attempts SET locked_until = ?, fails = 0 WHERE ip = ? AND fails >= ?"
  ).bind(Date.now() + LOCK_MS, ip, MAX_FAILS).run();
}

export async function clearFail(request, env) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ipOf(request)).run();
}

export const tooMany = () =>
  Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
