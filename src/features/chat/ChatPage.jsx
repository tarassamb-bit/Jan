import { requestChat, buildChatMessages } from "./transport.js";
import { useConversationMessages } from "./useConversationMessages.js";
import { serializeAttachments, restoreAttachments, loadProjectSources } from "./files.js";
import { PROJECT_FILE_LIMIT, PROJECT_FILE_MAX_BYTES, TEXT_FILE_TYPES, TEXT_FILE_EXTENSION, safeProjectFileName, compressProjectFile, MAX_ATTACHMENT_BYTES, MAX_IMAGE_BYTES, MAX_ATTACHMENT_CHARS, MAX_ATTACHMENTS, MAX_IMAGES_PER_MESSAGE, VISION_MODEL, clampAttachmentText, extractAttachment } from "./files.js";
import { DEMO_ACCOUNT, DEMO_USER_KEY, DEMO_CONVERSATIONS_KEY, PROJECTS_STORAGE_KEY, FREE_DAILY_MESSAGE_LIMIT, FREE_DAILY_UPLOAD_LIMIT, DEFAULT_SETTINGS, readDemoUser, readDemoConversations, writeDemoConversations, readProjects, writeProjects, usageStorageKey, readDailyUsage, writeDailyUsage, settingsStorageKey, readSettings, writeSettings, memoriesStorageKey, readMemories, writeMemories, demoMessagesKey, readDemoMessages, makeConversationTitle } from "./storage.js";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";
import SettingsModalV2 from "../../components/SettingsModal.jsx";
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
  FiBarChart2,
  FiBookOpen,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiCpu,
  FiFile,
  FiFolder,
  FiGitBranch,
  FiGrid,
  FiHeart,
  FiLogOut,
  FiMail,
  FiMenu,
  FiMessageCircle,
  FiMonitor,
  FiMoreHorizontal,
  FiPaperclip,
  FiPlus,
  FiSearch,
  FiSend,
  FiSettings,
  FiShield,
  FiEdit2,
  FiUpload,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
const MessageResponse = lazy(() => import("../../components/ai-elements/MessageResponse").then((module) => ({ default: module.MessageResponse })));


const CHAT_STARTERS = [
  { eyebrow: "PLAN", title: "Plan a focused workday", copy: "Turn priorities into a calm, realistic schedule." },
  { eyebrow: "LEARN", title: "Explain a difficult idea simply", copy: "Break down a complex topic without the jargon." },
  { eyebrow: "WRITE", title: "Help me draft a thoughtful message", copy: "Find the right words, tone, and structure." },
];

function ProjectManageModal({ project, conversations, onClose, onRenameProject, onDeleteProject, onRenameChat, onDeleteChat, onMoveConversation }) {
  return <div className="project-create-overlay" role="presentation"><section className="project-manage-dialog" role="dialog" aria-modal="true" aria-label="Manage project"><button type="button" className="project-create-close" onClick={onClose} aria-label="Close project actions"><FiX /></button><p>PROJECT ACTIONS</p><h2>{project.name}</h2><div className="project-manage-actions"><button type="button" onClick={onRenameProject}>Rename project</button><button type="button" className="danger" onClick={onDeleteProject}>Delete project</button></div><h3>Chats in this project</h3>{project.chats?.length ? <ul>{project.chats.map((chat) => <li key={chat.id}><span>{chat.title}</span><button type="button" onClick={() => onRenameChat(chat)}>Rename</button><button type="button" className="danger" onClick={() => onDeleteChat(chat.id)}>Delete</button></li>)}</ul> : <small>No project chats yet.</small>}<h3>Put an existing chat here</h3>{conversations.length ? <ul>{conversations.map((conversation) => <li key={conversation.id}><span>{conversation.title}</span><button type="button" onClick={() => onMoveConversation(conversation.id)}>Move here</button></li>)}</ul> : <small>No normal chats available.</small>}</section></div>;
}

function RenameConversationDialog({ conversation, onSave, onClose }) {
  const [title, setTitle] = useState(conversation.title);
  return <div className="project-create-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="project-create-dialog" onSubmit={(event) => { event.preventDefault(); onSave(title); }} role="dialog" aria-modal="true" aria-labelledby="rename-conversation-title"><button type="button" className="project-create-close" onClick={onClose} aria-label="Close rename dialog"><FiX /></button><p>CHAT ACTIONS</p><h2 id="rename-conversation-title">Rename chat</h2><span>Choose a clear title so you can find it later.</span><label><span className="sr-only">Chat title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength="120" /></label><button type="submit" disabled={!title.trim()}>Save name <FiArrowRight /></button></form></div>;
}

function SidebarConversation({ conversation, active, pinned, menuOpen, onOpen, onMenu, onRename, onPin, onDelete }) {
  return <div className={`chat-conversation ${active ? "active" : ""}`}><button type="button" className="chat-conversation-select" onClick={onOpen} aria-label={`Open ${conversation.title}`}><FiMessageCircle /><span><strong>{conversation.title}</strong><small>{new Date(conversation.updated_at).toLocaleDateString()}</small></span></button><button type="button" className="chat-conversation-more" onClick={onMenu} aria-label={`Conversation actions for ${conversation.title}`} aria-expanded={menuOpen}><FiMoreHorizontal /></button>{menuOpen && <div className="chat-conversation-menu" role="menu"><button type="button" role="menuitem" onClick={onRename}><FiEdit2 />Rename</button><button type="button" role="menuitem" onClick={onPin}><FiEdit2 />{pinned ? "Unpin" : "Pin"}</button><button type="button" className="chat-conversation-delete" role="menuitem" onClick={onDelete}><FiTrash2 />Delete</button></div>}</div>;
}

