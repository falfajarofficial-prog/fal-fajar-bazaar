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

// پاس ورڈ کو محفوظ شکل میں بدلنا (ڈیٹابیس میں یہی محفوظ ہوگا)
export async function hashPassword(password, env) {
  return hmac('pw:' + password, env.SESSION_SECRET);
}

export async function checkPassword(password, storedHash, env) {
  if (!storedHash || !env.SESSION_SECRET) return false;
  const h = await hashPassword(password, env);
  return safeEqual(h, storedHash);
}

// ٹوکن بنانا
export async function makeToken(data, env) {
  const payload = btoa(JSON.stringify(data));
  const sig = await hmac(payload, env.SESSION_SECRET);
  return payload + '.' + sig;
}

// سیلر کا ٹوکن جانچنا؛ درست ہو تو اس کا ڈیٹا، ورنہ null
export async function requireSeller(request, env) {
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
