import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultRemarkPlugins, Streamdown } from "streamdown";
import { isDriveFileLink, remarkDriveLinks } from "../src/components/ai-elements/drive-links.js";

const driveUrl = "https://drive.google.com/open?id=1aB61KNIuw91zHvjfgkuIzax7iual2uGpfRU_jPuDmg4";

test("only real Google Drive file URLs get the inline link treatment", () => {
  assert.equal(isDriveFileLink(driveUrl), true);
  assert.equal(isDriveFileLink("https://docs.google.com/document/d/1aB61KNIuw91zHvjfgkuIzax7iual2uGpfRU_jPuDmg4/edit"), true);
  assert.equal(isDriveFileLink("https://drive.google.com.evil.example/open?id=1aB61KNIuw91zHvjfgkuIzax7iual2uGpfRU_jPuDmg4"), false);
  assert.equal(isDriveFileLink("https://drive.google.com/open?id=bad"), false);
  assert.equal(isDriveFileLink("javascript:alert(1)"), false);
});

test("Drive links render inline while ordinary links retain the safety button", () => {
  const html = renderToStaticMarkup(React.createElement(Streamdown, {
    mode: "static",
    remarkPlugins: [...Object.values(defaultRemarkPlugins), remarkDriveLinks],
    allowedTags: { "drive-link": ["href"] },
    components: { "drive-link": ({ href, children }) => React.createElement("a", { href, className: "jan-drive-link" }, children) },
    linkSafety: { enabled: true },
  }, `Created [Essay: Leonardo da Vinci](${driveUrl}) in your Google Drive. See [another site](https://example.com).`));
  assert.match(html, /<a href="https:\/\/drive\.google\.com\/open\?id=/);
  assert.match(html, /class="jan-drive-link">Essay: Leonardo da Vinci<\/a>/);
  assert.match(html, /data-streamdown="link" type="button">another site<\/button>/);
});
