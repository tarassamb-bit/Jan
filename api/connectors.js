import { Composio } from "@composio/core";
import { authenticateRequest } from "../server/access.js";

const descriptions = {
  gmail: "Search your mailbox and read messages you choose. You approve Google access in its secure sign-in window.",
  github: "Find repositories, issues, pull requests, and build checks from your GitHub account.",
  vercel: "Inspect your Vercel projects and deployments. Vercel will show the access requested before you approve.",
  googledrive: "Find and read files in Google Drive that you choose to share with Jan.",
  slack: "Search conversations and read messages from the Slack workspaces you authorize.",
  notion: "Search and read pages in the Notion workspaces you authorize.",
  outlook: "Search and read mail from your Microsoft Outlook account.",
  higgsfield: "Higgsfield is not currently available in the connected app catalog.",
};

let composioClient;
let catalogSnapshot = null;
let catalogSnapshotAt = 0;
const CATALOG_CACHE_MS = 5 * 60 * 1000;
function getComposio(env) {
  if (!env.COMPOSIO_API_KEY) throw Object.assign(new Error("Composio is not configured on this server."), { status: 503 });
  if (!composioClient) composioClient = new Composio({ apiKey: env.COMPOSIO_API_KEY });
  return composioClient;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function requestUrl(req) {
  return new URL(req.originalUrl || req.url || "/api/connectors", `http://${req.headers.host || "localhost"}`);
}

function callbackUrl(req, userId, toolkit, env) {
  let origin = env.JAN_APP_URL ? new URL(env.JAN_APP_URL).origin : env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null;
  if (!origin) {
    const requestOrigin = req.headers.origin;
    if (requestOrigin) {
      const parsed = new URL(requestOrigin);
      if (["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) origin = parsed.origin;
    }
  }
  if (!origin) return undefined;
  return `${origin}/plugin/${encodeURIComponent(userId)}/${encodeURIComponent(toolkit)}?connected=1`;
}

export async function handleConnectors(req, res, { env = process.env, authenticate = authenticateRequest, clientProvider = getComposio } = {}) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed." });
  }

  let account;
  try { account = await authenticate(req, env); }
  catch (error) { return json(res, error.status || 503, { code: error.code, error: error.message }); }

  const url = requestUrl(req);
  const requestedUserId = req.method === "POST" ? req.body?.userId : url.searchParams.get("userId");
  if (!requestedUserId || requestedUserId !== account.user.id) return json(res, 403, { error: "This connector belongs to a different account." });

  try {
    const composio = clientProvider(env);
    const action = req.method === "POST" ? req.body?.action : url.searchParams.get("action") || "catalog";

    if (action === "catalog") {
      const cursor = url.searchParams.get("cursor");
      const refresh = url.searchParams.get("refresh") === "1";
      if (!cursor && !refresh && catalogSnapshot && Date.now() - catalogSnapshotAt < CATALOG_CACHE_MS) return json(res, 200, catalogSnapshot);
      const result = await composio.toolkits.client.toolkits.list({ limit: 32, ...(cursor ? { cursor } : {}) });
      const seenToolkitSlugs = new Set();
      const uniqueToolkits = (result.items || []).filter((item) => {
        const slug = String(item.slug).toLowerCase();
        if (seenToolkitSlugs.has(slug)) return false;
        seenToolkitSlugs.add(slug);
        return true;
      });
      const payload = { items: uniqueToolkits.map((item) => {
        const slug = String(item.slug).toLowerCase();
        return { slug, name: item.name, description: item.meta?.description || descriptions[slug] || `Connect ${item.name} to let Jan use its available tools.`, logo: item.meta?.logo || null, available: true };
      }), nextCursor: result.next_cursor || null };
      if (!cursor) { catalogSnapshot = payload; catalogSnapshotAt = Date.now(); }
      return json(res, 200, payload);
    }

    if (action === "connected") {
      const result = await composio.connectedAccounts.list({ userIds: [account.user.id], statuses: ["ACTIVE"], limit: 100 });
      const activeAccounts = (result.items || []).filter((item) => item.status === "ACTIVE" && !item.isDisabled);
      const connectedSlugs = [...new Set(activeAccounts.map((item) => String(item.toolkit?.slug || "").toLowerCase()).filter(Boolean))];
      return json(res, 200, { items: connectedSlugs.map((slug) => {
        const name = ({ gmail: "Gmail", github: "GitHub", vercel: "Vercel", googledrive: "Google Drive", google_drive: "Google Drive", slack: "Slack", notion: "Notion", outlook: "Outlook", outlook_email: "Outlook Email" })[slug] || slug.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
        return { slug, name, description: descriptions[slug] || `Connected to ${name}.`, logo: null, available: true, connected: true };
      }) });
    }

    const toolkit = String(req.method === "POST" ? req.body?.toolkit : url.searchParams.get("toolkit") || "").toLowerCase();
    if (!/^[a-z0-9_-]{1,100}$/.test(toolkit)) return json(res, 400, { error: "Choose a valid app connector." });

    if (action === "status") {
      const [accounts, metadata] = await Promise.all([
        composio.connectedAccounts.list({ userIds: [account.user.id], toolkitSlugs: [toolkit], statuses: ["ACTIVE"], limit: 100 }),
        composio.toolkits.get(toolkit),
      ]);
      const connected = (accounts.items || []).some((item) => item.status === "ACTIVE" && !item.isDisabled && String(item.toolkit?.slug || "").toLowerCase() === toolkit);
      return json(res, 200, {
        connector: { slug: metadata.slug, name: metadata.name, description: metadata.meta?.description || descriptions[toolkit] || `Connect ${metadata.name} to let Jan use its available tools.`, logo: metadata.meta?.logo, available: true },
        connected,
      });
    }

    if (action === "connect" && req.method === "POST") {
      const [session, metadata] = await Promise.all([
        composio.create(account.user.id, { toolkits: [toolkit], manageConnections: false }),
        composio.toolkits.get(toolkit),
      ]);
      const link = await session.authorize(toolkit, { callbackUrl: callbackUrl(req, account.user.id, toolkit, env) });
      if (!link.redirectUrl) return json(res, 502, { error: `Composio did not return a sign-in link for ${metadata.name}.` });
      return json(res, 200, { redirectUrl: link.redirectUrl });
    }

    return json(res, 400, { error: "Unknown connector action." });
  } catch (error) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502;
    console.error(JSON.stringify({ level: "error", route: "/api/connectors", action: req.body?.action || url.searchParams.get("action"), status }));
    return json(res, status, { error: status === 404 ? "That app connector is not available." : "Composio could not complete this request. Check the server configuration and try again." });
  }
}

export default function handler(req, res) { return handleConnectors(req, res); }
