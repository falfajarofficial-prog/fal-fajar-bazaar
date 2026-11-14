import { requireAdmin } from '../lib/auth.js';

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results: orders } = await env.DB.prepare(
    "SELECT id, customer_name, phone, city, address, total_afn, status, created_at FROM orders ORDER BY created_at DESC LIMIT 100"
  ).all();

  const { results: items } = await env.DB.prepare(
    "SELECT order_id, title, price_afn, qty, seller_id FROM order_items WHERE order_id IN (SELECT id FROM orders ORDER BY created_at DESC LIMIT 100)"
  ).all();

  const byOrder = {};
  items.forEach(i => { (byOrder[i.order_id] = byOrder[i.order_id] || []).push(i); });
  return Response.json(orders.map(o => ({ ...o, items: byOrder[o.id] || [] })));
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const status = String(body.status || '');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  if (!STATUSES.includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });

  const result = await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(status, id).run();
  if (!result.meta || result.meta.changes === 0) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }
  return Response.json({ ok: true, id, status });
}