function SidebarSectionHeader({ children, expanded, onToggle }) {
  return <button type="button" className="chat-section-toggle" onClick={onToggle} aria-expanded={expanded}><span>{children}</span><FiChevronDown /></button>;
}

const FEATURED_GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "groq/compound"];

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

export default function ChatPage({ useUser, navigate, requestAuth, Header, Brand, Link }) {
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
  const [sidebarSections, setSidebarSections] = useState({ pinned: true, projects: true, chats: true });
  const [workspaceView, setWorkspaceView] = useState("chat");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [fullSearchResults, setFullSearchResults] = useState([]);
  const [fullSearchStatus, setFullSearchStatus] = useState("idle");
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
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentNotice, setAttachmentNotice] = useState("");
  const [persistenceNotice, setPersistenceNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dailyUsage, setDailyUsage] = useState(() => readDailyUsage(user?.id || user?.email));
  const usageDayRef = useRef(new Date().toISOString().slice(0, 10));
  const [accountSettings, setAccountSettings] = useState(() => readSettings(user?.id || user?.email));
  const [memories, setMemories] = useState(() => readMemories(user?.id || user?.email));
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [pinnedIds, setPinnedIds] = useState(() => { try { return JSON.parse(window.localStorage.getItem(`jan-pinned-${user?.id || user?.email || "guest"}`) || "[]"); } catch { return []; } });
  const [recentsHover, setRecentsHover] = useState(false);
  const [recentsPos, setRecentsPos] = useState({ top: 0, left: 0 });
  const recentsRef = useRef(null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const followLatestRef = useRef(true);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const modelMenuRef = useRef(null);
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
      setActiveConversationId((current) => current || demoConversations[0]?.id || null);
      return;
    }
    const loadConversations = async () => {
      const { data } = await supabase.from("conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (data) {
        setConversations(data);
        setActiveConversationId((current) => current || data[0]?.id || null);
      }
    };
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (user.is_demo) { setDailyUsage(readDailyUsage(user.id || user.email)); setAccountSettings(readSettings(user.id || user.email)); setMemories(readMemories(user.id || user.email)); return; }
    const loadAccountState = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: settingsRow }, { data: usageRow }, { data: memoryRows }] = await Promise.all([supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(), supabase.from("daily_usage").select("messages, uploads").eq("user_id", user.id).eq("usage_date", today).maybeSingle(), supabase.from("user_memories").select("*").eq("user_id", user.id).order("created_at", { ascending: false })]);
      const nextSettings = { ...DEFAULT_SETTINGS, ...(settingsRow || {}), language: "auto" };
      setAccountSettings(nextSettings); writeSettings(user.id, nextSettings);
      const nextUsage = usageRow || { messages: 0, uploads: 0 };
      setDailyUsage(nextUsage); writeDailyUsage(user.id, nextUsage);
      setMemories(memoryRows || []); writeMemories(user.id, memoryRows || []);
    };
    loadAccountState();
  }, [user]);
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
  const saveAccountSettings = (nextSettings) => { const normalizedSettings = { ...nextSettings, language: "auto" }; setAccountSettings(normalizedSettings); writeSettings(user?.id || user?.email, normalizedSettings); if (!user?.is_demo) supabase.from("user_settings").upsert({ user_id: user.id, ...normalizedSettings, updated_at: new Date().toISOString() }).then(({ error: saveError }) => { if (saveError) setPersistenceNotice("Your settings are saved on this device, but could not be synced yet."); }); };
  const addMemory = async (content) => { const text = String(content || "").trim().slice(0, 220); if (!text || memories.some((memory) => memory.content.toLowerCase() === text.toLowerCase())) return true; const localMemory = { id: globalThis.crypto?.randomUUID?.() || `memory-${Date.now()}`, content: text, created_at: new Date().toISOString() }; if (user?.is_demo) { const next = [localMemory, ...memories]; setMemories(next); writeMemories(user.id || user.email, next); return true; } const { data, error: memoryError } = await supabase.from("user_memories").insert({ user_id: user.id, content: text }).select().single(); if (memoryError || !data) { setPersistenceNotice("Jan couldn’t save that memory yet. Please try again."); return false; } const next = [data, ...memories]; setMemories(next); writeMemories(user.id, next); return true; };
  const deleteMemory = async (id) => { if (!user?.is_demo) { const { error } = await supabase.from("user_memories").delete().eq("id", id); if (error) { setPersistenceNotice("Jan couldn’t delete that memory yet. Please try again."); return; } } const next = memories.filter((memory) => memory.id !== id); setMemories(next); writeMemories(user?.id || user?.email, next); };
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

  useEffect(() => {
    if (!followLatestRef.current) return undefined;
    const scrollConversation = () => scrollRef.current?.scrollTo({ top: messages.length ? scrollRef.current.scrollHeight : 0, behavior: "auto" });
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
  useEffect(() => { setFullSearchResults([]); setFullSearchStatus("idle"); }, [chatSearchQuery, chatSearchOpen]);

  // Close model menu on outside click
  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (e) => { if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) setModelMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);
  useEffect(() => { window.localStorage.setItem("jan-sidebar-collapsed", String(sidebarCollapsed)); }, [sidebarCollapsed]);
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
  }, []);

  const createConversation = useCallback(async (title) => {
    if (!user) return null;
    if (user.is_demo) {
      const conversation = { id: globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}`, title: title || "New conversation", updated_at: new Date().toISOString() };
      setConversations((previous) => { const next = [conversation, ...previous]; writeDemoConversations(next); return next; });
      return conversation;
    }
    const { data } = await supabase.from("conversations").insert({ user_id: user.id, title: title || "New conversation" }).select().single();
    if (data) setConversations((prev) => [data, ...prev]);
    return data;
  }, [user]);

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

  const send = async (contentOverride) => {
    const content = (typeof contentOverride === "string" ? contentOverride : draft).trim();
    if ((!content && !attachments.length) || sendLock.current || messagesLoading) return;
    if (user?.is_demo) { setError("Sign in to send messages. Live AI is unavailable in the local demo."); return; }
    if (dailyUsage.messages >= FREE_DAILY_MESSAGE_LIMIT) { setError("You’ve used your 100 messages for today. Your allowance resets at midnight UTC."); return; }
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
    let savedUser = false;
    const assistantId = crypto.randomUUID();
    const firstMessage = messages.length === 0;
    const activeAttachments = serializeAttachments(attachments);
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
      }
      const userMsg = await saveMessage(convId, "user", displayContent, activeAttachments);
      if (!userMsg) throw new Error("Couldn’t save this message. Your draft and files have been kept.");
      savedUser = true;
      if (!current()) return;
      const hydrated = { ...userMsg, attachments: restoreAttachments(userMsg.attachments) };
      setMessages((previous) => [...previous, hydrated, { id: assistantId, role: "assistant", content: "", streaming: true }]);
      setDraft(""); setAttachments([]); setAttachmentError(""); setAttachmentNotice(""); setPersistenceNotice("");
      if (activeAttachments.length) recordUsage("uploads", activeAttachments.length);
      await requestChat({
        client: supabase, user, messages: buildChatMessages([...messages, hydrated]), model: selectedModel,
        preferences: accountSettings, memories: memories.map((memory) => memory.content), signal: controller.signal,
        onUsage: (usage) => { if (current()) setDailyUsage(usage); },
        onDelta: (text) => {
          streamedContent = text;
          if (current()) setMessages((previous) => previous.map((message) => message.id === assistantId ? { ...message, content: text } : message));
        },
      });
    } catch (requestError) {
      if (current()) setError(requestError.name === "AbortError" ? "Response stopped." : requestError.message || "Jan couldn’t respond. Please try again.");
    } finally {
      if (creatingConversationRef.current === convId) creatingConversationRef.current = null;
      if (streamedContent.trim() && savedUser) {
        if (accountSettings.developer_mode) {
          const seconds = Math.max(.1, (performance.now() - started) / 1000);
          const tokens = Math.max(1, Math.round(streamedContent.length / 4));
          streamedContent += `\n\n---\n*Developer: ~${tokens} output tokens · ${seconds.toFixed(1)}s · ~${Math.round(tokens / seconds)} tokens/s*`;
        }
        if (current()) setMessages((previous) => previous.map((message) => message.id === assistantId ? { ...message, content: streamedContent, streaming: false } : message));
        try {
          await saveMessage(convId, "assistant", streamedContent);
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

  const switchConversation = (convId) => { cancelChatRequest(); setMessages([]); setMessagesLoading(true); followLatestRef.current = true; setShowLatestButton(false); setActiveConversationId(convId); setSidebarOpen(false); setConversationMenuId(null); setError(""); setAttachmentError(""); setAttachmentNotice(""); setPersistenceNotice(""); };
  const newConversation = () => { cancelChatRequest(); setMessagesLoading(false); followLatestRef.current = true; setShowLatestButton(false); setActiveConversationId(null); setMessages([]); setDraft(""); setAttachments([]); setError(""); setAttachmentError(""); setAttachmentNotice(""); setPersistenceNotice(""); setSidebarOpen(false); textareaRef.current?.focus(); };
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
    const dailyAvailable = Math.max(0, FREE_DAILY_UPLOAD_LIMIT - dailyUsage.uploads);
    const acceptedFiles = selectedFiles.slice(0, Math.min(available, dailyAvailable));
    if (!acceptedFiles.length) { setProjectError(dailyAvailable ? `A project can contain up to ${PROJECT_FILE_LIMIT} files.` : "Your 3 daily uploads are used. Try again after midnight UTC."); return; }
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
    if (dailyUsage.messages >= FREE_DAILY_MESSAGE_LIMIT) { setProjectError("You’ve used your 100 messages for today. Your allowance resets at midnight UTC."); return; }
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
  const tryFullChatSearch = async () => {
    const query = chatSearchQuery.trim().toLowerCase();
    if (!query) return;
    setFullSearchStatus("loading");
    try {
      let matches = [];
      if (user?.is_demo) {
        matches = conversations.flatMap((conversation) => readDemoMessages(conversation.id)
          .filter((message) => message.content?.toLowerCase().includes(query))
          .slice(0, 1)
          .map((message) => ({ ...conversation, match: message.content })));
      } else if (conversations.length) {
        const { data, error: searchError } = await supabase.from("messages").select("conversation_id, content").in("conversation_id", conversations.map((conversation) => conversation.id)).ilike("content", `%${chatSearchQuery.trim()}%`);
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
      setFullSearchResults(matches);
      setFullSearchStatus("complete");
    } catch {
      setFullSearchStatus("error");
    }
  };
  const copyMessage = async (content, index) => { await navigator.clipboard.writeText(content); setCopiedMessage(index); window.setTimeout(() => setCopiedMessage(null), 1800); };

  const MODEL_DISPLAY = {
    "openai/gpt-oss-20b": { name: "GPT‑OSS 20B", badge: "Recommended", description: "Fast and capable for everyday tasks" },
    "openai/gpt-oss-120b": { name: "GPT‑OSS 120B", badge: "Best quality", description: "For complex analysis and deeper reasoning" },
    "qwen/qwen3.6-27b": { name: "Qwen 3.6 27B", badge: "Reasoning", description: "Thoughtful answers for detailed work" },
    "qwen/qwen3.8-27b": { name: "Qwen 3.8 27B", badge: "Images", description: "Use photos and visual questions" },
    "groq/compound": { name: "Groq Compound", badge: "Tools", description: "For research and tool-assisted tasks" },
    "groq/compound-mini": { name: "Groq Compound Mini", badge: "Fast", description: "Quick answers with built-in tools" },
  };

  const addFiles = async (filesToAdd) => {
    const files = Array.from(filesToAdd || []).slice(0, Math.max(0, Math.min(MAX_ATTACHMENTS - attachments.length, FREE_DAILY_UPLOAD_LIMIT - dailyUsage.uploads - attachments.length)));
    if (!files.length) {
      setAttachmentError(`You can add up to ${MAX_ATTACHMENTS} files to one message.`);
      return;
    }
    if (dailyUsage.uploads >= FREE_DAILY_UPLOAD_LIMIT) { setAttachmentError(`You’ve used your ${FREE_DAILY_UPLOAD_LIMIT} free uploads for today. Please come back tomorrow.`); return; }
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

  const signOut = async () => { cancelChatRequest(); if (user?.is_demo) { window.localStorage.removeItem(DEMO_USER_KEY); window.dispatchEvent(new CustomEvent("jan:demo-auth")); } else { await supabase.auth.signOut(); } setConversations([]); setActiveConversationId(null); setMessages([]); navigate("/"); };

  const togglePin = useCallback((convId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId];
      window.localStorage.setItem(`jan-pinned-${user?.id || user?.email || "guest"}`, JSON.stringify(next));
      return next;
    });
  }, [user]);

  const pinnedConversations = conversations.filter((c) => pinnedIds.includes(c.id));
  const unpinnedConversations = conversations.filter((c) => !pinnedIds.includes(c.id));
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
  const plugins = [
    { id: "gmail", name: "Gmail", copy: "Read and manage Gmail", icon: SiGmail, tone: "gmail" },
    { id: "github", name: "GitHub", copy: "Triage PRs, issues, CI, and publish flows", icon: FaGithub, tone: "github" },
    { id: "drive", name: "Google Drive", copy: "Drive, Docs, Sheets or Slides", icon: FaGoogleDrive, tone: "drive" },
    { id: "outlook", name: "Outlook Email", copy: "Triage Outlook inboxes", icon: FiMail, tone: "outlook" },
    { id: "canva", name: "Canva", copy: "Create, review, edit designs", icon: SiCanva, tone: "canva" },
  ];
  const visiblePlugins = plugins.filter((plugin) => `${plugin.name} ${plugin.copy}`.toLowerCase().includes(hubSearch.toLowerCase()));
  const matchingConversations = conversations.filter((conversation) => conversation.title.toLowerCase().includes(chatSearchQuery.trim().toLowerCase()));
  const displayedSearchResults = matchingConversations.length ? matchingConversations : fullSearchResults;

  return <main className={`chat-page ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <button className="chat-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
    {projectCreateOpen && <div className="project-create-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setProjectCreateOpen(false)}><form className="project-create-dialog" onSubmit={(event) => { event.preventDefault(); confirmCreateProject(); }} role="dialog" aria-modal="true" aria-labelledby="project-create-title"><button type="button" className="project-create-close" onClick={() => setProjectCreateOpen(false)} aria-label="Close new project dialog"><FiX /></button><p>NEW PROJECT</p><h2 id="project-create-title">Name your project</h2><span>Keep conversations and files together in one focused space.</span><label><span className="sr-only">Project name</span><input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Launch plan" maxLength="80" /></label><button type="submit" disabled={!projectName.trim()}>Create project <FiArrowRight /></button></form></div>}
    {projectManageOpen && activeProject && <ProjectManageModal project={activeProject} conversations={conversations} onClose={() => setProjectManageOpen(false)} onRenameProject={renameProject} onDeleteProject={deleteProject} onRenameChat={renameProjectChat} onDeleteChat={deleteProjectChat} onMoveConversation={moveConversationToProject} />}
    {renameTarget && <RenameConversationDialog conversation={renameTarget} onClose={() => setRenameTarget(null)} onSave={(title) => renameConversation(renameTarget.id, renameTarget.title, title)} />}
    {settingsOpen && <SettingsModalV2 user={user} userDisplayName={userDisplayName} usage={dailyUsage} settings={accountSettings} memories={memories} onAddMemory={addMemory} onDeleteMemory={deleteMemory} onSettingsChange={saveAccountSettings} onChangePassword={changePassword} onClose={() => setSettingsOpen(false)} onSignOut={signOut} />}
    <aside className="chat-sidebar">
      <div className="chat-sidebar-brand"><Brand /><div className="chat-sidebar-brand-actions">{sidebarCollapsed ? null : <button className="chat-sidebar-search" type="button" onClick={() => { setChatSearchOpen(true); setSidebarOpen(false); }} aria-label="Search chats" title="Search chats"><FiSearch /></button>}<button className="chat-sidebar-collapse" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <FiChevronRight /> : <FiChevronLeft />}</button><button className="chat-sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><FiX /></button></div></div>
      <div className="chat-shortcuts">
        <button className="new-chat" type="button" onClick={() => { setWorkspaceView("chat"); newConversation(); }}><FiPlus /><span>New Chat</span><kbd>Ctrl N</kbd></button>
        {sidebarCollapsed && <button type="button" className="chat-shortcut chat-shortcut-search" onClick={() => { setChatSearchOpen(true); setSidebarOpen(false); }} aria-label="Search chats"><FiSearch /><span>Search</span><kbd>⌘K</kbd></button>}
        <button type="button" className="chat-shortcut" onClick={createProject}><FiFolder /><span>New Projects</span></button>
      </div>
      {sidebarCollapsed ? <>
        <nav className="chat-sidebar-nav">
          <div className="chat-nav-items">
            <div className="chat-recents-trigger" ref={recentsRef} onMouseEnter={() => { const rect = recentsRef.current?.getBoundingClientRect(); if (rect) setRecentsPos({ top: rect.top, left: rect.right + 6 }); setRecentsHover(true); }} onMouseLeave={() => setRecentsHover(false)}>
              <button type="button" className="chat-nav-item" onClick={() => { setChatSearchOpen(true); setSidebarOpen(false); }}><FiMessageCircle /><span>Recents</span><FiChevronRight className="recents-chevron" /></button>
              {recentsHover && unpinnedConversations.length > 0 && <div className="chat-recents-flyout" role="menu" style={{ top: recentsPos.top, left: recentsPos.left }}>
                {unpinnedConversations.slice(0, 8).map((conv) => <button type="button" className="chat-recents-item" key={conv.id} onClick={() => { setWorkspaceView("chat"); switchConversation(conv.id); setRecentsHover(false); }}><FiMessageCircle /><span><strong>{conv.title}</strong><small>{new Date(conv.updated_at).toLocaleDateString()}</small></span></button>)}</div>}
            </div>
          </div>
        </nav>
        {pinnedConversations.length > 0 && <div className="chat-sidebar-section"><span className="chat-sidebar-label">PINNED</span>{pinnedConversations.map((conv) => <div className={`chat-conversation ${workspaceView === "chat" && conv.id === activeConversationId ? "active" : ""}`} key={conv.id}><button type="button" className="chat-conversation-select" onClick={() => { setWorkspaceView("chat"); switchConversation(conv.id); }} aria-label={`Open ${conv.title}`}><FiMessageCircle /><span><strong>{conv.title}</strong><small>{new Date(conv.updated_at).toLocaleDateString()}</small></span></button><button type="button" className="chat-conversation-pin" onClick={() => togglePin(conv.id)} aria-label="Unpin conversation"><FiEdit2 /></button><button type="button" className="chat-conversation-more" onClick={() => setConversationMenuId((current) => current === conv.id ? null : conv.id)} aria-label={`Conversation actions for ${conv.title}`} aria-expanded={conversationMenuId === conv.id}><FiMoreHorizontal /></button>{conversationMenuId === conv.id && <div className="chat-conversation-menu" role="menu"><button type="button" role="menuitem" onClick={() => renameConversation(conv.id, conv.title)}><FiEdit2 />Rename</button><button type="button" role="menuitem" onClick={() => togglePin(conv.id)}><FiEdit2 />Unpin</button><button type="button" className="chat-conversation-delete" role="menuitem" onClick={() => deleteConversation(conv.id)}><FiTrash2 />Delete</button></div>}</div>)}</div>}
        {projects.length > 0 && <div className="chat-sidebar-section"><span className="chat-sidebar-label">PROJECTS</span>{projects.map((project) => {
          const isOpen = workspaceView === "project" && activeProject?.id === project.id;
          return <div className="chat-project-group" key={project.id}><button type="button" className={`chat-project-link ${isOpen ? "active" : ""}`} onClick={() => openProject(project.id)}><FiFolder /><span><strong>{project.name}</strong></span></button></div>;
        })}</div>}
      </> : <>
        <nav>
          {pinnedConversations.length > 0 && <section className="chat-sidebar-group"><SidebarSectionHeader expanded={sidebarSections.pinned} onToggle={() => setSidebarSections((current) => ({ ...current, pinned: !current.pinned }))}>Pinned</SidebarSectionHeader>{sidebarSections.pinned && pinnedConversations.map((conv) => <SidebarConversation key={conv.id} conversation={conv} active={workspaceView === "chat" && conv.id === activeConversationId} pinned menuOpen={conversationMenuId === conv.id} onOpen={() => { setWorkspaceView("chat"); switchConversation(conv.id); }} onMenu={() => setConversationMenuId((current) => current === conv.id ? null : conv.id)} onRename={() => renameConversation(conv.id, conv.title)} onPin={() => togglePin(conv.id)} onDelete={() => deleteConversation(conv.id)} />)}</section>}
          <section className="chat-sidebar-group"><SidebarSectionHeader expanded={sidebarSections.projects} onToggle={() => setSidebarSections((current) => ({ ...current, projects: !current.projects }))}>Projects</SidebarSectionHeader>{sidebarSections.projects && (projects.length ? projects.map((project) => <button type="button" className={`chat-project-link ${workspaceView === "project" && activeProject?.id === project.id ? "active" : ""}`} key={project.id} onClick={() => openProject(project.id)}><FiFolder /><span><strong>{project.name}</strong></span></button>) : <p className="chat-sidebar-empty">No projects yet</p>)}</section>
          <section className="chat-sidebar-group"><SidebarSectionHeader expanded={sidebarSections.chats} onToggle={() => setSidebarSections((current) => ({ ...current, chats: !current.chats }))}>Chats</SidebarSectionHeader>{sidebarSections.chats && unpinnedConversations.map((conv) => <SidebarConversation key={conv.id} conversation={conv} active={workspaceView === "chat" && conv.id === activeConversationId} pinned={false} menuOpen={conversationMenuId === conv.id} onOpen={() => { setWorkspaceView("chat"); switchConversation(conv.id); }} onMenu={() => setConversationMenuId((current) => current === conv.id ? null : conv.id)} onRename={() => renameConversation(conv.id, conv.title)} onPin={() => togglePin(conv.id)} onDelete={() => deleteConversation(conv.id)} />)}</section>
        </nav>
      </>}
      <div className="chat-sidebar-spacer" />
      {sidebarCollapsed && <button type="button" className="chat-nav-item chat-bottom-settings" onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }} aria-label="Open settings"><FiSettings /><span>Settings</span></button>}
      <div className="chat-profile"><button className="chat-profile-settings" type="button" onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }} aria-label="Open account settings"><span>{userDisplayName.charAt(0).toUpperCase()}</span><div><strong>{userDisplayName}</strong><small>{user.email}</small></div></button><button type="button" onClick={signOut} aria-label="Log out"><FiLogOut /></button></div>
    </aside>
    <section className={`chat-workspace ${workspaceHasMessages ? "chat-workspace-thread" : "chat-workspace-empty"}`}>
      <header className="chat-topbar"><div className="chat-topbar-title"><button className="chat-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><FiMenu /></button>{(workspaceView === "chat" || workspaceView === "project-chat") && <div><strong>{workspaceView === "project-chat" ? activeProjectChat?.title || "Project chat" : conversationTitle}</strong><small>{workspaceView === "project-chat" ? activeProject?.name : "Saved automatically"}</small></div>}</div><div className="chat-topbar-actions"><span className={`chat-header-connection connection-${connection}`}><i />{connectionLabel}</span><Link href="/" aria-label="Back to website"><FiX /></Link></div></header>
      {chatSearchOpen && <div className="chat-search-overlay" role="dialog" aria-modal="true" aria-label="Search chats"><div className="chat-search-panel"><div className="chat-search-input"><FiSearch /><input autoFocus value={chatSearchQuery} onChange={(event) => setChatSearchQuery(event.target.value)} placeholder="Search chats" aria-label="Search chats" /><button type="button" onClick={() => { setChatSearchOpen(false); setChatSearchQuery(""); }} aria-label="Close chat search"><FiX /></button></div><p>{fullSearchStatus === "complete" && !matchingConversations.length ? "FULL SEARCH" : "CHATS"}</p>{displayedSearchResults.length ? <div className="chat-search-results">{displayedSearchResults.map((conversation) => <button type="button" key={conversation.id} onClick={() => { setWorkspaceView("chat"); switchConversation(conversation.id); setChatSearchOpen(false); setChatSearchQuery(""); }}><FiMessageCircle /><span><strong>{conversation.title}</strong>{conversation.match && <small className="chat-search-snippet">{conversation.match}</small>}</span><small>{new Date(conversation.updated_at).toLocaleDateString()}</small></button>)}</div> : chatSearchQuery.trim() ? <div className="chat-search-empty">{fullSearchStatus === "loading" ? "Searching every conversation…" : fullSearchStatus === "complete" ? "No matches in your conversations." : fullSearchStatus === "error" ? "Full search is unavailable. Try again." : <><span>No chat titles match “{chatSearchQuery.trim()}”.</span><button type="button" onClick={tryFullChatSearch}>Try full search</button><small>Search for this word in every conversation.</small></>}</div> : <div className="chat-search-empty">Start typing to search your chats.</div>}</div></div>}
      {workspaceView === "chat" ? <><div className="chat-scroll" ref={scrollRef} onScroll={(event) => { const node = event.currentTarget; const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 100; followLatestRef.current = nearBottom; setShowLatestButton(!nearBottom && messages.length > 0); }}>
        {messagesLoading ? <div className="chat-empty" role="status">Loading conversation…</div> : !messages.length ? <section className="chat-empty"><h1>What can I help with?</h1><div className="chat-starters">{CHAT_STARTERS.map((starter) => <button type="button" key={starter.title} onClick={() => { setDraft(starter.title); textareaRef.current?.focus(); }}><FiArrowRight aria-hidden="true" /><span>{starter.title}</span></button>)}</div>{error && <div className="chat-error" role="alert"><strong>Couldn’t start this chat</strong><p>{error}</p></div>}</section> : <div className="chat-thread" role="log" aria-live="polite" aria-relevant="additions text">{messages.map((message, index) => <article className={`chat-message chat-message-${message.role}`} key={message.id || `${message.role}-${index}`} aria-label={`${message.role === "assistant" ? "Jan" : "You"} message`}>
          {message.role === "assistant" && <span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span>}
          <div className="chat-message-body"><div className="chat-message-meta"><strong>{message.role === "assistant" ? "Jan" : userDisplayName}</strong><span>{message.role === "assistant" ? message.streaming ? "Writing" : "Personal assistant" : "You"}</span></div>{message.attachments && message.attachments.length > 0 && <div className="chat-message-attachments">{message.attachments.map((a, i) => <div className="chat-msg-attachment" key={i}>{a.type?.startsWith("image/") && a.preview ? <img src={a.preview} alt={a.name} /> : <span className="chat-msg-file"><FiFile />{a.name}</span>}</div>)}</div>}{message.role === "assistant" ? message.streaming && !message.content ? <div className="chat-streaming-wait" aria-label="Jan is thinking"><i /><i /><i /><span>Jan is thinking</span></div> : <div className={message.streaming ? "chat-streaming-copy" : ""}><Suspense fallback={<p className="chat-response-loading">Formatting response…</p>}><MessageResponse>{message.content}</MessageResponse></Suspense></div> : <p className="chat-user-copy">{message.content}</p>}{message.role === "assistant" && !message.streaming && <div className="chat-message-actions"><button type="button" onClick={() => copyMessage(message.content, index)} aria-label="Copy response">{copiedMessage === index ? <FiCheck /> : <FiCopy />}<span>{copiedMessage === index ? "Copied" : "Copy"}</span></button></div>}</div>
        </article>)}{error && <div className="chat-error" role="alert"><span>{error === "Response stopped." ? "RESPONSE STOPPED" : "CONNECTION ISSUE"}</span><p>{error}</p></div>}<div ref={endRef} /></div>}
      </div>
      {showLatestButton && workspaceHasMessages && <button type="button" className="chat-latest" onClick={() => { followLatestRef.current = true; setShowLatestButton(false); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "auto" }); }}><FiChevronDown /> Latest messages</button>}
      <div className="chat-composer-wrap">{persistenceNotice && <p className="chat-persistence-notice" role="status">{persistenceNotice}</p>}<form className={`chat-composer ${isDraggingFiles ? "chat-composer-drop-active" : ""}`} onSubmit={(event) => { event.preventDefault(); send(); }} onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setIsDraggingFiles(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDraggingFiles(false); }} onDrop={handleFileDrop}>
        <>{attachments.length > 0 && <div className="chat-attachments">{attachments.map((a, i) => <div className="chat-attachment" key={i}><div className="chat-attachment-preview">{a.type.startsWith("image/") ? <img src={a.preview} alt={a.name} /> : <FiFile />}<button type="button" onClick={() => removeAttachment(i)} aria-label="Remove file"><FiX /></button></div><span className="chat-attachment-name">{a.name}</span></div>)}</div>}{attachmentNotice && <p className="chat-attachment-notice">{attachmentNotice}</p>}{attachmentError && <p className="chat-attachment-error" role="alert">{attachmentError}</p>}
        <div className="chat-composer-input"><textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} placeholder={attachments.length ? "Add a message about your files..." : "Ask Jan anything..."} aria-label="Message Jan" rows="1" maxLength="4000" /></div>
        <div className="chat-composer-footer">
          <div className="chat-composer-tools">
            {!loading && <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} aria-label="Add photos, PDFs, or files" title="Add photos, PDFs, or files"><FiPlus /><span className="chat-attach-label">Add files</span></button>}
            <ModelPicker models={modelList} selected={selectedModel} details={MODEL_DISPLAY} open={modelMenuOpen} more={showMoreModels} pickerRef={modelMenuRef} onToggle={() => setModelMenuOpen((current) => !current)} onMore={setShowMoreModels} onSelect={(id) => { setSelectedModel(id); setModelMenuOpen(false); }} />
            <input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" onChange={handleFileSelect} hidden />
          </div>
          <div className="chat-composer-send"><kbd>{loading ? "Stop" : "↵ to send"}</kbd>{loading ? <button type="button" className="chat-stop-text" onClick={stopGenerating} aria-label="Stop response">Stop</button> : <button type="submit" disabled={messagesLoading || (!draft.trim() && !attachments.length)} aria-label="Send message"><FiSend /></button>}</div>
        </div></>
      </form><small>Jan can make mistakes. Check important information.</small></div></> : workspaceView === "project" && activeProject ? <section className="project-workspace project-overview">
        <header className="project-heading"><div><p>PROJECT</p><h1><FiMessageCircle />{activeProject.name}</h1></div><div className="project-heading-actions"><button type="button" className="project-share" onClick={() => setProjectNotice("Sharing is coming soon in this prototype.")}><FiUpload /> Share</button><button type="button" aria-label="Project actions"><FiMoreHorizontal /></button></div></header>
        <form className="project-composer project-overview-composer" onSubmit={(event) => { event.preventDefault(); sendProjectMessage(); }}><button type="button" className="project-plus" onClick={() => projectFileInputRef.current?.click()} aria-label="Add project files"><FiPlus /></button><textarea value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendProjectMessage(); } }} placeholder={`New chat in ${activeProject.name}`} aria-label={`New chat in ${activeProject.name}`} /><button type="submit" className="project-send" disabled={!projectDraft.trim() || projectSending} aria-label="Send project message">{projectSending ? <span className="project-send-spinner" /> : <FiSend />}</button></form>
        <nav className="project-tabs" aria-label="Project content"><button type="button" className={projectTab === "chats" ? "active" : ""} onClick={() => setProjectTab("chats")}>Chats</button><button type="button" className={projectTab === "sources" ? "active" : ""} onClick={() => setProjectTab("sources")}>Sources {activeProject.files?.length ? <span>{activeProject.files.length}</span> : null}</button></nav>
        {projectTab === "chats" ? <section className="project-chat-list" aria-label={`${activeProject.name} chats`}>{projectChats.length ? projectChats.map((chat) => <button type="button" className="project-chat-row" key={chat.id} onClick={() => openProjectChat(chat.id)}><div><strong>{chat.title}</strong><p>{chat.preview}</p></div><time>{chat.updated_at ? new Date(chat.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Now"}</time></button>) : <section className="project-empty-card"><FiMessageCircle /><h2>No chats in {activeProject.name} yet</h2><p>Start a new chat above to keep work in this project.</p></section>}{projectError && <p className="project-chat-error" role="alert">{projectError}</p>}</section> : <section className="project-sources"><header><div><strong>Sources</strong><span>Files Jan can use in this project</span></div><button type="button" onClick={() => projectFileInputRef.current?.click()}><FiUpload /> Add files</button></header>{activeProject.files?.length ? <ul className="project-file-list">{activeProject.files.map((file) => <li key={file.id}><FiFile /><span>{file.name}</span></li>)}</ul> : <button type="button" className="project-dropzone" onClick={() => projectFileInputRef.current?.click()}><FiFile /><span>Add PDFs, documents, or other text to reference in this project.</span></button>}</section>}
        <input ref={projectFileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" hidden onChange={(event) => { addProjectFiles(event.target.files); event.target.value = ""; }} />
        {projectNotice && <div className="project-toast" role="status"><FiCheck />{projectNotice}</div>}
      </section> : workspaceView === "project-chat" && activeProject ? <><div className="chat-scroll"><div className="chat-thread project-chat-thread" role="log" aria-live="polite"><button type="button" className="project-chat-back" onClick={() => { setWorkspaceView("project"); setProjectTab("chats"); }}><FiChevronLeft />{activeProject.name}</button>{(activeProjectChat?.messages || []).map((message, index) => <article className={`chat-message chat-message-${message.role}`} key={message.id || `${message.role}-${index}`} aria-label={`${message.role === "assistant" ? "Jan" : "You"} message`}>{message.role === "assistant" && <span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span>}<div className="chat-message-body"><div className="chat-message-meta"><strong>{message.role === "assistant" ? "Jan" : userDisplayName}</strong><span>{message.role === "assistant" ? "Personal assistant" : "You"}</span></div>{message.role === "assistant" ? <Suspense fallback={<p>{message.content}</p>}><MessageResponse>{message.content}</MessageResponse></Suspense> : <p className="chat-user-copy">{message.content}</p>}{message.role === "assistant" && <div className="chat-message-actions"><button type="button" onClick={() => navigator.clipboard?.writeText(message.content)} aria-label="Copy response"><FiCopy /> Copy</button></div>}</div></article>)}{projectSending && <article className="chat-message chat-message-assistant"><span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span><div className="chat-message-body"><div className="chat-message-meta"><strong>Jan</strong><span>Personal assistant</span></div><p className="chat-streaming-wait"><i /> Jan is thinking</p></div></article>}{projectError && <div className="chat-error" role="alert">{projectError}</div>}</div></div><div className="chat-composer-wrap"><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendProjectMessage(); }}><div className="chat-composer-input"><textarea value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendProjectMessage(); } }} placeholder={`Reply in ${activeProject.name}`} aria-label={`Reply in ${activeProject.name}`} /></div><div className="chat-composer-footer"><div className="chat-composer-tools"><button type="button" className="chat-attach-btn" onClick={() => projectFileInputRef.current?.click()} aria-label="Add files"><FiPlus /><span className="chat-attach-label">Add files</span></button><span className="chat-connection"><i />{projectSending ? "Jan is responding" : "Groq secured server-side"}</span></div><div className="chat-composer-send"><kbd>↵ to send</kbd><button type="submit" disabled={!projectDraft.trim() || projectSending} aria-label="Send message"><FiSend /></button></div></div></form><input ref={projectFileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" hidden onChange={(event) => { addProjectFiles(event.target.files); event.target.value = ""; }} /></div></> : workspaceView === "hub" ? <section className="hub-workspace"><header><p>HUB</p><h1>Plugins</h1><span>Work with Jan across your favorite tools.</span></header><label className="hub-search"><FiSearch /><input value={hubSearch} onChange={(event) => setHubSearch(event.target.value)} placeholder="Search plugins" aria-label="Search plugins" /></label><section className="hub-installed"><h2>Installed <FiChevronRight /></h2><div><span>✦</span><p>Jan tools<br /><small>Built-in workspace tools</small></p></div></section><section className="hub-popular"><h2>Popular</h2>{visiblePlugins.map((plugin) => { const Icon = plugin.icon; const installed = installedPlugins.includes(plugin.id); return <article key={plugin.id}><span className={`plugin-icon plugin-${plugin.tone}`}><Icon /></span><div><strong>{plugin.name}</strong><small>{plugin.copy}</small></div><button type="button" className={installed ? "installed" : ""} onClick={() => setInstalledPlugins((current) => installed ? current.filter((id) => id !== plugin.id) : [...current, plugin.id])} aria-label={`${installed ? "Remove" : "Install"} ${plugin.name}`}>{installed ? <FiCheck /> : <FiPlus />}</button></article>; })}{!visiblePlugins.length && <p className="hub-no-results">No plugins match that search.</p>}</section></section> : <section className="settings-workspace"><header><p>ACCOUNT</p><h1>Settings</h1><span>Manage your Jan workspace and account preferences.</span></header><section className="settings-account"><span>{userDisplayName.charAt(0).toUpperCase()}</span><div><strong>{userDisplayName}</strong><small>{user.email}</small></div><button type="button" onClick={signOut}>Log out <FiLogOut /></button></section><section className="settings-panel"><h2>Workspace</h2><label><span>Response streaming</span><input type="checkbox" defaultChecked /></label><label><span>Use the fastest free model when available</span><input type="checkbox" defaultChecked /></label><label><span>Model</span><button type="button" onClick={() => setModelMenuOpen(true)}>{MODEL_DISPLAY[selectedModel]?.name || selectedModel}<FiChevronRight /></button></label></section></section>}
    </section>
  </main>;
}
