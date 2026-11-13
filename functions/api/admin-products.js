import { requireAdmin } from '../lib/auth.js';

const STATUSES = ['pending', 'approved', 'rejected', 'hidden', 'removed'];

// ایڈمن کے لیے: تمام مصنوعات، ہر حالت کے ساتھ
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await env.DB.prepare(
    "SELECT p.id, p.title, p.price_afn, p.status, p.category_id, s.name AS seller_name FROM products p JOIN sellers s ON s.id = p.seller_id ORDER BY p.created_at DESC"
  ).all();
  return Response.json(results);
}

// مصنوعات کی حالت بدلنا: { "id": "p4", "status": "approved" }
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const status = String(body.status || '');

  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  if (!STATUSES.includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  const result = await env.DB.prepare(
    "UPDATE products SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, id).run();

  if (!result.meta || result.meta.changes === 0) {
    return Response.json({ error: 'Product not found' }, { status: 404 });
  }
  return Response.json({ ok: true, id, status });
    }
