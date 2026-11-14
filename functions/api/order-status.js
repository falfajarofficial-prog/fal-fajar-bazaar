const norm = s => String(s || '').replace(/\s+/g, '');

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  const phone = norm(url.searchParams.get('phone'));
  if (!id || !phone) {
    return Response.json({ error: 'Order number and phone are required' }, { status: 400 });
  }

  const o = await env.DB.prepare(
    "SELECT id, phone, total_afn, status, created_at FROM orders WHERE id = ?"
  ).bind(id).first();
  if (!o || norm(o.phone) !== phone) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }

  const { results: items } = await env.DB.prepare(
    "SELECT title, price_afn, qty FROM order_items WHERE order_id = ?"
  ).bind(id).all();

  return Response.json({
    id: o.id, status: o.status, total_afn: o.total_afn, created_at: o.created_at, items
  });
}
