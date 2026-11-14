import { requireAdmin } from '../lib/auth.js';

const STATUSES = ['pending', 'approved', 'rejected', 'hidden', 'removed'];

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await env.DB.prepare(
    "SELECT p.id, p.title, p.price_afn, p.stock, p.status, p.category_id, s.name AS seller_name FROM products p JOIN sellers s ON s.id = p.seller_id ORDER BY p.created_at DESC"
  ).all();
  return Response.json(results);
}

// { "id": "p4", "status": "approved" } یا { "id": "p4", "stock": 5 } یا دونوں
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const hasStatus = body.status !== undefined;
  const hasStock = body.stock !== undefined;
  if (!hasStatus && !hasStock) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 });
  }

  let status = null;
  if (hasStatus) {
    status = String(body.status);
    if (!STATUSES.includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }
  }

  let stock = null;
  if (hasStock) {
    stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return Response.json({ error: 'Stock must be a whole number, 0 or more' }, { status: 400 });
    }
  }

  const result = await env.DB.prepare(
    "UPDATE products SET status = COALESCE(?, status), stock = COALESCE(?, stock), updated_at = datetime('now') WHERE id = ?"
  ).bind(status, stock, id).run();

  if (!result.meta || result.meta.changes === 0) {
    return Response.json({ error: 'Product not found' }, { status: 404 });
  }
  return Response.json({ ok: true, id });
}
