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

async function requireAdmin(request, env) {
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
  if (data.role !== 'admin' || !(data.exp > Date.now())) return null;
  return data;
}

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

  const hash = await hmac('pw:' + password, env.SESSION_SECRET);
  const result = await env.DB.prepare(
    "UPDATE sellers SET password_hash = ? WHERE id = ?"
  ).bind(hash, sellerId).run();

  if (!result.meta || result.meta.changes === 0) {
    return Response.json({ error: 'Seller not found' }, { status: 404 });
  }
  return Response.json({ ok: true, seller_id: sellerId });
       }
