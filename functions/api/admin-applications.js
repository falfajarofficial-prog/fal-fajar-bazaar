import { requireAdmin } from '../lib/auth.js';

const enc = new TextEncoder();

async function hashPassword(password, env) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('pw:' + password));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await env.DB.prepare(
    "SELECT id, full_name, phone, email, city, business_type, message, status, created_at FROM seller_applications ORDER BY created_at DESC LIMIT 100"
  ).all();
  return Response.json(results);
}

// { "id": "a...", "action": "approve", "seller_id": "zaib", "password": "..." }
// { "id": "a...", "action": "reject" }
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const id = String(b.id || '');
  const action = String(b.action || '');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const app = await env.DB.prepare(
    "SELECT * FROM seller_applications WHERE id = ?"
  ).bind(id).first();
  if (!app) return Response.json({ error: 'Application not found' }, { status: 404 });
  if (app.status !== 'pending') {
    return Response.json({ error: 'Application is already ' + app.status }, { status: 409 });
  }

  if (action === 'reject') {
    await env.DB.prepare("UPDATE seller_applications SET status = 'rejected' WHERE id = ?")
      .bind(id).run();
    return Response.json({ ok: true, status: 'rejected' });
  }

  if (action !== 'approve') return Response.json({ error: 'Invalid action' }, { status: 400 });

  const sellerId = String(b.seller_id || '');
  const password = String(b.password || '');
  if (!/^[a-z0-9-]{3,30}$/.test(sellerId)) {
    return Response.json({ error: 'Seller ID: 3-30 lowercase letters, digits or dashes' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const exists = await env.DB.prepare("SELECT id FROM sellers WHERE id = ?").bind(sellerId).first();
  if (exists) return Response.json({ error: 'Seller ID already exists' }, { status: 409 });

  const hash = await hashPassword(password, env);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO sellers (id, name, phone, email, city, province, status, password_hash) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)"
    ).bind(sellerId, app.full_name, app.phone, app.email || '', app.city, app.city, hash),
    env.DB.prepare("UPDATE seller_applications SET status = 'approved' WHERE id = ?").bind(id)
  ]);

  return Response.json({ ok: true, status: 'approved', seller_id: sellerId });
}
