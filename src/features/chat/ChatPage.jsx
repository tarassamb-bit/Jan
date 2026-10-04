import { requestChat, buildChatMessages } from "./chat-transport.js";
import { connectedAppProgress } from "./plugin-progress.js";
import { useConversationMessages } from "./useConversationMessages.js";
import { serializeAttachments, restoreAttachments, loadProjectSources } from "./chat-file-storage.js";
import { PROJECT_FILE_LIMIT, PROJECT_FILE_MAX_BYTES, TEXT_FILE_TYPES, TEXT_FILE_EXTENSION, safeProjectFileName, compressProjectFile, MAX_ATTACHMENT_BYTES, MAX_IMAGE_BYTES, MAX_ATTACHMENT_CHARS, MAX_ATTACHMENTS, MAX_IMAGES_PER_MESSAGE, VISION_MODEL, clampAttachmentText, extractAttachment } from "./chat-file-storage.js";
import { DEMO_ACCOUNT, DEMO_USER_KEY, DEMO_CONVERSATIONS_KEY, PROJECTS_STORAGE_KEY, FREE_DAILY_MESSAGE_LIMIT, FREE_DAILY_UPLOAD_LIMIT, DEFAULT_SETTINGS, readDemoUser, readDemoConversations, writeDemoConversations, readProjects, writeProjects, usageStorageKey, readDailyUsage, writeDailyUsage, settingsStorageKey, readSettings, writeSettings, memoriesStorageKey, readMemories, writeMemories, demoMessagesKey, readDemoMessages, makeConversationTitle } from "./chat-storage.js";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase.js";
import SettingsModalV2 from "../../components/settings/settings-modal.jsx";
import {
  FaApple,
  FaDiscord,
  FaGithub,
  FaGoogleDrive,
  FaLinux,
  FaLinkedinIn,
  FaUsers,
  FaWindows,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiCanva, SiGmail } from "react-icons/si";
import { LuBot, LuBrainCircuit, LuChevronsUpDown, LuRocket } from "react-icons/lu";
import {
  FiArrowLeft,
  FiArrowRight,
  FiArrowUp,
  FiBarChart2,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiCpu,
  FiBox,
  FiFile,
  FiFileText,
  FiFolder,
  FiGrid,
  FiGlobe,
  FiGitBranch,
  FiHeart,
  FiHome,
  FiImage,
  FiBell,
  FiLogOut,
  FiMail,
  FiMenu,
  FiMessageCircle,
  FiMonitor,
  FiMoreHorizontal,
  FiPaperclip,
  FiPlus,
  FiSearch,
  FiSliders,
  FiStar,
  FiList,
  FiRefreshCw,
  FiSend,
  FiSettings,
  FiShield,
  FiEdit2,
  FiUpload,
  FiTrash2,
  FiUser,
  FiX,
  FiExternalLink,
} from "react-icons/fi";
const MessageResponse = lazy(() => import("../../components/ai-elements/MessageResponse").then((module) => ({ default: module.MessageResponse })));

const WEB_SOURCE_TYPE = "application/x-jan-web-source";
const messageWebSources = (message) => message.sources || (message.attachments || []).filter((item) => item.type === WEB_SOURCE_TYPE).map(({ title, url, excerpt }) => ({ title, url, excerpt }));
const messageFiles = (message) => (message.attachments || []).filter((item) => item.type !== WEB_SOURCE_TYPE);
const IMAGE_FILE_EXTENSION = /\.(avif|gif|heic|heif|jpe?g|png|svg|webp)$/i;
const isImageFile = (file) => Boolean(file?.type?.startsWith("image/") || IMAGE_FILE_EXTENSION.test(file?.name || ""));
const SETTINGS_ROUTE_SECTIONS = { general: "General", usage: "Usage", personalization: "Personalization", developer: "Developer", "data-controls": "Data controls", storage: "Storage", security: "Security and login" };
const MAX_USER_MEMORIES = 25;
const USER_STORAGE_LIMIT_BYTES = 250 * 1024 * 1024;
const UNLIMITED_LIMIT = Number.MAX_SAFE_INTEGER;
const connectorRequestsInFlight = new Map();
const CONNECTED_APPS_CACHE_MS = 5 * 60 * 1000;
const connectedAppsCacheKey = (userId) => `jan-connected-apps-${userId}`;
function readConnectedAppsCache(userId) {
  if (!userId) return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(connectedAppsCacheKey(userId)) || "null");
    if (!cached || !Array.isArray(cached.items) || !Number.isFinite(cached.checkedAt) || cached.checkedAt > Date.now()) return null;
    return { checkedAt: cached.checkedAt, items: cached.items.filter((item) => typeof item?.slug === "string" && typeof item?.name === "string") };
  } catch { return null; }
}
function writeConnectedAppsCache(userId, items) {
  if (!userId) return;
  try {
    const safeItems = items.map(({ slug, name, description, logo }) => ({ slug, name, description, logo }));
    window.localStorage.setItem(connectedAppsCacheKey(userId), JSON.stringify({ checkedAt: Date.now(), items: safeItems }));
  } catch { /* Private browsing can disable local storage; live requests still work. */ }
}
function isAppConnected(slug, items) {
  const aliases = { googledrive: ["google_drive", "drive"], google_drive: ["googledrive", "drive"], outlook: ["outlook_email"] };
  return items.some((item) => [slug, ...(aliases[slug] || [])].includes(String(item.slug).toLowerCase()));
}

