const DELIVERY_FEE = 150;

const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

async function notifyOrder(env, order) {
  if (!env.RESEND_KEY || !env.ORDER_EMAIL) return;
  const lines = order.items.map(i => `${i.title} × ${i.qty} (${i.price_afn} AFN)`).join('\n');
  const text = [
    `New order: ${order.id}`,
    `Total: ${order.total_afn} AFN (includes ${DELIVERY_FEE} AFN delivery)`,
    '',
    `Customer: ${order.name}`,
    `Phone: ${order.phone}`,
    `City: ${order.city}`,
    `Address: ${order.address}`,
    '',
    'Items:',
    lines
  ].join('\n');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Fal-Fajar Bazar <onboarding@resend.dev>',
        to: [env.ORDER_EMAIL],
        subject: 'New order ' + order.id,
        text
      })
    });
  } catch (e) {
    // ای میل ناکام ہو تو آرڈر پھر بھی محفوظ رہتا ہے
  }
}

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

  // کیٹیگری کے کمیشن کی شرحیں (settings سے)
  const sr = await env.DB.prepare("SELECT key, value FROM settings WHERE key LIKE 'commission%'").all();
  const rates = {};
  sr.results.forEach(r => { rates[r.key] = Number(r.value); });
  const defaultRate = Number.isFinite(rates['commission_rate']) ? rates['commission_rate'] : 7;
  const rateFor = cat => (Number.isFinite(rates['commission_' + cat]) ? rates['commission_' + cat] : defaultRate);

  const lines = [];
  for (const it of b.items) {
    const id = String(it.id || '');
    const qty = Number(it.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) return fail('Invalid item');

    const p = await env.DB.prepare(
      "SELECT id, title, price_afn, stock, seller_id, category_id, status FROM products WHERE id = ?"
    ).bind(id).first();
    if (!p || p.status !== 'approved') return fail('Product not available: ' + id);
    if (p.stock < qty) return fail('Not enough stock for ' + p.title, 409);
    lines.push({ p, qty, rate: rateFor(p.category_id) });
  }
  if (new Set(lines.map(l => l.p.id)).size !== lines.length) {
    return fail('Same product listed twice');
  }

  const subtotal = lines.reduce((s, l) => s + l.p.price_afn * l.qty, 0);
  const total = subtotal + DELIVERY_FEE;
  const orderId = 'FFB-' + Date.now().toString(36).toUpperCase() + '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase();

  const stmts = [
    env.DB.prepare(
      "INSERT INTO orders (id, customer_name, phone, city, address, total_afn, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
    ).bind(orderId, name, phone, city, address, total)
  ];
  for (const { p, qty, rate } of lines) {
    const commission = Math.round(p.price_afn * qty * rate / 100);
    stmts.push(env.DB.prepare(
      "INSERT INTO order_items (order_id, product_id, seller_id, title, price_afn, qty, commission_afn) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(orderId, p.id, p.seller_id, p.title, p.price_afn, qty, commission));
    stmts.push(env.DB.prepare(
      "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
    ).bind(qty, p.id, qty));
  }

  await env.DB.batch(stmts);

  await notifyOrder(env, {
    id: orderId, name, phone, city, address, total_afn: total,
    items: lines.map(l => ({ title: l.p.title, qty: l.qty, price_afn: l.p.price_afn }))
  });

  return Response.json({ ok: true, order_id: orderId, total_afn: total }, { status: 201 });
}
