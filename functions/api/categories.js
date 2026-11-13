export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, name_en, name_fa, name_ps, image_url, sort_order FROM categories WHERE is_active = 1 ORDER BY sort_order"
  ).all();
  return Response.json(results);
}