async function connectorApiRequest({ userId, action, toolkit, cursor, refresh = false }, method = "GET") {
  if (!userId || userId === "jan-demo") throw new Error("Sign in with your account before connecting an app.");
  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw new Error("Your sign-in session expired. Log in again, then retry.");
  const query = new URLSearchParams({ action, userId });
  if (toolkit) query.set("toolkit", toolkit);
  if (cursor) query.set("cursor", cursor);
  if (refresh) query.set("refresh", "1");
  const requestKey = method === "GET" ? `${userId}:${query.toString()}` : null;
  if (requestKey && connectorRequestsInFlight.has(requestKey)) return connectorRequestsInFlight.get(requestKey);
  const request = (async () => {
    const response = await fetch(`/api/connectors?${query}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
      ...(method === "POST" ? { body: JSON.stringify({ action, userId, toolkit }) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load app connections.");
    return payload;
  })();
  if (requestKey) connectorRequestsInFlight.set(requestKey, request);
  try { return await request; }
  finally { if (requestKey && connectorRequestsInFlight.get(requestKey) === request) connectorRequestsInFlight.delete(requestKey); }
}

function SourcePreview({ sources = [] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);
  const chipRef = useRef(null);
  if (!sources.length) return null;
  const source = sources[active] || sources[0];
  let domain = source.title || "Source";
  try { domain = new URL(source.url).hostname.replace(/^www\./, ""); } catch { /* Keep the source title. */ }
  const label = sources.some((item) => item.cited === false) && !sources.some((item) => item.cited) ? "Search results" : domain;
  return <div className="web-sources">
    <button ref={chipRef} type="button" className="web-source-chip" onClick={() => { const next = !open; if (next) { const rect = chipRef.current.getBoundingClientRect(); const width = Math.min(460, window.innerWidth - 28); const left = Math.max(14, Math.min(rect.left, window.innerWidth - width - 14)); setPosition(window.innerHeight - rect.bottom >= 250 ? { top: rect.bottom + 10, left } : { bottom: window.innerHeight - rect.top + 10, left }); } setOpen(next); }} aria-expanded={open} aria-label={`View ${sources.length} web source${sources.length === 1 ? "" : "s"}`}><FiGlobe /><span>{label}</span>{sources.length > 1 && <b>+{sources.length - 1}</b>}</button>
    {open && position && createPortal(<section className="web-source-popover" style={position} aria-label="Web source preview">
      <header><div><button type="button" onClick={() => setActive((active - 1 + sources.length) % sources.length)} disabled={sources.length < 2} aria-label="Previous source"><FiArrowLeft /></button><button type="button" onClick={() => setActive((active + 1) % sources.length)} disabled={sources.length < 2} aria-label="Next source"><FiArrowRight /></button></div><span>{active + 1}/{sources.length}</span><button type="button" className="web-source-close" onClick={() => setOpen(false)} aria-label="Close source preview"><FiX /></button></header>
      <a href={source.url} target="_blank" rel="noreferrer" className="web-source-card"><span><FiGlobe />{domain}<FiExternalLink /></span><strong>{source.title}</strong><p>{source.excerpt || "Open this source to read the supporting information."}</p></a>
    </section>, document.body)}
  </div>;
}


const CHAT_STARTERS = [
  { label: "Build an execution plan", prompt: "You are a senior chief-of-staff and product operations advisor. I will give you an objective, constraints, and available resources. Before proposing a plan, ask up to five high-value clarifying questions if critical information is missing. Then create a 90-day execution plan in this format: 1) executive objective and measurable success criteria, 2) strategic priorities ranked by impact, 3) milestone plan by week, 4) accountable owner and dependencies for each milestone, 5) risk register with mitigation, 6) decision log, and 7) the five actions I should take this week. Be specific, commercially realistic, and concise.\n\nObjective / context: [paste here]" },
  { label: "Make a decision", prompt: "You are an independent executive decision analyst. Analyse the decision below without assuming that my preferred option is correct. First identify missing facts and state your assumptions. Then compare the strongest three options in a decision matrix covering strategic fit, cost, upside, downside, execution difficulty, reversibility, and key risks. Finish with: a ranked recommendation, a 30-day validation plan, the decision I should make now, and the one piece of evidence most likely to change that recommendation. Use clear business language and challenge weak reasoning.\n\nDecision to analyse: [paste here]" },
  { label: "Draft a professional message", prompt: "You are a senior executive communications advisor. Draft a high-stakes professional message using the information below. If the audience, desired outcome, relationship context, or constraints are unclear, ask concise clarifying questions before drafting. Then provide: 1) a recommended subject line, 2) a polished message of 120–180 words, 3) a shorter version under 75 words, and 4) a brief explanation of the tone and persuasion choices. The message must be direct, credible, respectful, and action-oriented; avoid generic AI language, filler, and exaggerated claims.\n\nAudience: [who will receive it]\nDesired outcome: [what should happen next]\nContext / facts to include: [paste here]\nTone or constraints: [optional]" },
];

function ProjectManageModal({ project, conversations, onClose, onRenameProject, onDeleteProject, onRenameChat, onDeleteChat, onMoveConversation }) {
  return <div className="project-create-overlay" role="presentation"><section className="project-manage-dialog" role="dialog" aria-modal="true" aria-label="Manage project"><button type="button" className="project-create-close" onClick={onClose} aria-label="Close project actions"><FiX /></button><p>PROJECT ACTIONS</p><h2>{project.name}</h2><div className="project-manage-actions"><button type="button" onClick={onRenameProject}>Rename project</button><button type="button" className="danger" onClick={onDeleteProject}>Delete project</button></div><h3>Chats in this project</h3>{project.chats?.length ? <ul>{project.chats.map((chat) => <li key={chat.id}><span>{chat.title}</span><button type="button" onClick={() => onRenameChat(chat)}>Rename</button><button type="button" className="danger" onClick={() => onDeleteChat(chat.id)}>Delete</button></li>)}</ul> : <small>No project chats yet.</small>}<h3>Put an existing chat here</h3>{conversations.length ? <ul>{conversations.map((conversation) => <li key={conversation.id}><span>{conversation.title}</span><button type="button" onClick={() => onMoveConversation(conversation.id)}>Move here</button></li>)}</ul> : <small>No normal chats available.</small>}</section></div>;
}

function RenameConversationDialog({ conversation, onSave, onClose }) {
  const [title, setTitle] = useState(conversation.title);
  return <div className="project-create-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="project-create-dialog" onSubmit={(event) => { event.preventDefault(); onSave(title); }} role="dialog" aria-modal="true" aria-labelledby="rename-conversation-title"><button type="button" className="project-create-close" onClick={onClose} aria-label="Close rename dialog"><FiX /></button><p>CHAT ACTIONS</p><h2 id="rename-conversation-title">Rename chat</h2><span>Choose a clear title so you can find it later.</span><label><span className="sr-only">Chat title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength="120" /></label><button type="submit" disabled={!title.trim()}>Save name <FiArrowRight /></button></form></div>;
}

function formatChatTimestamp(value) {
  const date = new Date(value);
  const parts = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  return `${parts[0]}${String(parts[1]).padStart(2, "0")}${String(parts[2]).padStart(2, "0")}${String(parts[3]).padStart(2, "0")}${String(parts[4]).padStart(2, "0")}${String(parts[5]).padStart(2, "0")}`;
}

function chatUrl(conversation, user) {
  if (!conversation || !user?.id) return "/chat";
  return `/chat/${formatChatTimestamp(conversation.created_at || conversation.updated_at)}-${conversation.id.slice(0, 8)}`;
}

function groupChatsByDate(chats, now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  for (const chat of chats) {
    const date = new Date(chat.updated_at || chat.created_at);
    const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const age = Number.isNaN(day) ? 2 : Math.round((today - day) / 86400000);
    groups[age <= 0 ? "Today" : age === 1 ? "Yesterday" : "Earlier"].push(chat);
  }
  return Object.entries(groups).filter(([, items]) => items.length);
}

const PROJECT_COLORS = ["#536fa8", "#8b659a", "#4b8a79", "#bd7951", "#9c727b"];
function projectColor(id) {
  return PROJECT_COLORS[[...(id || "")].reduce((hash, char) => hash + char.charCodeAt(0), 0) % PROJECT_COLORS.length];
}

function SidebarConversation({ conversation, active, pinned, menuOpen, onOpen, onMenu, onRename, onPin, onDelete }) {
  return <div className={`chat-conversation ${active ? "active" : ""}`}><button type="button" className="chat-conversation-select" onClick={onOpen} aria-label={`Open ${conversation.title}`}><FiMessageCircle /><span><strong>{conversation.title}</strong><small>{new Date(conversation.updated_at).toLocaleDateString()}</small></span></button><button type="button" className="chat-conversation-more" onClick={onMenu} aria-label={`Conversation actions for ${conversation.title}`} aria-expanded={menuOpen}><FiMoreHorizontal /></button>{menuOpen && <div className="chat-conversation-menu" role="menu"><button type="button" role="menuitem" onClick={onRename}><FiEdit2 />Rename</button><button type="button" role="menuitem" onClick={onPin}><FiEdit2 />{pinned ? "Unpin" : "Pin"}</button><button type="button" className="chat-conversation-delete" role="menuitem" onClick={onDelete}><FiTrash2 />Delete</button></div>}</div>;
}

function SidebarSectionHeader({ children, expanded, onToggle }) {
  return <button type="button" className="chat-section-toggle" onClick={onToggle} aria-expanded={expanded}><span>{children}</span><FiChevronDown /></button>;
}

const FEATURED_GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];

function ModelPicker({ models, selected, details, open, more, pickerRef, onToggle, onMore, onSelect }) {
  const available = models.length ? models : ["openai/gpt-oss-20b"];
  const featured = FEATURED_GROQ_MODELS.filter((id) => available.includes(id));
  const additional = available.filter((id) => !FEATURED_GROQ_MODELS.includes(id));
  const visible = more ? additional : featured;
  return <div className="jan-model-picker" ref={pickerRef}>
    <button type="button" className="jan-model-trigger" onClick={onToggle} aria-haspopup="dialog" aria-expanded={open} aria-label={`Choose model, current model ${details[selected]?.name || selected}`}>
      <span>{details[selected]?.name || selected}</span><FiChevronDown aria-hidden="true" />
    </button>
    {open && <div className="jan-model-popover" role="dialog" aria-label="Choose a model">
      {more ? <button type="button" className="jan-model-back" onClick={() => onMore(false)}><FiChevronLeft /> All models</button> : <p className="jan-model-heading">AVAILABLE ON YOUR JAN FREE ACCOUNT</p>}
      <div className="jan-model-list">
        {visible.map((id) => {
          const item = details[id] || { name: id, description: "Available on Jan Free" };
          return <button type="button" className="jan-model-option" key={id} onClick={() => onSelect(id)} aria-current={selected === id ? "true" : undefined}>
            <span className="jan-model-option-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
            {selected === id && <FiCheck className="jan-model-check" aria-hidden="true" />}
          </button>;
        })}
      </div>
      {!more && additional.length > 0 && <button type="button" className="jan-model-more" onClick={() => onMore(true)}><span>More models</span><FiChevronRight aria-hidden="true" /></button>}
      <p className="jan-model-footnote">Models included with your Jan Free account.</p>
    </div>}
  </div>;
}

export default function ChatPage({ path = window.location.pathname, useUser, navigate, requestAuth, Header, Brand }) {
  const { user, loading: authLoading } = useUser();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("checking");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem("jan-sidebar-collapsed") === "true");
  const [selectedModel, setSelectedModel] = useState("openai/gpt-oss-20b");
  const [modelList, setModelList] = useState([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [showMoreModels, setShowMoreModels] = useState(false);
  const [conversationMenuId, setConversationMenuId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const skipTitleBlurRef = useRef(false);
  const [sidebarSections, setSidebarSections] = useState({ pinned: true, projects: true, chats: true });
  const [workspaceView, setWorkspaceView] = useState(() => /^\/library_[^/]+(?:\/file\/[^/]+)?$/i.test(path) ? "library" : /^\/plugins_[^/]+$/i.test(path) ? "hub" : /^\/plugin\/[^/]+\/[^/]+$/i.test(path) ? "plugin-detail" : /^\/assistant_[^/]+$/i.test(path) ? "assistant" : "chat");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("suggested");
  const [libraryLayout, setLibraryLayout] = useState("grid");
  const [libraryMessageFiles, setLibraryMessageFiles] = useState([]);
  const [libraryLocalFiles, setLibraryLocalFiles] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryPreview, setLibraryPreview] = useState(null);
  const [libraryMenuId, setLibraryMenuId] = useState(null);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [fullSearchResults, setFullSearchResults] = useState([]);
  const [fullSearchStatus, setFullSearchStatus] = useState("idle");
  const searchRunRef = useRef(0);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectNotice, setProjectNotice] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [projectSending, setProjectSending] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [projectManageOpen, setProjectManageOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectTab, setProjectTab] = useState("chats");
  const [activeProjectChatId, setActiveProjectChatId] = useState(null);
  const [hubSearch, setHubSearch] = useState("");
  const [hubSection, setHubSection] = useState("plugins");
  const [hubAudience, setHubAudience] = useState("public");
  const [connectedAppSearch, setConnectedAppSearch] = useState("");
  const [pluginCatalogSearch, setPluginCatalogSearch] = useState("");
  const [catalogMenuId, setCatalogMenuId] = useState(null);
  useEffect(() => {
    if (!catalogMenuId) return;
    const closeOnOutside = (event) => { if (!event.target.closest?.(".plugin-catalog-action-wrap")) setCatalogMenuId(null); };
    const closeOnEscape = (event) => { if (event.key === "Escape") setCatalogMenuId(null); };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [catalogMenuId]);
  const [connectorCatalog, setConnectorCatalog] = useState([]);
  const [connectorConnections, setConnectorConnections] = useState(() => readConnectedAppsCache(user?.id)?.items || []);
  const connectorUserIdRef = useRef(user?.id);
  connectorUserIdRef.current = user?.id;
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectorCursor, setConnectorCursor] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [connectorDetail, setConnectorDetail] = useState(null);
  const [connectorDetailLoading, setConnectorDetailLoading] = useState(false);
  const [connectorActionLoading, setConnectorActionLoading] = useState(false);
  const [connectorError, setConnectorError] = useState("");
  const [connectorNotice, setConnectorNotice] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentNotice, setAttachmentNotice] = useState("");
  const [persistenceNotice, setPersistenceNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(() => /^\/settings\//i.test(path));
  const [settingsSection, setSettingsSection] = useState(() => SETTINGS_ROUTE_SECTIONS[path.match(/^\/settings\/([^/]+)$/i)?.[1]?.toLowerCase()] || "General");
  const [dailyUsage, setDailyUsage] = useState(() => readDailyUsage(user?.id || user?.email));
  const [promoCode, setPromoCode] = useState("");
  const [promoCheckedUserId, setPromoCheckedUserId] = useState("");
  const hasUnlimitedAccess = promoCode === "FREE";
  const usageDayRef = useRef(new Date().toISOString().slice(0, 10));
  const [accountSettings, setAccountSettings] = useState(() => readSettings(user?.id || user?.email));
  const [memories, setMemories] = useState(() => readMemories(user?.id || user?.email));
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [pinnedIds, setPinnedIds] = useState(() => { try { return JSON.parse(window.localStorage.getItem(`jan-pinned-${user?.id || user?.email || "guest"}`) || "[]"); } catch { return []; } });
  const [recentsHover, setRecentsHover] = useState(false);
  const [recentsPos, setRecentsPos] = useState({ top: 0, left: 0 });
  const recentsRef = useRef(null);
  const [projectsHover, setProjectsHover] = useState(false);
  const [projectsPos, setProjectsPos] = useState({ top: 0, left: 0 });
  const projectsRef = useRef(null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const followLatestRef = useRef(true);
  const autoScrollingRef = useRef(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const libraryFileInputRef = useRef(null);
  const modelMenuRef = useRef(null);
  const settingsReturnPathRef = useRef("/chat");
  useEffect(() => { if (!modelMenuOpen) setShowMoreModels(false); }, [modelMenuOpen]);
  const abortControllerRef = useRef(null);
  const creatingConversationRef = useRef(null);
  const requestGeneration = useRef(0);
  const sendLock = useRef(false);
  const projectSendLock = useRef(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const cancelChatRequest = () => {
    requestGeneration.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    sendLock.current = false;
    setLoading(false);
  };
  useEffect(() => () => { requestGeneration.current += 1; abortControllerRef.current?.abort(); }, []);

  // Load conversations when user is available
  useEffect(() => {
    if (!user) return;
    if (user.is_demo) {
      const demoConversations = readDemoConversations();
      setConversations(demoConversations);
      return;
    }
    const loadConversations = async () => {
      const { data } = await supabase.from("conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (data) {
        setConversations(data);
      }
    };
    loadConversations();
  }, [user]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyAppearance = () => {
      const dark = accountSettings.appearance === "dark" || (accountSettings.appearance === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    applyAppearance();
    media.addEventListener("change", applyAppearance);
    return () => media.removeEventListener("change", applyAppearance);
  }, [accountSettings.appearance]);

  useEffect(() => {
    if (!user) return;
    const libraryRoute = path.match(/^\/library_([^/]+)(\/file\/[^/]+)?$/i);
    if (libraryRoute) {
      setWorkspaceView("library");
      setSidebarCollapsed(true);
      setSidebarOpen(false);
      const canonicalPath = `/library_${encodeURIComponent(user.id || user.email)}${libraryRoute[2] || ""}`;
      if (path !== canonicalPath) navigate(canonicalPath);
    } else if (/^\/plugins_[^/]+$/i.test(path)) {
      setWorkspaceView("hub");
      setSidebarCollapsed(true);
      setSidebarOpen(false);
      const canonicalPath = `/plugins_${encodeURIComponent(user.id || user.email)}`;
      if (path !== canonicalPath) navigate(canonicalPath);
    } else if (/^\/plugin\/[^/]+\/[^/]+$/i.test(path)) {
      setWorkspaceView("plugin-detail");
      setSidebarCollapsed(true);
      setSidebarOpen(false);
      const [, requestedUserId, toolkitSlug] = path.match(/^\/plugin\/([^/]+)\/([^/]+)$/i) || [];
      const canonicalPath = `/plugin/${encodeURIComponent(user.id || user.email)}/${encodeURIComponent(decodeURIComponent(toolkitSlug || ""))}${window.location.search}`;
      if (decodeURIComponent(requestedUserId || "") !== String(user.id || user.email)) navigate(canonicalPath);
    } else if (/^\/assistant_[^/]+$/i.test(path)) {
      setWorkspaceView("assistant");
      setSidebarCollapsed(true);
      setSidebarOpen(false);
    } else if (["library", "hub", "plugin-detail", "assistant"].includes(workspaceView)) {
      setWorkspaceView("chat");
    }
  }, [path, user]);

  const requestedConnector = path.match(/^\/plugin\/[^/]+\/([^/]+)$/i)?.[1];
  const connectorSlug = requestedConnector ? decodeURIComponent(requestedConnector).toLowerCase() : "";
  const loadConnectorCatalog = useCallback(async (cursor = null, append = false, refresh = false) => {
    if (!user) return;
    setCatalogLoading(true);
    setConnectorError("");
    try {
      const result = await connectorApiRequest({ userId: user.id, action: "catalog", cursor, refresh });
      setConnectorCatalog((current) => append ? [...current, ...result.items] : result.items);
      setConnectorCursor(result.nextCursor || null);
    } catch (loadError) { setConnectorError(loadError.message); }
    finally { setCatalogLoading(false); setCatalogLoaded(true); }
  }, [user]);

  const loadConnectedApps = useCallback(async (force = false) => {
    const userId = user?.id;
    if (!userId || connectorUserIdRef.current !== userId) return;
    const cached = readConnectedAppsCache(userId);
    if (cached) setConnectorConnections(cached.items);
    if (cached && !force && Date.now() - cached.checkedAt < CONNECTED_APPS_CACHE_MS) return;
    setConnectionsLoading(!cached);
    try {
      const result = await connectorApiRequest({ userId, action: "connected" });
      const items = result.items || [];
      if (connectorUserIdRef.current === userId) {
        writeConnectedAppsCache(userId, items);
        setConnectorConnections(items);
        setConnectorDetail((current) => current?.connector?.slug?.toLowerCase() === connectorSlug ? { ...current, connected: isAppConnected(connectorSlug, items) } : current);
      }
    } catch (loadError) { if (connectorUserIdRef.current === userId) setConnectorError(loadError.message); }
    finally { if (connectorUserIdRef.current === userId) setConnectionsLoading(false); }
  }, [user?.id, connectorSlug]);

  useEffect(() => { setConnectorConnections(readConnectedAppsCache(user?.id)?.items || []); }, [user?.id]);

  useEffect(() => {
    if (workspaceView === "hub" && user && !catalogLoaded && !catalogLoading) void loadConnectorCatalog();
  }, [workspaceView, user, catalogLoaded, catalogLoading, loadConnectorCatalog]);

  useEffect(() => {
    if (["hub", "plugin-detail"].includes(workspaceView) && user) void loadConnectedApps(new URLSearchParams(window.location.search).get("connected") === "1");
  }, [workspaceView, user, path, loadConnectedApps]);

  useEffect(() => {
    if (workspaceView !== "plugin-detail" || !user || !connectorSlug) return;
    let active = true;
    setConnectorDetail(null);
    setConnectorDetailLoading(true);
    setConnectorError("");
    if (connectorSlug === "higgsfield") {
      setConnectorDetail({ connector: { slug: "higgsfield", name: "Higgsfield", description: "Higgsfield is not currently available in Composio’s connected app catalog. Jan can add it once an official API connector is available.", available: false }, connected: false });
      setConnectorDetailLoading(false);
      return () => { active = false; };
    }
    const cached = readConnectedAppsCache(user.id);
    const returningFromAuth = new URLSearchParams(window.location.search).get("connected") === "1";
    if (!returningFromAuth && cached && Date.now() - cached.checkedAt < CONNECTED_APPS_CACHE_MS) {
      const connectedApp = cached.items.find((item) => isAppConnected(connectorSlug, [item]));
      const catalogApp = connectorCatalog.find((item) => item.slug === connectorSlug);
      const app = catalogApp || connectedApp;
      if (app) {
        setConnectorDetail({ connector: { slug: connectorSlug, name: app.name, description: app.description || `Connect ${app.name} to let Jan use its available tools.`, logo: app.logo || null, available: true }, connected: Boolean(connectedApp) });
        setConnectorDetailLoading(false);
        return () => { active = false; };
      }
    }
    connectorApiRequest({ userId: user.id, action: "status", toolkit: connectorSlug }).then((result) => {
      if (active) {
        setConnectorDetail(result);
        if (new URLSearchParams(window.location.search).get("connected") === "1") setConnectorNotice(result.connected ? `${result.connector.name} connected successfully.` : "Authorization finished. Refreshing connection status…");
      }
    }).catch((loadError) => { if (active) setConnectorError(loadError.message); })
      .finally(() => { if (active) setConnectorDetailLoading(false); });
    return () => { active = false; };
  }, [workspaceView, user, connectorSlug, path]);

  const connectConnector = async () => {
    if (!user || !connectorSlug) return;
    setConnectorActionLoading(true);
    setConnectorError("");
    try {
      const result = await connectorApiRequest({ userId: user.id, action: "connect", toolkit: connectorSlug }, "POST");
      window.location.assign(result.redirectUrl);
    } catch (connectError) {
      setConnectorError(connectError.message);
      setConnectorActionLoading(false);
    }
  };

  useEffect(() => {
    const settingsRoute = path.match(/^\/settings\/([^/]+)$/i);
    if (!settingsRoute) {
      if (settingsOpen) setSettingsOpen(false);
      return;
    }
    setSettingsSection(SETTINGS_ROUTE_SECTIONS[settingsRoute[1].toLowerCase()] || "General");
    setSettingsOpen(true);
  }, [path]);

  useEffect(() => {
    if (!user || workspaceView !== "library") return;
    const fileRoute = path.match(/^\/library_[^/]+\/file\/([^/]+)$/i);
    if (!fileRoute) { if (libraryPreview) setLibraryPreview(null); return; }
    const fileId = decodeURIComponent(fileRoute[1]);
    const projectFiles = projects.flatMap((project) => (project.files || []).map((file) => ({ ...file, preview: file.preview || file.source?.preview || file.source?.dataUrl, content: file.content || file.source?.content, id: `project-${project.id}-${file.id}`, created_at: file.created_at || project.updated_at || project.created_at, origin: project.name, source: "project" })));
    const file = [...libraryLocalFiles, ...libraryMessageFiles, ...projectFiles].find((item) => item.id === fileId);
    if (file && libraryPreview?.id !== file.id) setLibraryPreview(file);
  }, [path, user, workspaceView, libraryLocalFiles, libraryMessageFiles, projects]);

  useEffect(() => {
    if (!user || workspaceView !== "library") return;
    const storageKey = `jan-library-files-${user.id || user.email}`;
    try { setLibraryLocalFiles(JSON.parse(window.localStorage.getItem(storageKey) || "[]")); } catch { setLibraryLocalFiles([]); }
    const loadLibraryMessages = async () => {
      setLibraryLoading(true);
      if (user.is_demo) {
        const files = conversations.flatMap((conversation) => readDemoMessages(conversation.id).flatMap((message) => messageFiles(message).map((file, index) => ({ ...restoreAttachments([file])[0], id: `chat-${message.id}-${index}`, created_at: message.created_at, origin: conversation.title, source: "chat" }))));
        setLibraryMessageFiles(files);
        setLibraryLoading(false);
        return;
      }
      const ids = conversations.map((conversation) => conversation.id);
      if (!ids.length) { setLibraryMessageFiles([]); setLibraryLoading(false); return; }
      const { data } = await supabase.from("messages").select("id, conversation_id, attachments, created_at").in("conversation_id", ids).order("created_at", { ascending: false });
      const titles = new Map(conversations.map((conversation) => [conversation.id, conversation.title]));
      setLibraryMessageFiles((data || []).flatMap((message) => messageFiles(message).map((file, index) => ({ ...restoreAttachments([file])[0], id: `chat-${message.id}-${index}`, created_at: message.created_at, origin: titles.get(message.conversation_id) || "Chat", source: "chat" }))));
      setLibraryLoading(false);
    };
    void loadLibraryMessages();
  }, [workspaceView, user, conversations]);

  // A saved chat keeps a short readable URL: creation time plus its permanent ID prefix.
  useEffect(() => {
    if (!user || !conversations.length) return;
    const match = window.location.pathname.match(/^\/chat\/(\d{14})-([a-z0-9]{8})$/i);
    if (!match) return;
    const conversation = conversations.find((item) => item.id.startsWith(match[2]) && formatChatTimestamp(item.created_at || item.updated_at) === match[1]);
    if (conversation) setActiveConversationId(conversation.id);
  }, [conversations, user]);

  useEffect(() => {
    if (!user) return;
    if (user.is_demo) { setDailyUsage(readDailyUsage(user.id || user.email)); setAccountSettings(readSettings(user.id || user.email)); setMemories(readMemories(user.id || user.email)); return; }
    const loadAccountState = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: settingsRow }, { data: usageRow }, { data: memoryRows }, { data: promoRow }] = await Promise.all([supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(), supabase.from("daily_usage").select("messages, uploads").eq("user_id", user.id).eq("usage_date", today).maybeSingle(), supabase.from("user_memories").select("*").eq("user_id", user.id).order("created_at", { ascending: false }), supabase.from("user_promos").select("code").eq("user_id", user.id).maybeSingle()]);
      const nextSettings = { ...DEFAULT_SETTINGS, ...(settingsRow || {}), language: "auto" };
      setAccountSettings(nextSettings); writeSettings(user.id, nextSettings);
      const nextUsage = usageRow || { messages: 0, uploads: 0 };
      setDailyUsage(nextUsage); writeDailyUsage(user.id, nextUsage);
      setMemories(memoryRows || []); writeMemories(user.id, memoryRows || []);
      setPromoCode(promoRow?.code || "");
      setPromoCheckedUserId(user.id);
    };
    loadAccountState();
  }, [user]);
  const applyPromoCode = async (rawCode) => {
    const code = String(rawCode || "").trim().toUpperCase();
    if (code !== "FREE") return { error: "That promo code isn’t valid." };
    if (user?.is_demo) return { error: "Sign in to apply promo codes to your account." };
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (sessionError || !token) return { error: "Your sign-in session expired. Log in again and retry." };
    const response = await fetch("/api/promos", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { error: result.error || "Couldn’t apply that code. Please try again." };
    setPromoCode(code);
    return { error: null };
  };
  useEffect(() => {
    if (!user) return;
    usageDayRef.current = new Date().toISOString().slice(0, 10);
    const timer = window.setInterval(async () => {
      const today = new Date().toISOString().slice(0, 10);
      if (today === usageDayRef.current) return;
      usageDayRef.current = today;
      if (user.is_demo) { setDailyUsage(readDailyUsage(user.id || user.email)); return; }
      const { data } = await supabase.from("daily_usage").select("messages, uploads").eq("user_id", user.id).eq("usage_date", today).maybeSingle();
      setDailyUsage(data || { messages: 0, uploads: 0 });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [user]);
  const changePassword = async ({ currentPassword, newPassword }) => {
    if (user?.is_demo) return { error: "Password changes aren’t available in the local demo." };
    const { error } = await supabase.auth.updateUser({ current_password: currentPassword, password: newPassword });
    return error ? { error: error.message || "Couldn’t change your password. Please try again." } : { error: null };
  };
  const saveAccountSettings = (nextSettings) => {
    const normalizedSettings = { ...nextSettings, language: "auto" };
    setAccountSettings(normalizedSettings);
    writeSettings(user?.id || user?.email, normalizedSettings);
    if (user?.is_demo) return;
    const payload = {
      user_id: user.id,
      appearance: normalizedSettings.appearance,
      language: "auto",
      response_streaming: normalizedSettings.response_streaming,
      custom_instructions: normalizedSettings.custom_instructions,
      response_style: normalizedSettings.response_style || "balanced",
      developer_mode: normalizedSettings.developer_mode,
      updated_at: new Date().toISOString(),
    };
    supabase.from("user_settings").upsert(payload).then(({ error: saveError }) => {
      if (saveError) setPersistenceNotice(saveError.code === "42703" || saveError.code === "PGRST204"
        ? "Settings sync needs a database update. Your change is saved on this device."
        : "Your settings are saved on this device, but could not be synced yet.");
      else setPersistenceNotice("");
    });
  };
  const addMemory = async (content) => { const text = String(content || "").trim().slice(0, 220); if (!text || memories.length >= MAX_USER_MEMORIES || memories.some((memory) => memory.content.toLowerCase() === text.toLowerCase())) return false; const localMemory = { id: globalThis.crypto?.randomUUID?.() || `memory-${Date.now()}`, content: text, created_at: new Date().toISOString() }; if (user?.is_demo) { const next = [localMemory, ...memories]; setMemories(next); writeMemories(user.id || user.email, next); return true; } const { data, error: memoryError } = await supabase.from("user_memories").insert({ user_id: user.id, content: text }).select().single(); if (memoryError || !data) { setPersistenceNotice("Jan couldn’t save that memory yet. Please try again."); return false; } const next = [data, ...memories]; setMemories(next); writeMemories(user.id, next); return true; };
  const deleteMemory = async (id) => { if (!user?.is_demo) { const { error } = await supabase.from("user_memories").delete().eq("id", id); if (error) { setPersistenceNotice("Jan couldn’t delete that memory yet. Please try again."); return; } } const next = memories.filter((memory) => memory.id !== id); setMemories(next); writeMemories(user?.id || user?.email, next); };
  const updateMemory = async (id, content) => { const text = String(content || "").trim().slice(0, 220); if (!text) return false; if (!user?.is_demo) { const { error } = await supabase.from("user_memories").update({ content: text }).eq("id", id); if (error) { setPersistenceNotice("Jan couldn’t update that memory yet. Please try again."); return false; } } const next = memories.map((memory) => memory.id === id ? { ...memory, content: text } : memory); setMemories(next); writeMemories(user?.id || user?.email, next); return true; };
  const refreshUsage = async () => {
    if (!user || user.is_demo) return;
    const { data, error } = await supabase.from("daily_usage").select("messages, uploads").eq("user_id", user.id).eq("usage_date", new Date().toISOString().slice(0, 10)).maybeSingle();
    if (!error) setDailyUsage(data || { messages: 0, uploads: 0 });
  };
  const recordUsage = (kind, amount = 1) => {
    if (!user?.is_demo) { void refreshUsage(); return; }
    setDailyUsage((current) => { const next = { ...current, [kind]: current[kind] + amount }; writeDailyUsage(user.id, next); return next; });
  };

  useEffect(() => {
    if (!user) return;
    if (user.is_demo) { setProjects(readProjects(user.id || user.email)); return; }
    const loadProjects = async () => {
      const { data: projectRows, error: projectError } = await supabase.from("projects").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (projectError) { setProjects(readProjects(user.id || user.email)); return; }
      const ids = (projectRows || []).map((project) => project.id);
      if (!ids.length) { setProjects([]); return; }
      const [{ data: chatRows }, { data: fileRows }] = await Promise.all([
        supabase.from("project_chats").select("*, project_messages(*)").in("project_id", ids).order("updated_at", { ascending: false }),
        supabase.from("project_files").select("*").in("project_id", ids).order("created_at", { ascending: true }),
      ]);
      const nextProjects = projectRows.map((project) => ({ ...project, files: (fileRows || []).filter((file) => file.project_id === project.id).map((file) => ({ id: file.id, name: file.name, type: file.mime_type, size: file.compressed_size, originalSize: file.original_size, compression: file.compression, path: file.storage_path })), chats: (chatRows || []).filter((chat) => chat.project_id === project.id).map((chat) => ({ ...chat, messages: (chat.project_messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((message) => ({ ...message, attachments: restoreAttachments(message.attachments) })) })) }));
      setProjects(nextProjects);
      writeProjects(user.id, nextProjects);
    };
    loadProjects();
  }, [user]);

  useConversationMessages({ conversationId: activeConversationId, user, client: supabase, creatingConversationRef, setMessages, setMessagesLoading, setError });

  const scrollToLatest = (behavior = "auto") => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  };

  useEffect(() => {
    if (!followLatestRef.current) return undefined;
    const scrollConversation = () => scrollToLatest();
    const frame = window.requestAnimationFrame(scrollConversation);
    const settleTimer = window.setTimeout(scrollConversation, 250);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(settleTimer); };
  }, [messages, loading]);
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 176)}px`;
  }, [draft]);
  useEffect(() => {
    let active = true;
    fetch("/api/chat").then((r) => r.json()).then((p) => { if (active) { setConnection(p.configured ? "ready" : "missing"); if (p.models) setModelList(p.models); if (p.model) setSelectedModel(p.model); } }).catch(() => { if (active) setConnection("missing"); });
    return () => { active = false; };
  }, []);
  // Close model menu on outside click
  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (e) => { if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) setModelMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);
  useEffect(() => { window.localStorage.setItem("jan-sidebar-collapsed", String(sidebarCollapsed)); }, [sidebarCollapsed]);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 900px)");
    const expandForDrawer = () => { if (narrow.matches) setSidebarCollapsed(false); };
    expandForDrawer();
    narrow.addEventListener("change", expandForDrawer);
    return () => narrow.removeEventListener("change", expandForDrawer);
  }, []);
  useEffect(() => {
    const openProjectActions = (event) => { if (event.target.closest?.('[aria-label="Project actions"]')) setProjectManageOpen(true); };
    document.addEventListener("click", openProjectActions);
    return () => document.removeEventListener("click", openProjectActions);
  }, []);
  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setChatSearchOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setWorkspaceView("chat");
        newConversation();
      }
      if (event.key === "Escape") {
        if (libraryPreview && user) {
          setLibraryPreview(null);
          navigate(`/library_${encodeURIComponent(user.id || user.email)}`);
        }
        setChatSearchOpen(false);
        setModelMenuOpen(false);
        setConversationMenuId(null);
        setSettingsOpen(false);
        setProjectManageOpen(false);
        setProjectCreateOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [libraryPreview, user]);

  const createConversation = useCallback(async (title) => {
    if (!user) return null;
    if (user.is_demo) {
      const createdAt = new Date().toISOString();
      const conversation = { id: globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}`, title: title || "New conversation", created_at: createdAt, updated_at: createdAt };
      setConversations((previous) => { const next = [conversation, ...previous]; writeDemoConversations(next); return next; });
      return conversation;
    }
    const { data } = await supabase.from("conversations").insert({ user_id: user.id, title: title || "New conversation" }).select().single();
    if (data) setConversations((prev) => [data, ...prev]);
    return data;
  }, [user]);

  const openPersonalAssistant = useCallback(async () => {
    if (!user) return;
    const key = `jan-personal-assistant-${user.id || user.email}`;
    const savedId = window.localStorage.getItem(key);
    let conversation = conversations.find((item) => item.id === savedId);
    if (!conversation) {
      conversation = conversations.find((item) => item.title === "Personal Assistant") || await createConversation("Personal Assistant");
      if (!conversation) { setError("Couldn’t open your personal assistant. Please try again."); return; }
      window.localStorage.setItem(key, conversation.id);
    }
    cancelChatRequest();
    setMessages([]);
    setMessagesLoading(true);
    setActiveConversationId(conversation.id);
    setWorkspaceView("assistant");
    setSidebarCollapsed(true);
    setSidebarOpen(false);
    setError("");
    navigate(`/assistant_${encodeURIComponent(user.id || user.email)}`);
  }, [user, conversations, createConversation]);

  useEffect(() => {
    if (!user || !/^\/assistant_[^/]+$/i.test(path) || activeConversationId) return;
    void openPersonalAssistant();
  }, [path, user, activeConversationId, openPersonalAssistant]);

  const saveMessage = useCallback(async (conversationId, role, content, attachmentMetadata = []) => {
    if (!conversationId) return null;
    if (user?.is_demo) {
      const message = { id: globalThis.crypto?.randomUUID?.() || `demo-message-${Date.now()}`, role, content, attachments: attachmentMetadata, created_at: new Date().toISOString() };
      window.localStorage.setItem(demoMessagesKey(conversationId), JSON.stringify([...readDemoMessages(conversationId), message]));
      return message;
    }
    const payload = { conversation_id: conversationId, role, content, attachments: attachmentMetadata };
    const { data, error: saveError } = await supabase.from("messages").insert(payload).select().single();
    if (saveError) throw new Error(saveError.message?.includes("DAILY_UPLOAD_LIMIT") ? "You have used your 3 uploads for today. Remove the new files or wait until midnight UTC." : "Couldn’t save this message. Your draft and files have been kept.");
    return data;
  }, [user]);

  const updateConversationTitle = useCallback(async (conversationId, title) => {
    if (!conversationId) return;
    if (user?.is_demo) {
      setConversations((previous) => { const next = previous.map((conversation) => conversation.id === conversationId ? { ...conversation, title, updated_at: new Date().toISOString() } : conversation); writeDemoConversations(next); return next; });
      return;
    }
    await supabase.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", conversationId);
    setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, title, updated_at: new Date().toISOString() } : c));
  }, [user]);

  const send = async (contentOverride, { reuseLastUser = false } = {}) => {
    const content = (typeof contentOverride === "string" ? contentOverride : draft).trim();
    if ((!content && !attachments.length) || sendLock.current || messagesLoading) return;
    if (user?.is_demo) { setError("Sign in to send messages. Live AI is unavailable in the local demo."); return; }
    if (promoCheckedUserId === user?.id && !hasUnlimitedAccess && dailyUsage.messages >= FREE_DAILY_MESSAGE_LIMIT) { setError("You’ve used your 100 messages for today. Your allowance resets at midnight UTC."); return; }
    sendLock.current = true;
    const generation = ++requestGeneration.current;
    const current = () => generation === requestGeneration.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError("");
    followLatestRef.current = true;
    setShowLatestButton(false);
    let convId = activeConversationId;
    let streamedContent = "";
    let responseSources = [];
    let displayedContent = "";
    let latestStreamContent = "";
    let revealFrame = null;
    let savedUser = false;
    const assistantId = crypto.randomUUID();
    const firstMessage = messages.length === 0;
    const activeAttachments = reuseLastUser ? [] : serializeAttachments(attachments);
    const displayContent = content || `Uploaded ${attachments.length} file${attachments.length === 1 ? "" : "s"}`;
    const started = performance.now();
    try {
      if (!convId) {
        const conversation = await createConversation("New conversation");
        if (!conversation) throw new Error("Couldn’t create this conversation. Please try again.");
        convId = conversation.id;
        if (!current()) return;
        creatingConversationRef.current = convId;
        setActiveConversationId(convId);
        navigate(chatUrl(conversation, user));
      }
      const userMsg = reuseLastUser ? messages.filter((message) => message.role === "user").at(-1) : await saveMessage(convId, "user", displayContent, activeAttachments);
      if (!userMsg) throw new Error("Couldn’t save this message. Your draft and files have been kept.");
      savedUser = true;
      if (!current()) return;
      const hydrated = { ...userMsg, attachments: restoreAttachments(userMsg.attachments || []) };
      // Keep the new user message and the beginning of Jan's reply in view.
      autoScrollingRef.current = true;
      setMessages((previous) => reuseLastUser ? [...previous, { id: assistantId, role: "assistant", content: "", streaming: true }] : [...previous, hydrated, { id: assistantId, role: "assistant", content: "", streaming: true }]);
      window.requestAnimationFrame(() => scrollToLatest());
      window.setTimeout(() => scrollToLatest(), 120);
      window.setTimeout(() => { autoScrollingRef.current = false; }, 250);
      if (!reuseLastUser) { setDraft(""); setAttachments([]); setAttachmentError(""); setAttachmentNotice(""); }
      setPersistenceNotice("");
      if (activeAttachments.length) recordUsage("uploads", activeAttachments.length);
      await requestChat({
        client: supabase, user, messages: buildChatMessages(reuseLastUser ? (messages.at(-1)?.role === "assistant" ? messages.slice(0, -1) : messages) : [...messages, hydrated]), model: selectedModel,
        preferences: accountSettings, memories: memories.map((memory) => memory.content), signal: controller.signal,
        onUsage: (usage) => { if (current()) setDailyUsage(usage); },
        onSources: (sources) => {
          responseSources = sources;
          if (current()) setMessages((previous) => previous.map((message) => message.id === assistantId ? { ...message, sources } : message));
        },
        onDelta: (text) => {
          streamedContent = text;
          latestStreamContent = text;
          if (revealFrame || !current()) return;
          const reveal = () => {
            if (!current()) return;
            const remaining = latestStreamContent.length - displayedContent.length;
            if (remaining <= 0) { revealFrame = null; return; }
            displayedContent = latestStreamContent.slice(0, displayedContent.length + Math.min(remaining, Math.max(2, Math.ceil(remaining / 18))));
            setMessages((previous) => previous.map((message) => message.id === assistantId ? { ...message, content: displayedContent } : message));
            revealFrame = window.requestAnimationFrame(reveal);
          };
          revealFrame = window.requestAnimationFrame(reveal);
        },
      });
    } catch (requestError) {
      if (current()) setError(requestError.name === "AbortError" ? "Response stopped." : requestError.message || "Jan couldn’t respond. Please try again.");
    } finally {
      if (revealFrame) window.cancelAnimationFrame(revealFrame);
      if (creatingConversationRef.current === convId) creatingConversationRef.current = null;
      if (streamedContent.trim() && savedUser) {
        if (accountSettings.developer_mode) {
          const seconds = Math.max(.1, (performance.now() - started) / 1000);
          const tokens = Math.max(1, Math.round(streamedContent.length / 4));
          streamedContent += `\n\n---\n*Developer: ~${tokens} output tokens · ${seconds.toFixed(1)}s · ~${Math.round(tokens / seconds)} tokens/s*`;
        }
        if (current()) setMessages((previous) => previous.map((message) => message.id === assistantId ? { ...message, content: streamedContent, sources: responseSources, streaming: false } : message));
        try {
          const sourceMetadata = responseSources.map((source) => ({ ...source, name: source.title, type: WEB_SOURCE_TYPE, size: 0 }));
          await saveMessage(convId, "assistant", streamedContent, sourceMetadata);
          if (firstMessage) await updateConversationTitle(convId, makeConversationTitle(content, "New conversation"));
        } catch {
          if (current()) setPersistenceNotice("This response could not be saved. Copy it before leaving this page.");
        }
      } else if (current()) setMessages((previous) => previous.filter((message) => message.id !== assistantId));
      if (current()) { abortControllerRef.current = null; sendLock.current = false; setLoading(false); void refreshUsage(); }
    }
  };

  const stopGenerating = () => {
    if (!abortControllerRef.current) return;
    setMessages((current) => current.map((message) => message.streaming ? { ...message, streaming: false } : message));
    abortControllerRef.current.abort();
  };

  const switchConversation = (convId) => { const conversation = conversations.find((item) => item.id === convId); cancelChatRequest(); setMessages([]); setMessagesLoading(true); followLatestRef.current = true; setShowLatestButton(false); setActiveConversationId(convId); if (conversation) navigate(chatUrl(conversation, user)); setSidebarOpen(false); setConversationMenuId(null); setError(""); setAttachmentError(""); setAttachmentNotice(""); setPersistenceNotice(""); };
  const newConversation = () => { cancelChatRequest(); navigate("/chat"); setMessagesLoading(false); followLatestRef.current = true; setShowLatestButton(false); setActiveConversationId(null); setMessages([]); setDraft(""); setAttachments([]); setError(""); setAttachmentError(""); setAttachmentNotice(""); setPersistenceNotice(""); setSidebarOpen(false); textareaRef.current?.focus(); };
  const deleteConversation = async (convId) => { setConversationMenuId(null); if (user?.is_demo) { setConversations((previous) => { const next = previous.filter((conversation) => conversation.id !== convId); writeDemoConversations(next); return next; }); window.localStorage.removeItem(demoMessagesKey(convId)); } else { const { error: deleteError } = await supabase.from("conversations").delete().eq("id", convId); if (deleteError) { setError("Couldn’t delete this conversation. It was kept."); return; } setConversations((prev) => prev.filter((c) => c.id !== convId)); } if (activeConversationId === convId) newConversation(); };
  const persistProjects = (update) => { setProjects((previous) => { const next = typeof update === "function" ? update(previous) : update; writeProjects(user?.id || user?.email, next); return next; }); };
  const createProject = () => { setProjectName(""); setProjectCreateOpen(true); };
  const confirmCreateProject = async () => {
    const name = projectName.trim();
    if (!name) return;
    let project = { id: globalThis.crypto?.randomUUID?.() || `project-${Date.now()}`, name, files: [], chats: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (!user?.is_demo) {
      const { data, error: saveError } = await supabase.from("projects").insert({ user_id: user.id, name }).select().single();
      if (saveError || !data) { setProjectNotice(`Couldn’t save “${name}”. ${saveError?.message || "Please try again."}`); return; }
      project = { ...data, files: [], chats: [] };
    }
    persistProjects([project, ...projects]);
    setActiveProjectId(project.id);
    setWorkspaceView("project");
    setProjectTab("chats");
    setProjectCreateOpen(false);
    setProjectName("");
    setProjectNotice(`Project “${name}” created successfully`);
    window.setTimeout(() => setProjectNotice(""), 3200);
  };
  const openProject = (projectId) => { cancelChatRequest(); setActiveProjectId(projectId); setActiveProjectChatId(null); setWorkspaceView("project"); setProjectTab("chats"); setProjectDraft(""); setProjectError(""); setSidebarOpen(false); };
  const renameProject = async () => { if (!activeProject) return; const name = window.prompt("Rename project", activeProject.name)?.trim(); if (!name || name === activeProject.name) return; if (!user?.is_demo) { const { error } = await supabase.from("projects").update({ name, updated_at: new Date().toISOString() }).eq("id", activeProject.id); if (error) { setProjectError("Couldn’t rename this project. Please try again."); return; } } persistProjects(projects.map((project) => project.id === activeProject.id ? { ...project, name } : project)); };
  const deleteProject = async () => { if (!activeProject || !window.confirm(`Delete “${activeProject.name}” and every chat and file in it?`)) return; if (!user?.is_demo) { const paths = (activeProject.files || []).map((file) => file.path).filter(Boolean); if (paths.length) { const { error: filesError } = await supabase.storage.from("project-files").remove(paths); if (filesError) { setProjectError("Couldn’t delete the project files. The project was kept."); return; } } const { error } = await supabase.from("projects").delete().eq("id", activeProject.id); if (error) { setProjectError("Couldn’t delete this project. It was kept."); return; } } persistProjects(projects.filter((project) => project.id !== activeProject.id)); setProjectManageOpen(false); setActiveProjectId(null); setActiveProjectChatId(null); setWorkspaceView("chat"); };
  const renameProjectChat = async (chat) => { const title = window.prompt("Rename project chat", chat.title)?.trim(); if (!title || title === chat.title || !activeProject) return; if (!user?.is_demo) { const { error } = await supabase.from("project_chats").update({ title, updated_at: new Date().toISOString() }).eq("id", chat.id); if (error) { setProjectError("Couldn’t rename this chat. Please try again."); return; } } persistProjects(projects.map((project) => project.id === activeProject.id ? { ...project, chats: (project.chats || []).map((item) => item.id === chat.id ? { ...item, title } : item) } : project)); };
  const deleteProjectChat = async (chatId) => { if (!activeProject || !window.confirm("Delete this project chat?")) return; if (!user?.is_demo) { const { error } = await supabase.from("project_chats").delete().eq("id", chatId); if (error) { setProjectError("Couldn’t delete this chat. It was kept."); return; } } persistProjects(projects.map((project) => project.id === activeProject.id ? { ...project, chats: (project.chats || []).filter((chat) => chat.id !== chatId) } : project)); setProjectManageOpen(false); if (activeProjectChatId === chatId) { setActiveProjectChatId(null); setWorkspaceView("project"); } };
  const moveConversationToProject = async (conversationId) => { if (!activeProject) return; const conversation = conversations.find((item) => item.id === conversationId); if (!conversation) return; let sourceMessages = []; if (user?.is_demo) sourceMessages = readDemoMessages(conversationId); else { const { data, error } = await supabase.from("messages").select("role, content, attachments, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }); if (error) { setProjectError("Couldn’t read this chat. It was not moved."); return; } sourceMessages = data || []; } let projectChat = { id: globalThis.crypto?.randomUUID?.() || `project-chat-${Date.now()}`, title: conversation.title, messages: sourceMessages.map((message) => ({ ...message, attachments: restoreAttachments(message.attachments) })), created_at: conversation.updated_at, updated_at: conversation.updated_at }; if (!user?.is_demo) { const { data: savedChat, error: chatError } = await supabase.from("project_chats").insert({ project_id: activeProject.id, title: conversation.title }).select().single(); if (chatError || !savedChat) { setProjectError(chatError?.message || "Couldn’t move this chat."); return; } projectChat = { ...projectChat, ...savedChat }; if (sourceMessages.length) { const { error: messagesError } = await supabase.from("project_messages").insert(sourceMessages.map((message) => ({ project_chat_id: savedChat.id, role: message.role, content: message.content, attachments: message.attachments || [] }))); if (messagesError) { await supabase.from("project_chats").delete().eq("id", savedChat.id); setProjectError("Couldn’t copy this chat. The original was kept."); return; } } const { error: deleteError } = await supabase.from("conversations").delete().eq("id", conversationId); if (deleteError) { await supabase.from("project_chats").delete().eq("id", savedChat.id); setProjectError("Couldn’t finish moving this chat. The original was kept."); return; } } else { window.localStorage.removeItem(demoMessagesKey(conversationId)); }
    persistProjects(projects.map((project) => project.id === activeProject.id ? { ...project, chats: [projectChat, ...(project.chats || [])] } : project)); setConversations((current) => { const next = current.filter((item) => item.id !== conversationId); if (user?.is_demo) writeDemoConversations(next); return next; }); setProjectManageOpen(false); setProjectNotice(`Moved “${conversation.title}” into ${activeProject.name}.`); };
  const addProjectFiles = async (fileList) => {
    const selectedFiles = Array.from(fileList || []).slice(0, PROJECT_FILE_LIMIT);
    if (!selectedFiles.length || !activeProjectId || !activeProject) return;
    const available = Math.max(0, PROJECT_FILE_LIMIT - (activeProject.files || []).length);
    const dailyAvailable = hasUnlimitedAccess || promoCheckedUserId !== user?.id ? UNLIMITED_LIMIT : Math.max(0, FREE_DAILY_UPLOAD_LIMIT - dailyUsage.uploads);
    const storageUsed = projects.flatMap((project) => project.files || []).reduce((total, file) => total + Number(file.size || file.originalSize || 0), 0) + libraryLocalFiles.reduce((total, file) => total + Number(file.size || 0), 0);
    let remainingStorage = hasUnlimitedAccess || promoCheckedUserId !== user?.id ? UNLIMITED_LIMIT : Math.max(0, USER_STORAGE_LIMIT_BYTES - storageUsed);
    const acceptedFiles = selectedFiles.slice(0, Math.min(available, dailyAvailable)).filter((file) => { if (file.size > remainingStorage) return false; remainingStorage -= file.size; return true; });
    if (!acceptedFiles.length) { setProjectError(storageUsed >= USER_STORAGE_LIMIT_BYTES ? "Your 250 MB storage is full. Remove files before uploading more." : dailyAvailable ? `A project can contain up to ${PROJECT_FILE_LIMIT} files.` : "Your 3 daily uploads are used. Try again after midnight UTC."); return; }
    const savedFiles = [];
    try {
      for (const sourceFile of acceptedFiles) {
        if (sourceFile.size > PROJECT_FILE_MAX_BYTES) throw new Error(`${sourceFile.name} is larger than 25 MB.`);
        const { file, compression } = await compressProjectFile(sourceFile);
        const fileRecord = { id: crypto.randomUUID(), name: sourceFile.name, type: sourceFile.type || "application/octet-stream", size: file.size, originalSize: sourceFile.size, compression };
        if (user.is_demo) {
          fileRecord.source = await extractAttachment(sourceFile, PROJECT_FILE_MAX_BYTES);
          savedFiles.push(fileRecord);
          continue;
        }
        const storagePath = `${user.id}/${activeProject.id}/${fileRecord.id}-${safeProjectFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { data, error: recordError } = await supabase.from("project_files").insert({ id: fileRecord.id, project_id: activeProject.id, storage_path: storagePath, name: sourceFile.name, mime_type: sourceFile.type || "application/octet-stream", original_size: sourceFile.size, compressed_size: file.size, compression }).select().single();
        if (recordError || !data) {
          await supabase.storage.from("project-files").remove([storagePath]);
          throw new Error(recordError?.message?.includes("DAILY_UPLOAD_LIMIT") ? "Your 3 daily uploads are used. Try again after midnight UTC." : "Couldn’t save file details.");
        }
        savedFiles.push({ ...fileRecord, id: data.id, path: storagePath });
      }
      setProjectNotice(`${savedFiles.length} file${savedFiles.length === 1 ? "" : "s"} saved.`);
    } catch (fileError) { setProjectError(fileError.message || "Couldn’t save those files."); }
    finally {
      if (savedFiles.length) {
        persistProjects((current) => current.map((project) => project.id === activeProjectId ? { ...project, files: [...(project.files || []), ...savedFiles] } : project));
        recordUsage("uploads", savedFiles.length);
      }
    }
  };
  const openProjectChat = (chatId) => { setActiveProjectChatId(chatId); setProjectDraft(""); setProjectError(""); setWorkspaceView("project-chat"); };
  const sendProjectMessage = async () => {
    const content = projectDraft.trim();
    if (!content || !activeProject || projectSendLock.current) return;
    if (user?.is_demo) { setProjectError("Sign in to send messages. Live AI is unavailable in the local demo."); return; }
    if (promoCheckedUserId === user?.id && !hasUnlimitedAccess && dailyUsage.messages >= FREE_DAILY_MESSAGE_LIMIT) { setProjectError("You’ve used your 100 messages for today. Your allowance resets at midnight UTC."); return; }
    projectSendLock.current = true;
    setProjectSending(true);
    const projectId = activeProject.id;
    const existingChat = (activeProject.chats || []).find((chat) => chat.id === activeProjectChatId);
    let chatId = existingChat?.id;
    if (!chatId) {
      const { data, error: chatError } = await supabase.from("project_chats").insert({ project_id: projectId, title: makeConversationTitle(content, "New project chat") }).select().single();
      if (chatError || !data) { setProjectError("Couldn’t save this project chat."); projectSendLock.current = false; setProjectSending(false); return; }
      chatId = data.id;
    }
    const previousMessages = existingChat?.messages || [];
    const saveCloudMessage = async (message) => {
      const { data, error } = await supabase.from("project_messages").insert({ project_chat_id: chatId, role: message.role, content: message.content, attachments: serializeAttachments(message.attachments) }).select().single();
      if (error || !data) throw new Error("Couldn’t save this project message.");
      return { ...data, attachments: restoreAttachments(data.attachments) };
    };
    const updateChat = (nextMessages) => persistProjects((current) => current.map((project) => {
      if (project.id !== projectId) return project;
      const prior = (project.chats || []).find((chat) => chat.id === chatId);
      const nextChat = { ...prior, id: chatId, title: prior?.title || makeConversationTitle(content, "New project chat"), messages: nextMessages, updated_at: new Date().toISOString() };
      return { ...project, chats: [nextChat, ...(project.chats || []).filter((chat) => chat.id !== chatId)] };
    }));
    let withUserMessage;
    try {
      const saved = await saveCloudMessage({ role: "user", content });
      withUserMessage = [...previousMessages, saved];
    } catch (saveError) { setProjectError(saveError.message); projectSendLock.current = false; setProjectSending(false); return; }
    updateChat(withUserMessage);
    setActiveProjectChatId(chatId); setWorkspaceView("project-chat"); setProjectDraft(""); setProjectError("");
    let responseText = "";
    const started = performance.now();
    try {
      const sources = await loadProjectSources(activeProject, supabase, false);
      const userMessage = { ...withUserMessage[withUserMessage.length - 1], content: `You are helping with the project “${activeProject.name}”.\n${content}` };
      const transcript = [...withUserMessage.slice(0, -1), userMessage];
      responseText = await requestChat({ client: supabase, user, messages: buildChatMessages(transcript, sources), model: selectedModel, preferences: { ...accountSettings, response_streaming: false }, memories: memories.map((memory) => memory.content), onUsage: setDailyUsage });
      if (accountSettings.developer_mode) {
        const seconds = Math.max(.1, (performance.now() - started) / 1000);
        const tokens = Math.max(1, Math.round(responseText.length / 4));
        responseText += `\n\n---\n*Developer: ~${tokens} output tokens · ${seconds.toFixed(1)}s · ~${Math.round(tokens / seconds)} tokens/s*`;
      }
      const saved = await saveCloudMessage({ role: "assistant", content: responseText });
      updateChat([...withUserMessage, saved]);
    } catch (requestError) {
      setProjectError(requestError.message || "Jan couldn’t respond in this project. Please try again.");
    } finally { projectSendLock.current = false; setProjectSending(false); void refreshUsage(); }
  };
  const renameConversation = async (convId, currentTitle, requestedTitle) => {
    if (requestedTitle === undefined) { setConversationMenuId(null); setRenameTarget({ id: convId, title: currentTitle }); return; }
    const nextTitle = requestedTitle.trim();
    setRenameTarget(null);
    if (!nextTitle || nextTitle === currentTitle) return;
    if (user?.is_demo) {
      setConversations((previous) => {
        const next = previous.map((conversation) => conversation.id === convId ? { ...conversation, title: nextTitle } : conversation);
        writeDemoConversations(next);
        return next;
      });
    } else {
      const { error: renameError } = await supabase.from("conversations").update({ title: nextTitle }).eq("id", convId);
      if (renameError) { setError("Couldn’t rename this conversation. Please try again."); return; }
      setConversations((previous) => previous.map((conversation) => conversation.id === convId ? { ...conversation, title: nextTitle } : conversation));
    }
  };
  const commitTitleEdit = () => {
    if (skipTitleBlurRef.current) { skipTitleBlurRef.current = false; return; }
    setEditingTitle(false);
    const conversation = conversations.find((item) => item.id === activeConversationId);
    if (conversation && titleDraft.trim() && titleDraft.trim() !== conversation.title) {
      void renameConversation(conversation.id, conversation.title, titleDraft);
    }
  };
  const tryFullChatSearch = async (searchText = chatSearchQuery) => {
    const query = (typeof searchText === "string" ? searchText : chatSearchQuery).trim().toLowerCase();
    if (!query) return;
    const run = ++searchRunRef.current;
    setFullSearchStatus("loading");
    try {
      let matches = [];
      if (user?.is_demo) {
        matches = conversations.flatMap((conversation) => readDemoMessages(conversation.id)
          .filter((message) => message.content?.toLowerCase().includes(query))
          .slice(0, 1)
          .map((message) => ({ ...conversation, match: message.content })));
      } else if (conversations.length) {
        const { data, error: searchError } = await supabase.from("messages").select("conversation_id, content").in("conversation_id", conversations.map((conversation) => conversation.id)).ilike("content", `%${searchText.trim()}%`);
        if (searchError) throw searchError;
        const seen = new Set();
        matches = (data || []).flatMap((message) => {
          if (seen.has(message.conversation_id)) return [];
          const conversation = conversations.find((item) => item.id === message.conversation_id);
          if (!conversation) return [];
          seen.add(message.conversation_id);
          return [{ ...conversation, match: message.content }];
        });
      }
      if (run === searchRunRef.current) { setFullSearchResults(matches); setFullSearchStatus("complete"); }
    } catch {
      if (run === searchRunRef.current) setFullSearchStatus("error");
    }
  };
  useEffect(() => {
    searchRunRef.current += 1;
    setFullSearchResults([]);
    setFullSearchStatus("idle");
    if (!chatSearchOpen || !chatSearchQuery.trim()) return;
    const timer = window.setTimeout(() => { void tryFullChatSearch(chatSearchQuery); }, 350);
    return () => window.clearTimeout(timer);
  }, [chatSearchOpen, chatSearchQuery, conversations, user]);
  const copyMessage = async (content, index) => { await navigator.clipboard.writeText(content); setCopiedMessage(index); window.setTimeout(() => setCopiedMessage(null), 1800); };
  const editAndResend = (content) => { setDraft(content); window.requestAnimationFrame(() => textareaRef.current?.focus()); };
  const regenerateResponse = () => {
    if (loading) return;
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (lastUserMessage?.content) void send(lastUserMessage.content, { reuseLastUser: true });
  };

  const MODEL_DISPLAY = {
    "openai/gpt-oss-20b": { name: "GPT‑OSS 20B", badge: "Recommended", description: "Fast and capable for everyday tasks" },
    "openai/gpt-oss-120b": { name: "GPT‑OSS 120B", badge: "Best quality", description: "For complex analysis and deeper reasoning" },
    "qwen/qwen3.6-27b": { name: "Qwen 3.6 27B", badge: "Reasoning", description: "Thoughtful answers for detailed work" },
    "qwen/qwen3.8-27b": { name: "Qwen 3.8 27B", badge: "Images", description: "Use photos and visual questions" },
  };

  const addFiles = async (filesToAdd) => {
    const files = Array.from(filesToAdd || []).slice(0, Math.max(0, Math.min(MAX_ATTACHMENTS - attachments.length, hasUnlimitedAccess || promoCheckedUserId !== user?.id ? UNLIMITED_LIMIT : FREE_DAILY_UPLOAD_LIMIT - dailyUsage.uploads - attachments.length)));
    if (!files.length) {
      setAttachmentError(`You can add up to ${MAX_ATTACHMENTS} files to one message.`);
      return;
    }
    if (promoCheckedUserId === user?.id && !hasUnlimitedAccess && dailyUsage.uploads >= FREE_DAILY_UPLOAD_LIMIT) { setAttachmentError(`You’ve used your ${FREE_DAILY_UPLOAD_LIMIT} free uploads for today. Please come back tomorrow.`); return; }
    setAttachmentError("");
    setAttachmentNotice("");
    const results = await Promise.allSettled(files.map(extractAttachment));
    const prepared = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const firstFailure = results.find((result) => result.status === "rejected");
    const availableImageSlots = Math.max(0, MAX_IMAGES_PER_MESSAGE - attachments.filter((attachment) => attachment.vision).length);
    const limited = prepared.filter((attachment, index) => !attachment.vision || prepared.filter((candidate, candidateIndex) => candidateIndex <= index && candidate.vision).length <= availableImageSlots);
    if (limited.length) setAttachments((previous) => [...previous, ...limited].slice(0, MAX_ATTACHMENTS));
    if (limited.some((attachment) => attachment.vision)) {
      setSelectedModel(VISION_MODEL);
      setAttachmentNotice("Photos are sent to Qwen 3.8 Vision for image analysis.");
    }
    if (firstFailure) setAttachmentError(firstFailure.reason?.message || "One of those files could not be added.");
    else if (limited.length !== prepared.length) setAttachmentError(`You can send up to ${MAX_IMAGES_PER_MESSAGE} photos in one message.`);
  };

  const handleFileSelect = async (event) => {
    await addFiles(event.target.files);
    event.target.value = "";
  };

  const handleFileDrop = async (event) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    await addFiles(event.dataTransfer.files);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => {
      const attachment = prev[index];
      if (attachment?.preview?.startsWith("blob:")) URL.revokeObjectURL(attachment.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const signOut = async () => { cancelChatRequest(); if (user?.id) window.localStorage.removeItem(connectedAppsCacheKey(user.id)); if (user?.is_demo) { window.localStorage.removeItem(DEMO_USER_KEY); window.dispatchEvent(new CustomEvent("jan:demo-auth")); } else { await supabase.auth.signOut(); } setConnectorConnections([]); setConversations([]); setActiveConversationId(null); setMessages([]); navigate("/"); };
  const openSettings = () => { settingsReturnPathRef.current = /^\/settings\//i.test(path) ? "/chat" : path; setSettingsSection("General"); setSettingsOpen(true); navigate("/settings/general"); };
  const closeSettings = () => { setSettingsOpen(false); navigate(settingsReturnPathRef.current || "/chat"); };

  const togglePin = useCallback((convId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId];
      window.localStorage.setItem(`jan-pinned-${user?.id || user?.email || "guest"}`, JSON.stringify(next));
      return next;
    });
  }, [user]);

  const pinnedConversations = conversations.filter((c) => pinnedIds.includes(c.id));
  const unpinnedConversations = conversations.filter((c) => !pinnedIds.includes(c.id));
  const recentsByDate = groupChatsByDate(unpinnedConversations);
  const recentFlyoutGroups = groupChatsByDate(unpinnedConversations.slice(0, 10));
  const activeProjectForScroll = projects.find((project) => project.id === activeProjectId) || projects[0];
  const activeProjectChatForScroll = activeProjectForScroll?.chats?.find((chat) => chat.id === activeProjectChatId);
  useEffect(() => {
    if (workspaceView !== "project-chat") return;
    const scrollProjectChat = () => document.querySelector(".project-chat-thread")?.closest(".chat-scroll")?.scrollTo({ top: document.querySelector(".project-chat-thread")?.closest(".chat-scroll")?.scrollHeight || 0, behavior: "smooth" });
    const frame = window.requestAnimationFrame(scrollProjectChat);
    return () => window.cancelAnimationFrame(frame);
  }, [workspaceView, activeProjectChatForScroll?.messages?.length, projectSending]);

  if (authLoading) return null;
  if (!user) return <><Header /><main className="chat-gate"><div><img src="/assets/logo-jan.svg" alt="" /><span>YOUR PRIVATE WORKSPACE</span><h1>Talk to Jan</h1><p>Create an account or log in to open your AI workspace.</p><div><button type="button" onClick={() => requestAuth("signup")}>Sign up free <FiArrowRight /></button><button type="button" onClick={() => requestAuth("login")}>Log in</button></div></div></main></>;

  const userDisplayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "You";
  const conversationTitle = conversations.find((conversation) => conversation.id === activeConversationId)?.title || "New conversation";
  const connectionLabel = connection === "ready" ? "Connected" : connection === "missing" ? "Setup needed" : "Connecting";
  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const activeProjectChat = activeProject?.chats?.find((chat) => chat.id === activeProjectChatId);
  const workspaceHasMessages = workspaceView === "project-chat" ? Boolean(activeProjectChat?.messages?.length) : messages.length > 0;
  const projectChats = (() => {
    if (activeProject?.chats?.length) return activeProject.chats.map((chat) => {
      const latestAssistant = [...(chat.messages || [])].reverse().find((message) => message.role === "assistant");
      const firstUser = (chat.messages || []).find((message) => message.role === "user");
      return { id: chat.id, title: chat.title || makeConversationTitle(firstUser?.content, "New project chat"), preview: latestAssistant?.content || "Waiting for Jan’s response…", updated_at: chat.updated_at || chat.created_at };
    });
    const projectMessages = activeProject?.messages || [];
    return projectMessages.filter((message) => message.role === "user").map((message, index) => {
      const messageIndex = projectMessages.indexOf(message);
      const reply = projectMessages.slice(messageIndex + 1).find((item) => item.role === "assistant");
      return { id: message.id || `${messageIndex}`, title: makeConversationTitle(message.content, "New project chat"), preview: reply?.content || "Waiting for Jan’s response…", updated_at: message.created_at };
    });
  })();
  const connectorIcons = { gmail: [SiGmail, "gmail"], github: [FaGithub, "github"], googledrive: [FaGoogleDrive, "drive"], google_drive: [FaGoogleDrive, "drive"], drive: [FaGoogleDrive, "drive"], outlook: [FiMail, "outlook"], canva: [SiCanva, "canva"] };
  const featuredPlugins = [
    { id: "gmail", name: "Gmail", copy: "Search your mailbox and read messages you choose.", available: true },
    { id: "github", name: "GitHub", copy: "Find repositories, issues, pull requests, and build checks.", available: true },
    { id: "vercel", name: "Vercel", copy: "Inspect your projects and deployments.", available: true },
    { id: "googledrive", name: "Google Drive", copy: "Find and read files you choose to share.", available: true },
    { id: "slack", name: "Slack", copy: "Search conversations and read workspace messages.", available: true },
    { id: "notion", name: "Notion", copy: "Search and read pages in your workspace.", available: true },
    { id: "outlook", name: "Outlook", copy: "Search and read mail from your account.", available: true },
  ].map((plugin) => ({ ...plugin, icon: connectorIcons[plugin.id]?.[0] || FiBox, tone: connectorIcons[plugin.id]?.[1] || "generic" }));
  const plugins = [...new Map([...featuredPlugins, ...connectorCatalog.map((connector) => ({ id: connector.slug, name: connector.name, copy: connector.description, available: connector.available, logo: connector.logo, icon: connectorIcons[String(connector.slug).toLowerCase()]?.[0] || FiBox, tone: connectorIcons[String(connector.slug).toLowerCase()]?.[1] || "generic" })), { id: "higgsfield", name: "Higgsfield", copy: "AI video and image generation", available: false, icon: FiBox, tone: "generic" }].map((plugin) => [String(plugin.id).toLowerCase(), plugin])).values()];
  const appProgress = connectedAppProgress(plugins, connectorConnections);
  const visiblePlugins = plugins.filter((plugin) => `${plugin.name} ${plugin.copy} ${plugin.id}`.toLowerCase().includes(pluginCatalogSearch.trim().toLowerCase())).sort((a, b) => ({ gmail: 0, github: 1, vercel: 2 }[a.id] ?? 10) - ({ gmail: 0, github: 1, vercel: 2 }[b.id] ?? 10));
  const renderPluginCards = (items) => items.map((plugin) => { const Icon = plugin.icon; const href = `/plugin/${encodeURIComponent(user.id || user.email)}/${encodeURIComponent(plugin.id)}`; const connected = isAppConnected(plugin.id, connectorConnections); return <article className="plugin-catalog-row" key={plugin.id}><button type="button" className={`plugin-icon plugin-${plugin.tone}`} onClick={() => navigate(href)} aria-label={`Open ${plugin.name}`}>{plugin.logo ? <img src={plugin.logo} alt="" /> : <Icon />}</button><button type="button" className="plugin-catalog-copy" onClick={() => navigate(href)}><strong>{plugin.name}</strong><small>{plugin.copy}</small></button><div className="plugin-catalog-action-wrap">{connected ? <><button type="button" className="plugin-catalog-add is-connected" onClick={() => setCatalogMenuId((current) => current === plugin.id ? null : plugin.id)} aria-label={`${plugin.name} options`} aria-expanded={catalogMenuId === plugin.id} aria-haspopup="menu"><FiMoreHorizontal /></button>{catalogMenuId === plugin.id && <div className="plugin-catalog-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setCatalogMenuId(null); navigate(href); }}>View details</button><button type="button" role="menuitem" onClick={() => { setCatalogMenuId(null); startPluginChat(`Help me use ${plugin.name}.`); }}>Try in chat</button></div>}</> : <button type="button" className="plugin-catalog-add" onClick={() => navigate(href)} aria-label={`Connect ${plugin.name}`}><FiPlus /></button>}</div></article>; });
  const selectedPlugin = connectorDetail?.connector || plugins.find((plugin) => plugin.id === connectorSlug);
  const selectedPluginIcon = connectorIcons[connectorSlug]?.[0] || FiBox;
  const selectedPluginTone = connectorIcons[connectorSlug]?.[1] || "generic";
  const pluginTryPrompt = `Help me use ${selectedPlugin?.name || "this app"} and tell me what you can do with it.`;
  const pluginSuggestions = connectorSlug === "vercel" ? ["Audit this repo for deployment risks", "Which Vercel tools fit this app best?", "Help wire Vercel into this workflow"] : [`Show me what I can do with ${selectedPlugin?.name || "this app"}`, `Help me find something in ${selectedPlugin?.name || "this app"}`, `Summarize my recent ${selectedPlugin?.name || "app"} activity`];
  const startPluginChat = (prompt) => { newConversation(); setWorkspaceView("chat"); setSidebarCollapsed(false); setSidebarOpen(true); setDraft(prompt); };
  const copyPluginLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setConnectorNotice("Plugin link copied."); } catch { setConnectorError("Couldn’t copy the link. You can copy it from your browser’s address bar."); } };
  const libraryBasePath = `/library_${encodeURIComponent(user.id || user.email)}`;
  const storageUsageBytes = projects.flatMap((project) => project.files || []).reduce((total, file) => total + Number(file.size || file.originalSize || 0), 0) + libraryLocalFiles.reduce((total, file) => total + Number(file.size || 0), 0);
  const projectLibraryFiles = projects.flatMap((project) => (project.files || []).map((file) => ({ ...file, preview: file.preview || file.source?.preview || file.source?.dataUrl, content: file.content || file.source?.content, id: `project-${project.id}-${file.id}`, created_at: file.created_at || project.updated_at || project.created_at, origin: project.name, source: "project" })));
  const allLibraryFiles = [...libraryLocalFiles, ...libraryMessageFiles, ...projectLibraryFiles].filter((file, index, files) => files.findIndex((item) => item.id === file.id) === index).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const favoriteLibraryIds = (() => { try { return JSON.parse(window.localStorage.getItem(`jan-library-favorites-${user.id || user.email}`) || "[]"); } catch { return []; } })();
  const visibleLibraryFiles = allLibraryFiles.filter((file) => {
    const isImage = isImageFile(file);
    if (libraryFilter === "favorites" && !favoriteLibraryIds.includes(file.id)) return false;
    if (libraryFilter === "projects" && file.source !== "project") return false;
    if (libraryFilter === "images" && !isImage) return false;
    return `${file.name} ${file.origin || ""}`.toLowerCase().includes(libraryQuery.trim().toLowerCase());
  }).slice(0, libraryFilter === "suggested" ? 20 : undefined);
  const persistLibraryFiles = (next) => {
    setLibraryLocalFiles(next);
    window.localStorage.setItem(`jan-library-files-${user.id || user.email}`, JSON.stringify(next));
  };
  const addLibraryFiles = async (fileList) => {
    const selected = Array.from(fileList || []).slice(0, MAX_ATTACHMENTS);
    if (!selected.length) return;
    const storageUsed = projects.flatMap((project) => project.files || []).reduce((total, file) => total + Number(file.size || file.originalSize || 0), 0) + libraryLocalFiles.reduce((total, file) => total + Number(file.size || 0), 0);
    if (promoCheckedUserId === user?.id && !hasUnlimitedAccess && storageUsed >= USER_STORAGE_LIMIT_BYTES) { setPersistenceNotice("Your 250 MB storage is full. Remove files before uploading more."); return; }
    const saved = [];
    let remainingStorage = hasUnlimitedAccess || promoCheckedUserId !== user?.id ? UNLIMITED_LIMIT : USER_STORAGE_LIMIT_BYTES - storageUsed;
    for (const file of selected) {
      try {
        if (file.size > remainingStorage) throw new Error("This upload would exceed your 250 MB storage limit.");
        const extracted = await extractAttachment(file);
        remainingStorage -= extracted.size;
        saved.push({ ...serializeAttachments([extracted])[0], id: `library-${globalThis.crypto?.randomUUID?.() || Date.now()}`, created_at: new Date().toISOString(), origin: "Library", source: "library" });
      } catch (uploadError) { setPersistenceNotice(uploadError.message || `Couldn’t add ${file.name}.`); }
    }
    if (saved.length) { persistLibraryFiles([...saved, ...libraryLocalFiles]); setPersistenceNotice(""); }
  };
  const toggleLibraryFavorite = (fileId) => {
    const next = favoriteLibraryIds.includes(fileId) ? favoriteLibraryIds.filter((id) => id !== fileId) : [...favoriteLibraryIds, fileId];
    window.localStorage.setItem(`jan-library-favorites-${user.id || user.email}`, JSON.stringify(next));
    setLibraryMenuId(null);
    setLibraryLocalFiles((current) => [...current]);
  };
  const openLibraryFile = async (file) => {
    if (file.preview || file.dataUrl || file.content) { setLibraryPreview(file); setLibraryMenuId(null); navigate(`${libraryBasePath}/file/${encodeURIComponent(file.id)}`); return; }
    if (file.source === "project" && file.path && !user.is_demo) {
      const { data, error: downloadError } = await supabase.storage.from("project-files").download(file.path);
      if (!downloadError && data) { const url = URL.createObjectURL(data); window.open(url, "_blank", "noopener,noreferrer"); window.setTimeout(() => URL.revokeObjectURL(url), 60000); return; }
    }
    setLibraryPreview(file);
    setLibraryMenuId(null);
    navigate(`${libraryBasePath}/file/${encodeURIComponent(file.id)}`);
  };
  const matchingConversations = conversations.filter((conversation) => conversation.title.toLowerCase().includes(chatSearchQuery.trim().toLowerCase()));
  const titleMatchIds = new Set(matchingConversations.map((conversation) => conversation.id));
  const displayedSearchResults = [...matchingConversations, ...fullSearchResults.filter((conversation) => !titleMatchIds.has(conversation.id))];

  return <main className={`chat-page ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${workspaceView === "library" ? "library-view" : ""} ${["hub", "plugin-detail"].includes(workspaceView) ? "plugin-workspace" : ""}`}>
    <button className="chat-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
    {projectCreateOpen && <div className="project-create-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setProjectCreateOpen(false)}><form className="project-create-dialog" onSubmit={(event) => { event.preventDefault(); confirmCreateProject(); }} role="dialog" aria-modal="true" aria-labelledby="project-create-title"><button type="button" className="project-create-close" onClick={() => setProjectCreateOpen(false)} aria-label="Close new project dialog"><FiX /></button><p>NEW PROJECT</p><h2 id="project-create-title">Name your project</h2><span>Keep conversations and files together in one focused space.</span><label><span className="sr-only">Project name</span><input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Launch plan" maxLength="80" /></label><button type="submit" disabled={!projectName.trim()}>Create project <FiArrowRight /></button></form></div>}
    {projectManageOpen && activeProject && <ProjectManageModal project={activeProject} conversations={conversations} onClose={() => setProjectManageOpen(false)} onRenameProject={renameProject} onDeleteProject={deleteProject} onRenameChat={renameProjectChat} onDeleteChat={deleteProjectChat} onMoveConversation={moveConversationToProject} />}
    {renameTarget && <RenameConversationDialog conversation={renameTarget} onClose={() => setRenameTarget(null)} onSave={(title) => renameConversation(renameTarget.id, renameTarget.title, title)} />}
    {settingsOpen && <SettingsModalV2 user={user} userDisplayName={userDisplayName} usage={dailyUsage} settings={accountSettings} memories={memories} memoryLimit={MAX_USER_MEMORIES} storageUsageBytes={storageUsageBytes} storageLimitBytes={USER_STORAGE_LIMIT_BYTES} promoCode={promoCode} onApplyPromoCode={applyPromoCode} initialSection={settingsSection} onSectionChange={(slug) => navigate(`/settings/${slug}`)} onAddMemory={addMemory} onUpdateMemory={updateMemory} onDeleteMemory={deleteMemory} onSettingsChange={saveAccountSettings} onChangePassword={changePassword} onClose={closeSettings} onSignOut={signOut} />}
    {libraryPreview && <div className="library-preview-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setLibraryPreview(null); navigate(libraryBasePath); } }}><section className="library-preview-dialog" role="dialog" aria-modal="true" aria-label={libraryPreview.name}><header><div><strong>{libraryPreview.name}</strong><span>{libraryPreview.origin || "Library"}</span></div><button type="button" onClick={() => { setLibraryPreview(null); navigate(libraryBasePath); }} aria-label="Close file preview"><FiX /></button></header>{isImageFile(libraryPreview) && (libraryPreview.preview || libraryPreview.dataUrl) ? <img src={libraryPreview.preview || libraryPreview.dataUrl} alt={libraryPreview.name} /> : <pre>{libraryPreview.content || "A preview is not available for this older upload. The file is still listed in your library."}</pre>}</section></div>}
    <aside className="chat-sidebar">
      <nav className="chat-icon-rail" aria-label="Primary navigation">
        <button type="button" className={`chat-rail-button ${workspaceView === "chat" ? "active" : ""}`} data-tooltip="Home" aria-label="Home" onClick={() => { setWorkspaceView("chat"); setSidebarCollapsed(false); setSidebarOpen(true); navigate(activeConversationId ? chatUrl(conversations.find((conversation) => conversation.id === activeConversationId), user) : "/chat"); }}><FiHome /></button>
        <button type="button" className={`chat-rail-button ${workspaceView === "assistant" ? "active" : ""}`} data-tooltip="Personal assistant" aria-label="Personal assistant" onClick={() => void openPersonalAssistant()}><LuBot /></button>
        <button type="button" className={`chat-rail-button ${workspaceView === "library" ? "active" : ""}`} data-tooltip="Files" aria-label="Files" onClick={() => { setWorkspaceView("library"); setSidebarCollapsed(true); setSidebarOpen(false); navigate(`/library_${encodeURIComponent(user.id || user.email)}`); }}><FiImage /></button>
        <button type="button" className={`chat-rail-button ${workspaceView === "hub" ? "active" : ""}`} data-tooltip="Plugins" aria-label="Plugins" onClick={() => { setWorkspaceView("hub"); setSidebarCollapsed(true); setSidebarOpen(false); navigate(`/plugins_${encodeURIComponent(user.id || user.email)}`); }}><FiBox /></button>
        <span className="chat-rail-spacer" />
        <button type="button" className="chat-rail-avatar" data-tooltip="Account" aria-label="Open account settings" onClick={openSettings}>{userDisplayName.charAt(0).toUpperCase()}</button>
      </nav>
      <div className="chat-sidebar-panel" inert={sidebarCollapsed ? true : undefined} aria-hidden={sidebarCollapsed || undefined}>
        <div className="chat-sidebar-brand"><strong>Jan</strong><div className="chat-sidebar-brand-actions"><button className="chat-sidebar-search" type="button" onClick={() => setChatSearchOpen(true)} aria-label="Search chats"><FiSearch /></button><button className="chat-sidebar-notifications" type="button" aria-label="Notifications"><FiBell /></button><button className="chat-sidebar-collapse" type="button" onClick={() => { setSidebarCollapsed(true); setSidebarOpen(false); }} aria-label="Collapse sidebar"><FiChevronLeft /></button></div></div>
        <button className="new-chat" type="button" onClick={() => { setWorkspaceView("chat"); newConversation(); }}><FiEdit2 /><span>New chat</span><kbd>Ctrl N</kbd></button>
        <nav className="chat-sidebar-lists" aria-label="Chats and projects">
          {pinnedConversations.length > 0 && <section className="chat-sidebar-group"><SidebarSectionHeader expanded={sidebarSections.pinned} onToggle={() => setSidebarSections((current) => ({ ...current, pinned: !current.pinned }))}>Pinned</SidebarSectionHeader>{sidebarSections.pinned && pinnedConversations.map((conv) => <SidebarConversation key={conv.id} conversation={conv} active={workspaceView === "chat" && conv.id === activeConversationId} pinned menuOpen={conversationMenuId === conv.id} onOpen={() => { setWorkspaceView("chat"); switchConversation(conv.id); }} onMenu={() => setConversationMenuId((current) => current === conv.id ? null : conv.id)} onRename={() => renameConversation(conv.id, conv.title)} onPin={() => togglePin(conv.id)} onDelete={() => deleteConversation(conv.id)} />)}</section>}
          <section className="chat-sidebar-group"><SidebarSectionHeader expanded={sidebarSections.projects} onToggle={() => setSidebarSections((current) => ({ ...current, projects: !current.projects }))}>Projects</SidebarSectionHeader>{sidebarSections.projects && (projects.length ? projects.map((project) => <button type="button" className={`chat-project-link ${workspaceView === "project" && activeProject?.id === project.id ? "active" : ""}`} key={project.id} onClick={() => openProject(project.id)}><FiFolder style={{ color: projectColor(project.id) }} /><span><strong>{project.name}</strong></span></button>) : <p className="chat-sidebar-empty">No projects yet</p>)}</section>
          <section className="chat-sidebar-group"><SidebarSectionHeader expanded={sidebarSections.chats} onToggle={() => setSidebarSections((current) => ({ ...current, chats: !current.chats }))}>Chats</SidebarSectionHeader>{sidebarSections.chats && recentsByDate.map(([label, items]) => <div className="chat-date-group" key={label}><span className="chat-date-label">{label}</span>{items.map((conv) => <SidebarConversation key={conv.id} conversation={conv} active={workspaceView === "chat" && conv.id === activeConversationId} pinned={false} menuOpen={conversationMenuId === conv.id} onOpen={() => { setWorkspaceView("chat"); switchConversation(conv.id); }} onMenu={() => setConversationMenuId((current) => current === conv.id ? null : conv.id)} onRename={() => renameConversation(conv.id, conv.title)} onPin={() => togglePin(conv.id)} onDelete={() => deleteConversation(conv.id)} />)}</div>)}</section>
        </nav>
      </div>
    </aside>
    <section className={`chat-workspace ${workspaceHasMessages ? "chat-workspace-thread" : "chat-workspace-empty"}`}>
      <header className="chat-topbar"><div className="chat-topbar-title"><button className="chat-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><FiMenu /></button>{(["chat", "assistant", "project-chat"].includes(workspaceView)) && <div>{workspaceView === "chat" && activeConversationId ? editingTitle ? <input className="chat-title-input" autoFocus value={titleDraft} maxLength={120} aria-label="Chat title" onChange={(event) => setTitleDraft(event.target.value)} onBlur={commitTitleEdit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { skipTitleBlurRef.current = true; event.currentTarget.blur(); setEditingTitle(false); } }} /> : <button type="button" className="chat-title-button" title="Rename chat" aria-label={`Rename ${conversationTitle}`} onClick={() => { skipTitleBlurRef.current = false; setTitleDraft(conversationTitle); setEditingTitle(true); }}><strong>{conversationTitle}</strong><FiEdit2 aria-hidden="true" /></button> : <strong>{workspaceView === "assistant" ? "Personal Assistant" : workspaceView === "project-chat" ? activeProjectChat?.title || "Project chat" : conversationTitle}</strong>}<small>{workspaceView === "assistant" ? "Your continuous private conversation" : workspaceView === "project-chat" ? activeProject?.name : "Saved automatically"}</small></div>}</div><div className="chat-topbar-actions"><span className={`chat-header-connection connection-${connection}`}><i />{connectionLabel}</span></div></header>
      {chatSearchOpen && <div className="chat-search-overlay" role="dialog" aria-modal="true" aria-label="Search chats"><div className="chat-search-panel"><div className="chat-search-input"><FiSearch /><input autoFocus value={chatSearchQuery} onChange={(event) => setChatSearchQuery(event.target.value)} placeholder="Search chats" aria-label="Search chats" /><button type="button" onClick={() => { setChatSearchOpen(false); setChatSearchQuery(""); }} aria-label="Close chat search"><FiX /></button></div><p>{fullSearchStatus === "complete" && !matchingConversations.length ? "FULL SEARCH" : "CHATS"}</p>{displayedSearchResults.length ? <div className="chat-search-results">{displayedSearchResults.map((conversation) => <button type="button" key={conversation.id} onClick={() => { setWorkspaceView("chat"); switchConversation(conversation.id); setChatSearchOpen(false); setChatSearchQuery(""); }}><FiMessageCircle /><span><strong>{conversation.title}</strong>{conversation.match && <small className="chat-search-snippet">{conversation.match}</small>}</span><small>{new Date(conversation.updated_at).toLocaleDateString()}</small></button>)}</div> : chatSearchQuery.trim() ? <div className="chat-search-empty">{fullSearchStatus === "loading" ? "Searching every conversation…" : fullSearchStatus === "complete" ? "No matches in your conversations." : fullSearchStatus === "error" ? "Full search is unavailable. Try again." : <><span>No chat titles match “{chatSearchQuery.trim()}”.</span><button type="button" onClick={tryFullChatSearch}>Try full search</button><small>Search for this word in every conversation.</small></>}</div> : <div className="chat-search-empty">Start typing to search your chats.</div>}</div></div>}
      {workspaceView === "hub" || workspaceView === "plugin-detail" ? <section className="plugin-manager">
        <aside className="plugin-manager-nav" aria-label="Customize">
          <header><strong>Customize</strong><button type="button" aria-label="Focus app search" onClick={() => document.querySelector(".plugin-manager-search input")?.focus()}><FiSearch /></button></header>
          <nav className="plugin-manager-sections"><button type="button" className={hubSection === "plugins" ? "active" : ""} onClick={() => setHubSection("plugins")}><FiBox />Plugins</button><button type="button" className={hubSection === "skills" ? "active" : ""} onClick={() => setHubSection("skills")}><FiCpu />Skills</button></nav>
          <h2>Installed</h2>
          <label className="plugin-manager-search"><FiSearch /><input value={connectedAppSearch} onChange={(event) => setConnectedAppSearch(event.target.value)} placeholder="Search apps" aria-label="Search connected apps" /></label>
          <nav className="plugin-manager-apps" aria-label="Connected apps">{connectorConnections.filter((app) => `${app.name} ${app.slug}`.toLowerCase().includes(connectedAppSearch.trim().toLowerCase())).map((app) => { const plugin = plugins.find((item) => item.id.toLowerCase() === app.slug.toLowerCase()) || { id: app.slug, name: app.name, logo: app.logo, tone: connectorIcons[app.slug]?.[1] || "generic", icon: connectorIcons[app.slug]?.[0] || FiBox }; const Icon = plugin.icon; return <button type="button" key={app.slug} className={connectorSlug === app.slug ? "active" : ""} onClick={() => { setHubSection("plugins"); navigate(`/plugin/${encodeURIComponent(user.id || user.email)}/${encodeURIComponent(app.slug)}`); }}><span className={`plugin-icon plugin-${plugin.tone}`}>{app.logo || plugin.logo ? <img src={app.logo || plugin.logo} alt="" /> : <Icon />}</span><span className="plugin-manager-app-name">{plugin.name}</span></button>; })}{connectionsLoading ? <p className="plugin-apps-empty" role="status">Loading connected apps…</p> : !connectorConnections.length ? <p className="plugin-apps-empty">No apps connected yet. Browse Plugins to connect one.</p> : !connectorConnections.some((app) => `${app.name} ${app.slug}`.toLowerCase().includes(connectedAppSearch.trim().toLowerCase())) && <p className="plugin-apps-empty">No connected apps match.</p>}</nav>
          <div className="plugin-manager-foot"><span className="plugin-onboarding-dot" role="progressbar" aria-label="Connected apps" aria-valuemin={0} aria-valuemax={Math.max(appProgress.total, 1)} aria-valuenow={appProgress.count} style={{ "--plugin-progress": `${appProgress.percent}%` }} /><span>{appProgress.total ? `${appProgress.count} of ${appProgress.total} apps connected` : "Connect apps to give Jan useful tools"}</span></div>
        </aside>
        <section className="plugin-manager-content">
          {hubSection === "skills" ? <div className="plugin-skills-page"><nav className="plugin-breadcrumb"><button type="button" onClick={() => setHubSection("plugins")}>Customize</button><FiChevronRight /><span>Skills</span></nav><header><h1>Skills</h1><p>Tools from the apps you connect can help Jan complete tasks in chat.</p></header><section className="plugin-skills-empty"><FiCpu /><h2>App tools, ready when you need them</h2><p>Connect an app from Plugins. Jan can then choose relevant tools when you ask for help with that service.</p><button type="button" onClick={() => setHubSection("plugins")}>Browse plugins <FiArrowRight /></button></section></div> : workspaceView === "hub" ? <div className="plugin-catalog-page">
            <header className="plugin-catalog-header"><div><h1>Plugins</h1><p>Connect apps to let Jan work across your tools.</p></div><div className="plugin-catalog-actions"><label><FiSearch /><input value={pluginCatalogSearch} onChange={(event) => setPluginCatalogSearch(event.target.value)} placeholder="Search plugins" aria-label="Search plugins" /></label><button type="button" className="plugin-refresh" aria-label="Refresh apps and connections" onClick={() => { void loadConnectorCatalog(null, false, true); void loadConnectedApps(true); }}><FiRefreshCw /></button><button type="button" className="plugin-add" onClick={() => { setHubAudience("public"); setPluginCatalogSearch(""); }}>Browse <FiChevronDown /></button></div></header>
            <nav className="plugin-audience-tabs" aria-label="Plugin source"><button type="button" className={hubAudience === "public" ? "active" : ""} onClick={() => setHubAudience("public")}>Public</button><button type="button" className={hubAudience === "personal" ? "active" : ""} onClick={() => setHubAudience("personal")}>Personal</button></nav>
            {connectorError && <p className="connector-error" role="alert">{connectorError}</p>}
            {hubAudience === "personal" ? <section className="plugin-catalog-group"><h2>Personal plugins</h2><p className="plugin-catalog-note">Apps connected securely to your account.</p>{connectorConnections.filter((app) => `${app.name} ${app.slug}`.toLowerCase().includes(pluginCatalogSearch.trim().toLowerCase())).map((app) => { const plugin = plugins.find((item) => item.id.toLowerCase() === app.slug.toLowerCase()) || { ...app, id: app.slug, tone: connectorIcons[app.slug]?.[1] || "generic", icon: connectorIcons[app.slug]?.[0] || FiBox }; const Icon = plugin.icon; return <button type="button" className="plugin-catalog-row" key={app.slug} onClick={() => navigate(`/plugin/${encodeURIComponent(user.id || user.email)}/${encodeURIComponent(app.slug)}`)}><span className={`plugin-icon plugin-${plugin.tone}`}>{app.logo || plugin.logo ? <img src={app.logo || plugin.logo} alt="" /> : <Icon />}</span><span className="plugin-catalog-copy"><strong>{app.name}</strong><small>Connected to your account</small></span><FiChevronRight /></button>; })}{!connectorConnections.some((app) => `${app.name} ${app.slug}`.toLowerCase().includes(pluginCatalogSearch.trim().toLowerCase())) && <div className="plugin-catalog-empty"><FiBox /><p>No connected plugins are shown yet. Connect an app to see it here.</p></div>}</section> : <><section className="plugin-catalog-group"><h2>Popular <FiChevronRight /></h2><div className="plugin-catalog-grid">{renderPluginCards(visiblePlugins.slice(0, 8))}</div>{catalogLoading && <p role="status" className="plugin-catalog-note">Loading available apps…</p>}{!catalogLoading && !visiblePlugins.length && <p className="plugin-catalog-note">No plugins match that search.</p>}{connectorCursor && <button type="button" className="connector-load-more" disabled={catalogLoading} onClick={() => void loadConnectorCatalog(connectorCursor, true)}>Load more apps <FiChevronDown /></button>}</section>{visiblePlugins.length > 8 && <section className="plugin-catalog-group plugin-catalog-new"><h2>New &amp; noteworthy</h2><div className="plugin-catalog-grid">{renderPluginCards(visiblePlugins.slice(8, 14))}</div></section>}{visiblePlugins.length > 14 && <section className="plugin-catalog-group"><h2>All apps <span>{visiblePlugins.length}</span></h2><div className="plugin-catalog-grid">{renderPluginCards(visiblePlugins.slice(14))}</div></section>}</>}
          </div> : <div className="plugin-detail-page"><nav className="plugin-breadcrumb"><button type="button" onClick={() => navigate(`/plugins_${encodeURIComponent(user.id || user.email)}`)}>Plugins</button><FiChevronRight /><span>{connectorDetail?.connector.name || selectedPlugin?.name || connectorSlug}</span></nav>{connectorDetailLoading && selectedPlugin && <header className="plugin-detail-heading"><span className={`plugin-detail-logo plugin-${selectedPluginTone}`}>{selectedPlugin.logo ? <img src={selectedPlugin.logo} alt="" /> : (() => { const Icon = selectedPluginIcon; return <Icon />; })()}</span><div><h1>{selectedPlugin.name}</h1><p>{selectedPlugin.copy}</p></div><div className="plugin-detail-actions"><button type="button" className="plugin-connect-main" disabled><FiRefreshCw />Checking connection…</button></div></header>}{connectorDetailLoading ? <p className="connector-loading" role="status">Checking {selectedPlugin?.name || "app"} connection…</p> : connectorDetail ? <>
            <header className="plugin-detail-heading"><span className={`plugin-detail-logo plugin-${selectedPluginTone}`}>{connectorDetail.connector.logo ? <img src={connectorDetail.connector.logo} alt="" /> : (() => { const Icon = selectedPluginIcon; return <Icon />; })()}</span><div><h1>{connectorDetail.connector.name}</h1><p>{connectorDetail.connector.description}</p></div><div className="plugin-detail-actions">{connectorDetail.connected ? <><button type="button" onClick={() => void copyPluginLink()}><FiCopy />Copy link</button><button type="button" className="plugin-try-now" onClick={() => startPluginChat(pluginSuggestions[0])}><FiMessageCircle />Try now</button></> : connectorDetail.connector.available ? <button type="button" className="plugin-try-now" disabled={connectorActionLoading} onClick={() => void connectConnector()}>{connectorActionLoading ? "Opening secure sign-in…" : <>Connect {connectorDetail.connector.name}<FiArrowRight /></>}</button> : <button type="button" disabled>Not available yet</button>}</div></header>
            <section className="plugin-hero" style={{ backgroundImage: "url('/assets/plugin-cloud-hero.png')" }} aria-label={`${connectorDetail.connector.name} example prompts`}>{pluginSuggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => startPluginChat(suggestion)}><span className={`plugin-hero-mark plugin-${selectedPluginTone}`}>{connectorDetail.connector.logo ? <img src={connectorDetail.connector.logo} alt="" /> : (() => { const Icon = selectedPluginIcon; return <Icon />; })()}</span><span>{connectorDetail.connector.name} &nbsp;{suggestion}</span><FiArrowRight /></button>)}</section>
            {connectorError && <p className="connector-error" role="alert">{connectorError}</p>}{connectorNotice && <p className="connector-notice" role="status"><FiCheck />{connectorNotice}</p>}
            <p className="plugin-detail-about">{connectorDetail.connector.description} {connectorDetail.connector.available ? `Connect ${connectorDetail.connector.name} to let Jan use the tools it provides. The provider shows the requested permissions before you approve.` : "This app does not have a Composio connector yet, so Jan cannot access it today."}</p>
            <section className="plugin-detail-section"><h2>Apps <span>1</span></h2><article className="plugin-connected-app"><span className={`plugin-icon plugin-${selectedPluginTone}`}>{connectorDetail.connector.logo ? <img src={connectorDetail.connector.logo} alt="" /> : (() => { const Icon = selectedPluginIcon; return <Icon />; })()}</span><div><strong>{connectorDetail.connector.name}</strong><small>{connectorDetail.connector.description}</small></div><button type="button" className={connectorDetail.connected ? "is-connected" : ""} disabled={!connectorDetail.connector.available || connectorActionLoading} onClick={() => !connectorDetail.connected && void connectConnector()}>{connectorDetail.connected ? <><i />Connected<FiChevronDown /></> : connectorActionLoading ? "Opening sign-in…" : <>Connect <FiArrowRight /></>}</button></article></section>
            <section className="plugin-detail-section plugin-tools-section"><h2>Tools</h2><p>Tools are provided by Composio and run only through the connection permissions you approve. Ask Jan to use {connectorDetail.connector.name} in chat.</p></section>
          </> : <section className="connector-error-card"><FiShield /><h1>Couldn’t open this app</h1><p>{connectorError || "The connector could not be loaded. Try again from Plugins."}</p><button type="button" onClick={() => navigate(`/plugins_${encodeURIComponent(user.id || user.email)}`)}>Back to plugins</button></section>}</div>}
        </section>
      </section> : workspaceView === "library" ? <section className="library-workspace">
        <header className="library-header"><h1>Library</h1><div className="library-tools"><div className="library-layout-toggle" aria-label="Library layout"><button type="button" className={libraryLayout === "grid" ? "active" : ""} onClick={() => setLibraryLayout("grid")} aria-label="Grid view"><FiGrid /></button><button type="button" className={libraryLayout === "list" ? "active" : ""} onClick={() => setLibraryLayout("list")} aria-label="List view"><FiList /></button></div><label className="library-search"><FiSearch /><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search library" aria-label="Search library" />{libraryQuery && <button type="button" onClick={() => setLibraryQuery("")} aria-label="Clear search"><FiX /></button>}</label><button type="button" className="library-new" onClick={() => libraryFileInputRef.current?.click()}>New <FiChevronDown /></button><button type="button" className="library-filter-button" aria-label="Library filters"><FiSliders /></button><input ref={libraryFileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" hidden onChange={(event) => { void addLibraryFiles(event.target.files); event.target.value = ""; }} /></div></header>
        <nav className="library-tabs" aria-label="Library categories">{[["suggested", "Suggested"], ["favorites", "Favorites"], ["projects", "Project files"], ["images", "Images"], ["all", "All"]].map(([id, label]) => <button type="button" key={id} className={libraryFilter === id ? "active" : ""} onClick={() => setLibraryFilter(id)}>{label}</button>)}</nav>
        {libraryLoading ? <div className="library-empty" role="status">Loading your files…</div> : visibleLibraryFiles.length ? <div className={`library-files library-files-${libraryLayout}`}>{visibleLibraryFiles.map((file) => { const isImage = isImageFile(file); const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf"); const favorite = favoriteLibraryIds.includes(file.id); return <article className="library-file" key={file.id} onDoubleClick={() => openLibraryFile(file)}><button type="button" className="library-card-open" onClick={() => openLibraryFile(file)} aria-label={`Open ${file.name}`}><strong>{file.name}</strong><div className="library-file-preview">{isImage && (file.preview || file.dataUrl) ? <img src={file.preview || file.dataUrl} alt={file.name} /> : <span className={isPdf ? "pdf" : "document"}>{isPdf ? <><FiFileText /><b>PDF</b></> : <><FiFile /><b>{file.name?.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE"}</b></>}</span>}</div><footer><span>{file.created_at ? `Modified ${new Date(file.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : file.origin || "Uploaded file"}</span>{file.origin && <small>{file.origin}</small>}</footer></button><button type="button" className="library-card-menu" onClick={() => setLibraryMenuId((current) => current === file.id ? null : file.id)} aria-label={`Actions for ${file.name}`}><FiMoreHorizontal /></button>{libraryMenuId === file.id && <div className="library-card-popover"><button type="button" onClick={() => openLibraryFile(file)}>Open</button><button type="button" onClick={() => toggleLibraryFavorite(file.id)}><FiStar />{favorite ? "Remove favorite" : "Add to favorites"}</button>{file.source === "library" && <button type="button" className="danger" onClick={() => { persistLibraryFiles(libraryLocalFiles.filter((item) => item.id !== file.id)); setLibraryMenuId(null); }}>Remove</button>}</div>}</article>; })}</div> : <div className="library-empty"><FiFolder /><h2>No files here yet</h2><p>{libraryQuery ? "Try a different search." : "Files you upload in chats and projects will appear here automatically."}</p><button type="button" onClick={() => libraryFileInputRef.current?.click()}><FiUpload /> Add files</button></div>}
      </section> : (workspaceView === "chat" || workspaceView === "assistant") ? <><div className="chat-scroll" ref={scrollRef} onScroll={(event) => { if (autoScrollingRef.current) return; const node = event.currentTarget; const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 100; const wasFollowing = followLatestRef.current; followLatestRef.current = nearBottom; setShowLatestButton(!nearBottom && messages.length > 0); if (nearBottom && !wasFollowing) window.requestAnimationFrame(() => scrollToLatest()); }}>
        {messagesLoading ? <div className="chat-empty" role="status">Loading conversation…</div> : !messages.length ? <section className={`chat-empty ${workspaceView === "assistant" ? "assistant-empty" : ""}`}>{workspaceView === "assistant" && <span className="assistant-mark"><LuBrainCircuit /></span>}<h1>{workspaceView === "assistant" ? `Hi ${userDisplayName}, I’m your assistant` : "Where should we begin?"}</h1><p className="chat-empty-description">{workspaceView === "assistant" ? "This is one continuous conversation. Come back anytime and we’ll continue where you left off." : "Start with a goal, decision, or draft."}</p>{error && <div className="chat-error" role="alert"><strong>Couldn’t start this chat</strong><p>{error}</p></div>}</section> : <div className="chat-thread" role="log" aria-live="polite" aria-relevant="additions text">{messages.map((message, index) => <article className={`chat-message chat-message-${message.role}`} key={message.id || `${message.role}-${index}`} aria-label={`${message.role === "assistant" ? "Jan" : "You"} message`}>
          {message.role === "assistant" && <span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span>}
          <div className="chat-message-body"><div className="chat-message-meta"><strong>{message.role === "assistant" ? "Jan" : userDisplayName}</strong><span>{message.role === "assistant" ? message.streaming ? "Writing" : "Personal assistant" : "You"}</span></div>{messageFiles(message).length > 0 && <div className="chat-message-attachments">{messageFiles(message).map((a, i) => <div className="chat-msg-attachment" key={i}>{a.type?.startsWith("image/") && a.preview ? <img src={a.preview} alt={a.name} /> : <span className="chat-msg-file"><FiFile />{a.name}</span>}</div>)}</div>}{message.role === "assistant" ? message.streaming && !message.content ? <div className="chat-streaming-wait" aria-label="Jan is thinking"><i /><i /><i /><span>Jan is thinking</span></div> : <div className={message.streaming ? "chat-streaming-copy" : ""}><Suspense fallback={<p className="chat-response-loading">Formatting response…</p>}><MessageResponse>{message.content}</MessageResponse></Suspense>{!message.streaming && <SourcePreview sources={messageWebSources(message)} />}</div> : <p className="chat-user-copy">{message.content}</p>}{message.role === "user" && <div className="chat-message-actions"><button type="button" onClick={() => editAndResend(message.content)} aria-label="Edit message in composer" title="Edit in composer"><FiEdit2 /></button></div>}{message.role === "assistant" && !message.streaming && <div className="chat-message-actions"><button type="button" onClick={() => copyMessage(message.content, index)} aria-label="Copy response" title={copiedMessage === index ? "Copied" : "Copy response"}>{copiedMessage === index ? <FiCheck /> : <FiCopy />}</button>{index === messages.length - 1 && <button type="button" onClick={regenerateResponse} aria-label="Regenerate response" title="Regenerate response" disabled={loading}><FiRefreshCw /></button>}</div>}</div>
        </article>)}{error && <div className="chat-error" role="alert"><span>{error === "Response stopped." ? "RESPONSE STOPPED" : "CONNECTION ISSUE"}</span><p>{error}</p></div>}<div ref={endRef} /></div>}
      </div>
      {showLatestButton && workspaceHasMessages && <button type="button" className="chat-latest" onClick={() => { followLatestRef.current = true; setShowLatestButton(false); scrollToLatest(); }}><FiChevronDown /> Latest messages</button>}
      <div className="chat-composer-wrap">{persistenceNotice && <p className="chat-persistence-notice" role="status">{persistenceNotice}</p>}<form className={`chat-composer ${isDraggingFiles ? "chat-composer-drop-active" : ""}`} onSubmit={(event) => { event.preventDefault(); send(); }} onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setIsDraggingFiles(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDraggingFiles(false); }} onDrop={handleFileDrop}>
        <>{attachments.length > 0 && <div className="chat-attachments">{attachments.map((a, i) => <div className="chat-attachment" key={i}><div className="chat-attachment-preview">{a.type.startsWith("image/") ? <img src={a.preview} alt={a.name} /> : <FiFile />}<button type="button" onClick={() => removeAttachment(i)} aria-label="Remove file"><FiX /></button></div><span className="chat-attachment-name">{a.name}</span></div>)}</div>}{attachmentNotice && <p className="chat-attachment-notice">{attachmentNotice}</p>}{attachmentError && <p className="chat-attachment-error" role="alert">{attachmentError}</p>}
        <div className="chat-composer-input"><textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} placeholder={attachments.length ? "Add a message about your files..." : "Ask Jan anything..."} aria-label="Message Jan" rows="1" maxLength="4000" /></div>
        <div className="chat-composer-footer">
          <div className="chat-composer-tools">
            {!loading && <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} aria-label="Add photos, PDFs, or files" title="Add photos, PDFs, or files"><FiPlus /><span className="chat-attach-label">Add files</span></button>}
            <ModelPicker models={modelList} selected={selectedModel} details={MODEL_DISPLAY} open={modelMenuOpen} more={showMoreModels} pickerRef={modelMenuRef} onToggle={() => setModelMenuOpen((current) => !current)} onMore={setShowMoreModels} onSelect={(id) => { setSelectedModel(id); setModelMenuOpen(false); }} />
            <input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" onChange={handleFileSelect} hidden />
          </div>
          <div className="chat-composer-send"><kbd>{loading ? "Stop" : "↵ to send"}</kbd>{loading ? <button type="button" className="chat-stop-text" onClick={stopGenerating} aria-label="Stop response" title="Stop generating"><span /></button> : <button type="submit" className="chat-send-control" disabled={messagesLoading || (!draft.trim() && !attachments.length)} aria-label="Send message" title="Send message"><FiArrowUp /></button>}</div>
        </div></>
      </form><small>Jan can make mistakes. Check important information.</small>{!messages.length && !messagesLoading && <div className="chat-starters">{CHAT_STARTERS.map((starter) => <button type="button" key={starter.label} onClick={() => { setDraft(starter.prompt); textareaRef.current?.focus(); }}><FiArrowRight aria-hidden="true" /><span>{starter.label}</span></button>)}</div>}</div></> : workspaceView === "project" && activeProject ? <section className="project-workspace project-overview">
        <header className="project-heading"><div><p>PROJECT</p><h1><FiMessageCircle />{activeProject.name}</h1></div><div className="project-heading-actions"><button type="button" className="project-share" onClick={() => setProjectNotice("Sharing is coming soon in this prototype.")}><FiUpload /> Share</button><button type="button" aria-label="Project actions"><FiMoreHorizontal /></button></div></header>
        <form className="project-composer project-overview-composer" onSubmit={(event) => { event.preventDefault(); sendProjectMessage(); }}><button type="button" className="project-plus" onClick={() => projectFileInputRef.current?.click()} aria-label="Add project files"><FiPlus /></button><textarea value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendProjectMessage(); } }} placeholder={`New chat in ${activeProject.name}`} aria-label={`New chat in ${activeProject.name}`} /><button type="submit" className="project-send" disabled={!projectDraft.trim() || projectSending} aria-label="Send project message">{projectSending ? <span className="project-send-spinner" /> : <FiSend />}</button></form>
        <nav className="project-tabs" aria-label="Project content"><button type="button" className={projectTab === "chats" ? "active" : ""} onClick={() => setProjectTab("chats")}>Chats</button><button type="button" className={projectTab === "sources" ? "active" : ""} onClick={() => setProjectTab("sources")}>Sources {activeProject.files?.length ? <span>{activeProject.files.length}</span> : null}</button></nav>
        {projectTab === "chats" ? <section className="project-chat-list" aria-label={`${activeProject.name} chats`}>{projectChats.length ? projectChats.map((chat) => <button type="button" className="project-chat-row" key={chat.id} onClick={() => openProjectChat(chat.id)}><div><strong>{chat.title}</strong><p>{chat.preview}</p></div><time>{chat.updated_at ? new Date(chat.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Now"}</time></button>) : <section className="project-empty-card"><FiMessageCircle /><h2>No chats in {activeProject.name} yet</h2><p>Start a new chat above to keep work in this project.</p></section>}{projectError && <p className="project-chat-error" role="alert">{projectError}</p>}</section> : <section className="project-sources"><header><div><strong>Sources</strong><span>Files Jan can use in this project</span></div><button type="button" onClick={() => projectFileInputRef.current?.click()}><FiUpload /> Add files</button></header>{activeProject.files?.length ? <ul className="project-file-list">{activeProject.files.map((file) => <li key={file.id}><FiFile /><span>{file.name}</span></li>)}</ul> : <button type="button" className="project-dropzone" onClick={() => projectFileInputRef.current?.click()}><FiFile /><span>Add PDFs, documents, or other text to reference in this project.</span></button>}</section>}
        <input ref={projectFileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" hidden onChange={(event) => { addProjectFiles(event.target.files); event.target.value = ""; }} />
        {projectNotice && <div className="project-toast" role="status"><FiCheck />{projectNotice}</div>}
      </section> : workspaceView === "project-chat" && activeProject ? <><div className="chat-scroll"><div className="chat-thread project-chat-thread" role="log" aria-live="polite"><button type="button" className="project-chat-back" onClick={() => { setWorkspaceView("project"); setProjectTab("chats"); }}><FiChevronLeft />{activeProject.name}</button>{(activeProjectChat?.messages || []).map((message, index) => <article className={`chat-message chat-message-${message.role}`} key={message.id || `${message.role}-${index}`} aria-label={`${message.role === "assistant" ? "Jan" : "You"} message`}>{message.role === "assistant" && <span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span>}<div className="chat-message-body"><div className="chat-message-meta"><strong>{message.role === "assistant" ? "Jan" : userDisplayName}</strong><span>{message.role === "assistant" ? "Personal assistant" : "You"}</span></div>{message.role === "assistant" ? <Suspense fallback={<p>{message.content}</p>}><MessageResponse>{message.content}</MessageResponse></Suspense> : <p className="chat-user-copy">{message.content}</p>}{message.role === "assistant" && <div className="chat-message-actions"><button type="button" onClick={() => navigator.clipboard?.writeText(message.content)} aria-label="Copy response"><FiCopy /> Copy</button></div>}</div></article>)}{projectSending && <article className="chat-message chat-message-assistant"><span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span><div className="chat-message-body"><div className="chat-message-meta"><strong>Jan</strong><span>Personal assistant</span></div><p className="chat-streaming-wait"><i /> Jan is thinking</p></div></article>}{projectError && <div className="chat-error" role="alert">{projectError}</div>}</div></div><div className="chat-composer-wrap"><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendProjectMessage(); }}><div className="chat-composer-input"><textarea value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendProjectMessage(); } }} placeholder={`Reply in ${activeProject.name}`} aria-label={`Reply in ${activeProject.name}`} /></div><div className="chat-composer-footer"><div className="chat-composer-tools"><button type="button" className="chat-attach-btn" onClick={() => projectFileInputRef.current?.click()} aria-label="Add files"><FiPlus /><span className="chat-attach-label">Add files</span></button><span className="chat-connection"><i />{projectSending ? "Jan is responding" : "Groq secured server-side"}</span></div><div className="chat-composer-send"><kbd>↵ to send</kbd><button type="submit" disabled={!projectDraft.trim() || projectSending} aria-label="Send message"><FiSend /></button></div></div></form><input ref={projectFileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" hidden onChange={(event) => { addProjectFiles(event.target.files); event.target.value = ""; }} /></div></> : workspaceView === "hub" ? <section className="hub-workspace"><header><p>CONNECTED APPS</p><h1>Plugins</h1><span>Connect an app to your account. Jan can then use that app’s available tools.</span></header><label className="hub-search"><FiSearch /><input value={hubSearch} onChange={(event) => setHubSearch(event.target.value)} placeholder="Search apps" aria-label="Search apps" /></label>{connectorError && <p className="connector-error" role="alert">{connectorError}</p>}<section className="hub-popular"><h2>{hubSearch.trim() ? "Search results" : "Popular apps"}</h2>{visiblePlugins.map((plugin) => { const Icon = plugin.icon; return <article key={plugin.id} className="connector-row"><span className={`plugin-icon plugin-${plugin.tone}`}>{plugin.logo ? <img src={plugin.logo} alt="" /> : <Icon />}</span><div><strong>{plugin.name}</strong><small>{plugin.copy}</small></div><button type="button" onClick={() => navigate(`/plugin/${encodeURIComponent(user.id || user.email)}/${encodeURIComponent(plugin.id)}`)} aria-label={`View ${plugin.name} connector`}>{plugin.available ? "View" : "Details"}<FiChevronRight /></button></article>; })}{catalogLoading && <p className="hub-no-results" role="status">Loading available apps…</p>}{!catalogLoading && !visiblePlugins.length && <p className="hub-no-results">No apps match that search.</p>}{connectorCursor && <button type="button" className="connector-load-more" disabled={catalogLoading} onClick={() => void loadConnectorCatalog(connectorCursor, true)}>Load more apps <FiChevronDown /></button>}</section><p className="hub-disclaimer"><FiShield /> Apps you connect are attached to your Jan account. The provider’s approval screen shows the permissions you grant.</p></section> : workspaceView === "plugin-detail" ? <section className="connector-detail-workspace"><button type="button" className="connector-back" onClick={() => navigate(`/plugins_${encodeURIComponent(user.id || user.email)}`)}><FiArrowLeft /> All plugins</button>{connectorDetailLoading ? <p className="connector-loading" role="status">Loading connector…</p> : connectorDetail ? <><header className="connector-detail-header"><span className={`plugin-icon plugin-${connectorIcons[connectorSlug]?.[1] || "generic"}`}>{connectorDetail.connector.logo ? <img src={connectorDetail.connector.logo} alt="" /> : (() => { const Icon = connectorIcons[connectorSlug]?.[0] || FiBox; return <Icon />; })()}</span><div><p>APP CONNECTOR</p><h1>{connectorDetail.connector.name}</h1><span>{connectorDetail.connector.description}</span></div></header><section className="connector-permissions"><h2>What Jan can access</h2><p>{connectorDetail.connector.available ? `After you connect, Jan can use the tools Composio provides for ${connectorDetail.connector.name}. The provider will show the requested permissions before you approve.` : "This app does not have a Composio connector yet, so Jan cannot access it today."}</p></section>{connectorError && <p className="connector-error" role="alert">{connectorError}</p>}{connectorNotice && <p className="connector-notice" role="status"><FiCheck />{connectorNotice}</p>}{connectorDetail.connector.available && <button type="button" className={`connector-connect ${connectorDetail.connected ? "connected" : ""}`} disabled={connectorActionLoading || connectorDetail.connected} onClick={() => void connectConnector()}>{connectorDetail.connected ? <><FiCheck /> Connected to {connectorDetail.connector.name}</> : connectorActionLoading ? "Opening secure sign-in…" : <>Connect {connectorDetail.connector.name}<FiArrowRight /></>}</button>}</> : <section className="connector-error-card"><FiShield /><h1>Couldn’t open this app</h1><p>{connectorError || "The connector could not be loaded. Try again from Plugins."}</p><button type="button" onClick={() => navigate(`/plugins_${encodeURIComponent(user.id || user.email)}`)}>Back to plugins</button></section>}</section> : <section className="settings-workspace"><header><p>ACCOUNT</p><h1>Settings</h1><span>Manage your Jan workspace and account preferences.</span></header><section className="settings-account"><span>{userDisplayName.charAt(0).toUpperCase()}</span><div><strong>{userDisplayName}</strong><small>{user.email}</small></div><button type="button" onClick={signOut}>Log out <FiLogOut /></button></section><section className="settings-panel"><h2>Workspace</h2><label><span>Response streaming</span><input type="checkbox" defaultChecked /></label><label><span>Use the fastest free model when available</span><input type="checkbox" defaultChecked /></label><label><span>Model</span><button type="button" onClick={() => setModelMenuOpen(true)}>{MODEL_DISPLAY[selectedModel]?.name || selectedModel}<FiChevronRight /></button></label></section></section>}
    </section>
  </main>;
}
