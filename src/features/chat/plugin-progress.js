function canonicalSlug(slug) {
  const normalized = String(slug || "").toLowerCase();
  if (normalized === "google_drive" || normalized === "drive") return "googledrive";
  if (normalized === "outlook_email") return "outlook";
  return normalized;
}

export function connectedAppProgress(plugins, connections) {
  const available = new Set(plugins.filter((plugin) => plugin.available).map((plugin) => canonicalSlug(plugin.id)).filter(Boolean));
  const connected = new Set(connections.map((app) => canonicalSlug(app.slug)).filter(Boolean));
  for (const slug of connected) available.add(slug);
  const total = available.size;
  const count = connected.size;
  return { count, total, percent: total ? Math.round((count / total) * 100) : 0 };
}
