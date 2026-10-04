import { authenticateRequest } from "../server/access.js";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export async function handlePromos(req, res, { env = process.env, authenticate = authenticateRequest } = {}) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed." });
  }
  let account;
  try { account = await authenticate(req, env); }
  catch (error) { return json(res, error.status || 503, { error: error.message || "Sign in to apply a promo code." }); }
  if (String(req.body?.code || "").trim().toUpperCase() !== "FREE") return json(res, 400, { error: "That promo code isn’t valid." });
  const { error } = await account.db.from("user_promos").upsert({ user_id: account.user.id, code: "FREE" }, { onConflict: "user_id" });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return json(res, 503, { error: "Promo codes aren’t set up on the server yet. Apply the latest Supabase migration and try again." });
    console.error(JSON.stringify({ level: "error", route: "/api/promos", code: error.code || "UNKNOWN" }));
    return json(res, 503, { error: "Couldn’t save the promo code. Please try again." });
  }
  return json(res, 200, { code: "FREE" });
}
