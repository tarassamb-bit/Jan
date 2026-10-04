import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultRemarkPlugins, Streamdown } from "streamdown";
import {
  gmailComposeUrl,
  isGmailComposeLink,
  remarkGmailLinks,
} from "../src/components/ai-elements/gmail-links.js";

const address = "reply@accounts.google.com";
const composeUrl = gmailComposeUrl(address);

test("Gmail compose URL pre-fills only the recipient", () => {
  assert.equal(composeUrl, "https://mail.google.com/mail/?view=cm&fs=1&to=reply%40accounts.google.com");
  assert.equal(isGmailComposeLink(composeUrl), true);
  assert.equal(isGmailComposeLink("https://evil.example/mail/?view=cm&fs=1&to=reply%40accounts.google.com"), false);
});

test("plain, inline-code, and mailto email addresses become Gmail links", () => {
  const tree = {
    children: [{
      type: "paragraph",
      children: [
        { type: "text", value: `Contact ${address}. ` },
        { type: "inlineCode", value: address },
        { type: "link", url: `mailto:${address}`, children: [{ type: "text", value: address }] },
      ],
    }],
  };
  remarkGmailLinks()(tree);
  const links = tree.children[0].children.filter((node) => node.type === "link");
  assert.equal(links.length, 3);
  assert.ok(links.every((node) => node.url === composeUrl));
  assert.equal(tree.children[0].children[2].value, ". ");
});

test("code blocks and unrelated links are unchanged", () => {
  const tree = {
    children: [
      { type: "code", value: address },
      { type: "paragraph", children: [
        { type: "inlineCode", value: `email ${address}` },
        { type: "link", url: "https://example.com", children: [{ type: "text", value: address }] },
      ] },
    ],
  };
  remarkGmailLinks()(tree);
  assert.equal(tree.children[0].type, "code");
  assert.equal(tree.children[1].children[0].type, "inlineCode");
  assert.equal(tree.children[1].children[1].url, "https://example.com");
});

test("Streamdown renders an inline-code email as a normal link, not a code pill", () => {
  const html = renderToStaticMarkup(React.createElement(Streamdown, {
    mode: "static",
    remarkPlugins: [...Object.values(defaultRemarkPlugins), remarkGmailLinks],
    linkSafety: { enabled: true, onLinkCheck: isGmailComposeLink },
  }, `Email \`${address}\`.`));
  assert.match(html, /data-streamdown="link"[^>]*>reply@accounts\.google\.com<\/button>/);
  assert.doesNotMatch(html, /<code[^>]*>reply@accounts\.google\.com<\/code>/);
});
