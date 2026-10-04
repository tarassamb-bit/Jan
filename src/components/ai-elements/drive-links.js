export function isDriveFileLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "drive.google.com") {
      if (url.pathname === "/open") return /^[A-Za-z0-9_-]{10,}$/.test(url.searchParams.get("id") || "");
      return /^\/file\/d\/[A-Za-z0-9_-]{10,}(?:\/|$)/.test(url.pathname);
    }
    return url.hostname === "docs.google.com" && /^\/document\/d\/[A-Za-z0-9_-]{10,}(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
}

function transformDriveLinks(node) {
  if (node.type === "link" && isDriveFileLink(node.url)) {
    node.data = { ...node.data, hName: "drive-link", hProperties: { href: node.url } };
    return;
  }
  if (node.children) node.children.forEach(transformDriveLinks);
}

export function remarkDriveLinks() {
  return transformDriveLinks;
}
