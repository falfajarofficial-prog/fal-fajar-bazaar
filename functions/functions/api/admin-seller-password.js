import { requireAdmin } from '../lib/auth.js';
import { hashPassword } from '../lib/seller-auth.js';

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sellerId = String(body.seller_id || '');
  const password = String(body.password || '');

  if (!sellerId) return Response.json({ error: 'Missing seller_id' }, { status: 400 });
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const hash = await hashPassword(password, env);
  const result = await env.DB.prepare(
    "UPDATE sellers SET password_hash = ? WHERE id = ?"
  ).bind(hash, sellerId).run();

  if (!result.meta || result.meta.changes === 0) {
    return Response.json({ error: 'Seller not found' }, { status: 404 });
  }
  return Response.json({ ok: true, seller_id: sellerId });
    }
