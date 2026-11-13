const enc = new TextEncoder();

async function sign(data, secret) {
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

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');

  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !safeEqual(password, env.ADMIN_PASSWORD)) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  const payload = btoa(JSON.stringify({ role: 'admin', exp: Date.now() + 12 * 60 * 60 * 1000 }));
  const sig = await sign(payload, env.SESSION_SECRET);
  return Response.json({ token: payload + '.' + sig });
                                  }
