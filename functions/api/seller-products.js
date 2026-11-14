const enc = new TextEncoder();

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function safeEqual(a, b) {
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function requireSeller(request, env) {
  if (!env.SESSION_SECRET) return null;
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(payload, env.SESSION_SECRET);
  if (!safeEqual(sig, expected)) return null;

  let data;
  try {
    data = JSON.parse(atob(payload));
  } catch (e) {
    return null;
  }
  if (data.role !== 'seller' || !data.sid || !(data.exp > Date.now())) return null;
  return data;
}

// سیلر کی اپنی مصنوعات
export async function onRequestGet({ request, env }) {
  const seller = await requireSeller(request, env);
  if (!seller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await env.DB.prepare(
    "SELECT id, title, category_id, price_afn, stock, status, condition, brand, model, weight, created_at FROM products WHERE seller_id = ? ORDER BY created_at DESC"
  ).bind(seller.sid).all();
  return Response.json(results);
}

// نئی مصنوعات (منظوری کے لیے pending)
export async function onRequestPost({ request, env }) {
  const seller = await requireSeller(request, env);
  if (!seller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const title = String(b.title || '').trim();
  const categoryId = String(b.category_id || '');
  const price = Number(b.price_afn);
  const stock = Number.isInteger(b.stock) ? b.stock : 0;
  const condition = b.condition === 'Used' ? 'Used' : 'New';

  if (!title) return Response.json({ error: 'Title is required' }, { status: 400 });
  if (!Number.isInteger(price) || price <= 0) {
    return Response.json({ error: 'Price must be a positive whole number' }, { status: 400 });
  }
  if (stock < 0) return Response.json({ error: 'Stock cannot be negative' }, { status: 400 });

  const cat = await env.DB.prepare("SELECT id FROM categories WHERE id = ? AND is_active = 1")
    .bind(categoryId).first();
  if (!cat) return Response.json({ error: 'Invalid category' }, { status: 400 });

  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await env.DB.prepare(
    "INSERT INTO products (id, seller_id, category_id, title, description, price_afn, stock, image_url, attributes, status, brand, model, weight, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)"
  ).bind(
    id, seller.sid, categoryId, title,
    String(b.description || ''), price, stock,
    String(b.image_url || ''), JSON.stringify({ rating: 0, reviews: 0 }),
    String(b.brand || ''), String(b.model || ''), String(b.weight || ''), condition
  ).run();

  return Response.json({ ok: true, id, status: 'pending' }, { status: 201 });
}
