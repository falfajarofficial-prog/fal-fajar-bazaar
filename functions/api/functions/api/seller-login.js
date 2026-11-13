import { checkPassword, makeToken } from '../lib/seller-auth.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const sellerId = String(body.seller_id || '');
  const password = String(body.password || '');

  if (!sellerId || !password) {
    return Response.json({ error: 'Missing seller_id or password' }, { status: 400 });
  }

  const row = await env.DB.prepare(
    "SELECT id, password_hash, status FROM sellers WHERE id = ?"
  ).bind(sellerId).first();

  if (!row || row.status !== 'approved' || !(await checkPassword(password, row.password_hash, env))) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await makeToken(
    { role: 'seller', sid: row.id, exp: Date.now() + 12 * 60 * 60 * 1000 },
    env
  );
  return Response.json({ token, seller_id: row.id });
    }
