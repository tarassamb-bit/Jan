import test from "node:test";
import assert from "node:assert/strict";
import { connectedAppProgress } from "../src/features/chat/plugin-progress.js";

test("the app ring is half full for five connections out of ten apps", () => {
  const plugins = Array.from({ length: 10 }, (_, index) => ({ id: `app-${index}`, available: true }));
  const connections = plugins.slice(0, 5).map(({ id }) => ({ slug: id }));
  assert.deepEqual(connectedAppProgress(plugins, connections), { count: 5, total: 10, percent: 50 });
});

test("the app ring deduplicates aliases and excludes unavailable apps", () => {
  const plugins = [{ id: "googledrive", available: true }, { id: "gmail", available: true }, { id: "higgsfield", available: false }];
  assert.deepEqual(connectedAppProgress(plugins, [{ slug: "google_drive" }]), { count: 1, total: 2, percent: 50 });
  assert.deepEqual(connectedAppProgress(plugins, [{ slug: "google_drive" }, { slug: "googledrive" }]), { count: 1, total: 2, percent: 50 });
  assert.deepEqual(connectedAppProgress(plugins, [{ slug: "googledocs" }]), { count: 1, total: 3, percent: 33 });
});
