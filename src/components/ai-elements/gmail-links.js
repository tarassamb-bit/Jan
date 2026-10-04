const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const exactEmailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const gmailComposeBase = "https://mail.google.com/mail/?view=cm&fs=1&to=";

export function gmailComposeUrl(address) {
  return `${gmailComposeBase}${encodeURIComponent(address)}`;
}

export function isGmailComposeLink(url) {
  if (!url.startsWith(gmailComposeBase)) return false;
  try {
    return exactEmailPattern.test(decodeURIComponent(url.slice(gmailComposeBase.length)));
  } catch {
    return false;
  }
}

function emailLink(address) {
  return {
    type: "link",
    url: gmailComposeUrl(address),
    children: [{ type: "text", value: address }],
  };
}

function splitEmails(value) {
  const result = [];
  let start = 0;
  for (const match of value.matchAll(emailPattern)) {
    const index = match.index;
    const address = match[0];
    if ((index > 0 && /[A-Z0-9_@]/i.test(value[index - 1])) ||
        (index + address.length < value.length && /[A-Z0-9_@]/i.test(value[index + address.length]))) continue;
    if (index > start) result.push({ type: "text", value: value.slice(start, index) });
    result.push(emailLink(address));
    start = index + address.length;
  }
  if (start < value.length) result.push({ type: "text", value: value.slice(start) });
  return result.length ? result : [{ type: "text", value }];
}

function transformChildren(children) {
  return children.flatMap((node) => {
    if (node.type === "link") {
      if (node.url?.startsWith("mailto:")) {
        try {
          const address = decodeURIComponent(node.url.slice(7).split("?")[0]);
          if (exactEmailPattern.test(address)) node.url = gmailComposeUrl(address);
        } catch { /* Keep malformed mailto links unchanged. */ }
      }
      return [node];
    }
    if (node.type === "inlineCode" && exactEmailPattern.test(node.value)) {
      return [emailLink(node.value)];
    }
    if (node.type === "text") return splitEmails(node.value);
    if (node.children) node.children = transformChildren(node.children);
    return [node];
  });
}

export function remarkGmailLinks() {
  return (tree) => {
    if (tree.children) tree.children = transformChildren(tree.children);
  };
}
