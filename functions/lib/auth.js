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

// Returns the token data if valid and admin, otherwise null.
export async function requireAdmin(request, env) {
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
