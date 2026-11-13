export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT p.id, p.title, p.price_afn, p.stock, p.image_url, p.attributes, p.category_id, s.name AS seller_name, s.city AS seller_city FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.status = 'approved' ORDER BY p.created_at DESC"
  ).all();
  return Response.json(results);
}
