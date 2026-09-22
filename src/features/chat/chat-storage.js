export const DEMO_ACCOUNT = { name: "Alex", email: "demo@jan.local", password: "jan-demo-2026" };
export const DEMO_USER_KEY = "jan-demo-user";
export const DEMO_CONVERSATIONS_KEY = "jan-demo-conversations";
export const PROJECTS_STORAGE_KEY = "jan-projects";
export const FREE_DAILY_MESSAGE_LIMIT = 100;
export const FREE_DAILY_UPLOAD_LIMIT = 3;
export const DEFAULT_SETTINGS = { appearance: "system", language: "auto", response_streaming: true, developer_mode: false, custom_instructions: "" };

export function readDemoUser() {
  try { return JSON.parse(window.localStorage.getItem(DEMO_USER_KEY) || "null"); } catch { return null; }
}

export function readDemoConversations() {
  try { return JSON.parse(window.localStorage.getItem(DEMO_CONVERSATIONS_KEY) || "[]"); } catch { return []; }
}

export function writeDemoConversations(conversations) {
  window.localStorage.setItem(DEMO_CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function readProjects(userId) {
  try { return JSON.parse(window.localStorage.getItem(`${PROJECTS_STORAGE_KEY}-${userId || "guest"}`) || "[]"); } catch { return []; }
}

export function writeProjects(userId, projects) {
  window.localStorage.setItem(`${PROJECTS_STORAGE_KEY}-${userId || "guest"}`, JSON.stringify(projects));
}

export function usageStorageKey(userId) { return `jan-usage-${userId || "guest"}-${new Date().toISOString().slice(0, 10)}`; }
export function readDailyUsage(userId) { try { return JSON.parse(window.localStorage.getItem(usageStorageKey(userId)) || '{"messages":0,"uploads":0}'); } catch { return { messages: 0, uploads: 0 }; } }
export function writeDailyUsage(userId, usage) { window.localStorage.setItem(usageStorageKey(userId), JSON.stringify(usage)); }
export function settingsStorageKey(userId) { return `jan-settings-${userId || "guest"}`; }
export function readSettings(userId) { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(window.localStorage.getItem(settingsStorageKey(userId)) || "{}"), language: "auto" }; } catch { return DEFAULT_SETTINGS; } }
export function writeSettings(userId, settings) { window.localStorage.setItem(settingsStorageKey(userId), JSON.stringify(settings)); }
export function memoriesStorageKey(userId) { return `jan-memories-${userId || "guest"}`; }
export function readMemories(userId) { try { return JSON.parse(window.localStorage.getItem(memoriesStorageKey(userId)) || "[]"); } catch { return []; } }
export function writeMemories(userId, memories) { window.localStorage.setItem(memoriesStorageKey(userId), JSON.stringify(memories)); }

export function demoMessagesKey(conversationId) {
  return `jan-demo-messages-${conversationId}`;
}

export function readDemoMessages(conversationId) {
  try { return JSON.parse(window.localStorage.getItem(demoMessagesKey(conversationId)) || "[]"); } catch { return []; }
}

export function makeConversationTitle(answer, fallback = "New conversation") {
  const raw = String(answer || "");
  const markdownHeading = raw.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim();
  if (markdownHeading) return markdownHeading.length > 52 ? `${markdownHeading.slice(0, 51).trimEnd()}…` : markdownHeading;
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  const firstSentence = cleaned.split(/(?<=[.!?])\s/)[0] || cleaned;
  const withoutFiller = firstSentence.replace(/^(sure|certainly|of course|here(?:'s| is))[:,!]?\s*/i, "").trim();
  const title = withoutFiller || cleaned;
  return title.length > 52 ? `${title.slice(0, 51).trimEnd()}…` : title;
}
