const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  if (!b || !Array.isArray(b.items) || b.items.length === 0 || b.items.length > 30) {
    return fail('Cart must have 1 to 30 items');
  }

  const name = String(b.name || '').trim().slice(0, 100);
  const phone = String(b.phone || '').trim().slice(0, 30);
  const city = String(b.city || '').trim().slice(0, 60);
  const address = String(b.address || '').trim().slice(0, 300);
  if (!name || !phone || !city || !address) {
    return fail('Name, phone, city and address are required');
  }

  const rateRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'commission_rate'").first();
  const rate = Number(rateRow ? rateRow.value : 0) || 0;

  const lines = [];
  for (const it of b.items) {
    const id = String(it.id || '');
    const qty = Number(it.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) return fail('Invalid item');

    const p = await env.DB.prepare(
      "SELECT id, title, price_afn, stock, seller_id, status FROM products WHERE id = ?"
    ).bind(id).first();
    if (!p || p.status !== 'approved') return fail('Product not available: ' + id);
    if (p.stock < qty) return fail('Not enough stock for ' + p.title, 409);
    lines.push({ p, qty });
  }
  if (new Set(lines.map(l => l.p.id)).size !== lines.length) {
    return fail('Same product listed twice');
  }

  const total = lines.reduce((s, l) => s + l.p.price_afn * l.qty, 0);
  const orderId = 'FFB-' + Date.now().toString(36).toUpperCase() + '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase();

  const stmts = [
    env.DB.prepare(
      "INSERT INTO orders (id, customer_name, phone, city, address, total_afn, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
    ).bind(orderId, name, phone, city, address, total)
  ];
  for (const { p, qty } of lines) {
    const commission = Math.round(p.price_afn * qty * rate / 100);
    stmts.push(env.DB.prepare(
      "INSERT INTO order_items (order_id, product_id, seller_id, title, price_afn, qty, commission_afn) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(orderId, p.id, p.seller_id, p.title, p.price_afn, qty, commission));
    stmts.push(env.DB.prepare(
      "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
    ).bind(qty, p.id, qty));
  }

  await env.DB.batch(stmts);
  return Response.json({ ok: true, order_id: orderId, total_afn: total }, { status: 201 });
}
