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

async function checkPassword(password, storedHash, env) {
  if (!storedHash || !env.SESSION_SECRET) return false;
  const h = await hmac('pw:' + password, env.SESSION_SECRET);
  return safeEqual(h, storedHash);
}

async function makeToken(data, env) {
  const payload = btoa(JSON.stringify(data));
  const sig = await hmac(payload, env.SESSION_SECRET);
  return payload + '.' + sig;
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const sellerId = String(body.seller_id || '');
  const password = String(body.password || '');

  if (!sellerId || !password) {
    return Response.json({ error: 'Missing seller_id or password' }, { status: 400 });
  }

  const row = await env.DB.prepare(
    "SELECT id, password_hash, status FROM sellers WHERE id = ?"
  ).bind(sellerId).first();

  if (!row || row.status !== 'approved' || !(await checkPassword(password, row.password_hash, env))) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await makeToken(
    { role: 'seller', sid: row.id, exp: Date.now() + 12 * 60 * 60 * 1000 },
    env
  );
  return Response.json({ token, seller_id: row.id });
                                       }
