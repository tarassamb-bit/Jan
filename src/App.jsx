import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
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
const MessageResponse = lazy(() => import("./components/ai-elements/MessageResponse").then((module) => ({ default: module.MessageResponse })));

const DOWNLOADS = [
  ["Mac", "97.9 MB", FaApple],
  ["Windows", "55.1 MB", FaWindows],
  ["Linux (Flatpak)", "", FaLinux],
  ["Linux (AppImage)", "150.2 MB", FaLinux],
  ["Linux (Deb)", "82.9 MB", FaLinux],
];

const DEMO_ACCOUNT = { name: "Alex", email: "demo@jan.local", password: "jan-demo-2026" };
const DEMO_USER_KEY = "jan-demo-user";
const DEMO_CONVERSATIONS_KEY = "jan-demo-conversations";
const PROJECTS_STORAGE_KEY = "jan-projects";

function readDemoUser() {
  try { return JSON.parse(window.localStorage.getItem(DEMO_USER_KEY) || "null"); } catch { return null; }
}

function readDemoConversations() {
  try { return JSON.parse(window.localStorage.getItem(DEMO_CONVERSATIONS_KEY) || "[]"); } catch { return []; }
}

function writeDemoConversations(conversations) {
  window.localStorage.setItem(DEMO_CONVERSATIONS_KEY, JSON.stringify(conversations));
}

function readProjects(userId) {
  try { return JSON.parse(window.localStorage.getItem(`${PROJECTS_STORAGE_KEY}-${userId || "guest"}`) || "[]"); } catch { return []; }
}

function writeProjects(userId, projects) {
  window.localStorage.setItem(`${PROJECTS_STORAGE_KEY}-${userId || "guest"}`, JSON.stringify(projects));
}

function demoMessagesKey(conversationId) {
  return `jan-demo-messages-${conversationId}`;
}

function readDemoMessages(conversationId) {
  try { return JSON.parse(window.localStorage.getItem(demoMessagesKey(conversationId)) || "[]"); } catch { return []; }
}

function makeConversationTitle(answer, fallback = "New conversation") {
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

const TESTIMONIALS = [
  { name: "Ivan Fioravanti", handle: "@ivanfioravanti", avatar: "/assets/profile-ivan.jpg", text: "Local AI in action: conducting private research at home. Local models are taking the lead." },
  { name: "Mariusz Kurman", handle: "@mkurman88", avatar: "/assets/profile-mariusz.jpg", text: "Jan makes open models feel approachable. A clean app, a local-first mindset, and no complicated setup." },
  { name: "The Mandorlarian", handle: "@mandorlarian", avatar: "/assets/profile-mandor.jpg", text: "Jan-V1 is seriously good. You don't need expensive closed models anymore for many tasks—open models have come a long way." },
  { name: "Anes Valentic", handle: "@Matrix_Memories", avatar: "/assets/profile-anes.jpg", text: "Jan is an amazing tool that is open source and you can deploy locally. If you haven't tried it already, do so." },
  { name: "Aster", handle: "@asterdotai", avatar: "/assets/profile-aster.jpg", text: "Open source, private, and running fully on your machine. No API bills, real-time answers, and your data stays with you." },
  { name: "levelsio", handle: "@levelsio", avatar: "/assets/profile-levels.jpg", text: "Local models are getting incredibly useful. Jan packages the whole experience in a way that feels familiar and fast." },
];

const MODELS = [
  ["ChatGPT", "OpenAI", "/assets/chatgpt.svg"],
  ["Claude", "Anthropic", "/assets/claude.svg"],
  ["Gemini", "Google", "/assets/gemini.svg"],
  ["Llama", "Meta", "/assets/meta.svg"],
  ["Mistral", "Mistral AI", "/assets/mistral.svg"],
  ["Qwen", "Alibaba", "/assets/qwen.svg"],
  ["DeepSeek", "DeepSeek", "/assets/deepseek.svg"],
  ["Gemma", "Google", "/assets/gemma.svg"],
  ["Kimi", "Moonshot AI", "/assets/kimi.svg"],
];

const DOC_PRODUCTS = [
  { title: "Jan Desktop", description: "The cowork-style desktop app — chat, models, MCP connectors, and local API server.", meta: "Quickstart · Models · CLI", href: "/docs/quickstart", icon: FiMonitor, tone: "blue" },
  { title: "Jan Agent", description: "The standalone agent, distributed separately — launch autonomous coding agents against a local model.", meta: "Quickstart · Skills · Memory", href: "/agent", icon: LuBot, tone: "yellow" },
  { title: "Tokamak", description: "Self-hosted router, fusion model, and governance/audit. Jan agents connect here for model switching.", meta: "Install · Connect an agent", href: "/tokamak", icon: LuBrainCircuit, tone: "green" },
];

const DOC_PATHS = [
  { title: "Desktop Quickstart", detail: "Install Jan, choose a local model, and start your first private conversation.", href: "/docs/quickstart", icon: LuRocket },
  { title: "Jan Agent Quickstart", detail: "Create a local agent, review its tools, and run a visible task plan.", href: "/agent", icon: FiCpu },
  { title: "Tokamak install", detail: "Bring up the mock self-hosted router and connect a desktop client.", href: "/tokamak", icon: FiGitBranch },
];

const RESEARCH_CATEGORIES = ["ALL", "REASONING", "INSTRUCT", "CODE", "VISION", "DEEP RESEARCH", "PERSONALITY", "EDGE"];
const RESEARCH_ITEMS = [
  { title: "Jan-v3.5-4B", description: "The first Jan personality — a 4B model fine-tuned for math reasoning with a distinct conversational identity.", date: "MARCH 20, 2026", tags: ["PERSONALITY", "REASONING", "VISION"], image: "/assets/jan-v3-5-4b-banner.png", href: "/research/jan-v3-5-4b", featured: true },
  { title: "Jan-Code-4B", description: "Lightweight 4B code-tuned model for fast local coding assistance and agentic workflows.", date: "MARCH 2, 2026", tags: ["CODE", "VISION"], image: "/assets/jan-code-4b.png" },
  { title: "Jan-v3-4B", description: "4B parameter instruct model distilled from a larger teacher, optimized as a fine-tuning base.", date: "JANUARY 19, 2026", tags: ["INSTRUCT", "VISION"], image: "/assets/jan-v3-4b.png" },
  { title: "Jan-v2-VL", description: "8B vision-language model for long-horizon agentic automation in real software environments.", date: "NOVEMBER 6, 2025", tags: ["VISION", "REASONING"], image: "/assets/jan-v2-vl.png" },
  { title: "Jan-v1", description: "4B parameter model with strong performance on reasoning benchmarks.", date: "AUGUST 8, 2025", tags: ["REASONING"], image: "/assets/jan-v1.png" },
  { title: "Jan Nano 128k", description: "Compact model with a 128k context window for long-document research and tool use.", date: "JUNE 25, 2025", tags: ["DEEP RESEARCH", "EDGE"], image: "/assets/jan-nano-128.png" },
  { title: "Jan Nano 32k", description: "Compact 32k-context model for fast local research and tool calling.", date: "JUNE 10, 2025", tags: ["DEEP RESEARCH", "EDGE"], image: "/assets/jan-nano-32.png" },
];

const DOC_ARTICLES = {
  "/docs/quickstart": {
    eyebrow: "JAN DESKTOP", title: "Desktop quickstart", summary: "Install the local prototype, add a model, and start a private conversation in a few minutes.",
    sections: [
      { id: "install", title: "1. Install Jan", body: "Choose the build for your operating system. This recreated site keeps downloads local and illustrative, so no official installer is fetched.", code: "# macOS (mock example)\nbrew install --cask jan" },
      { id: "model", title: "2. Add a model", body: "Open the model library and choose a model that fits your hardware. Smaller models start faster and use less memory.", note: "A 4B model is a practical first choice for most modern laptops." },
      { id: "chat", title: "3. Start a conversation", body: "Create a new thread, select the installed model, and send a message. Local conversations stay inside this prototype's workspace." },
    ],
  },
  "/docs/models": {
    eyebrow: "GUIDES", title: "Models and providers", summary: "Understand local models, optional cloud providers, and how to choose between them.",
    sections: [
      { id: "local", title: "Local models", body: "Local models run on your computer. They work offline after download and keep prompts close to your device.", note: "Check model size and memory requirements before downloading." },
      { id: "providers", title: "Connected providers", body: "A provider can expose additional hosted models through an API key. Keys in this prototype are never sent anywhere." },
      { id: "switch", title: "Switch the active model", body: "Use the model picker at the top of a thread. Each conversation remembers its selected model.", code: "Model → Library → Use model" },
    ],
  },
};

const RESEARCH_ARTICLES = {
  "/research/jan-v3-5-4b": {
    title: "Jan-v3.5-4B", kicker: "A compact reasoning model with a point of view.", date: "MARCH 20, 2026", tags: ["PERSONALITY", "REASONING", "VISION"], image: "/assets/jan-v3-5-4b-banner.png",
  },
};

const PAGE_DATA = {
  "/jan": {
    eyebrow: "Jan Desktop", title: "Your private AI workspace", accent: "blue",
    intro: "Chat with open models, organize projects, and keep your work on your own machine.",
    cards: [["Local by default", "Run compatible models on your computer and keep sensitive conversations close."], ["One calm workspace", "Bring chats, files, assistants, and model settings into a single focused app."], ["Open model choice", "Switch between local and cloud providers without changing how you work."]],
  },
  "/agent": {
    eyebrow: "Jan Agent", title: "An agent you can actually inspect", accent: "green",
    intro: "A transparent desktop agent for research, files, and repeatable workflows—mocked for this prototype.",
    cards: [["Plan visible work", "See the steps, files, and tools involved before an agent changes anything."], ["Run where you choose", "Use a local environment, a private server, or a connected provider."], ["Extend with skills", "Package repeatable instructions into skills your team can review and reuse."]],
  },
  "/tokamak": {
    eyebrow: "Tokamak", title: "The self-hosted AI engine", accent: "yellow",
    intro: "Route models, govern access, and serve private AI workloads behind one lightweight control plane.",
    cards: [["Smart routing", "Send each task to the model that best matches its speed, privacy, and quality needs."], ["Unified governance", "Manage providers, audit activity, and control access from one place."], ["Built for teams", "Connect desktop clients and internal tools to a shared, self-hosted backend."]],
  },
  "/research": {
    eyebrow: "Research", title: "Open work on personal intelligence", accent: "lilac",
    intro: "Notes, experiments, and prototype findings from a fictional local-first AI research team.",
    cards: [["Small models, useful tools", "How compact models can coordinate search, files, and structured tasks on-device."], ["Memory without surveillance", "Design patterns for useful context that stays understandable and user-controlled."], ["Evaluating local agents", "A practical benchmark for reliability, latency, and recoverable mistakes."]],
  },
  "/docs": {
    eyebrow: "Documentation", title: "Start building with Jan", accent: "blue",
    intro: "Prototype documentation for installing the app, connecting models, and creating a private AI workflow.",
    cards: [["Quickstart", "Install the demo, choose a model, and send your first local prompt in a few minutes."], ["Models & providers", "Learn how local engines and optional cloud providers fit into one model library."], ["Projects & files", "Group conversations, attach working documents, and keep context organized."], ["Local API", "Use an OpenAI-compatible mock endpoint from scripts and development tools."], ["Agent tools", "Understand permissions, tool calls, and visible approval states."], ["Troubleshooting", "Resolve common model, storage, and startup issues in the prototype."]],
  },
  "/company": {
    eyebrow: "Company", title: "AI should answer to people", accent: "green",
    intro: "A mock company page for a small, open team building private and understandable AI tools.",
    cards: [["Open by default", "We share the work, invite scrutiny, and make the product easier to understand."], ["Privacy is product quality", "Useful software should not require people to surrender their private work."], ["Build in public", "Progress, trade-offs, and mistakes are easier to improve when they are visible."]],
  },
  "/about": {
    eyebrow: "About us", title: "A tiny team with a big local-first idea", accent: "yellow",
    intro: "This is realistic mock content created for the clone—not information from Jan's official website.",
    cards: [["Distributed", "A fictional team working across product, systems, community, and research."], ["Independent", "Focused on durable open tools instead of a closed platform."], ["Human scale", "Simple decisions, direct communication, and software people can own."]],
  },
  "/careers": {
    eyebrow: "Careers", title: "Help make private AI ordinary", accent: "lilac",
    intro: "Mock openings for people who care about craft, open systems, and thoughtful user experiences.",
    cards: [["Product Engineer", "Build fast, calm desktop experiences across models, files, and local services."], ["AI Systems Engineer", "Improve inference, routing, evaluation, and reliability for open models."], ["Developer Educator", "Turn complex local AI concepts into useful examples and clear documentation."]],
  },
  "/handbook": {
    eyebrow: "Handbook", title: "How this mock team works", accent: "green",
    intro: "A lightweight, fictional handbook covering principles, decisions, and everyday collaboration.",
    cards: [["Write decisions down", "Give context, name the trade-off, and leave a path for future revision."], ["Prefer small loops", "Ship understandable increments and learn from real use quickly."], ["Protect focus", "Use fewer meetings, clear ownership, and generous async communication."]],
  },
  "/blog": {
    eyebrow: "Blog", title: "Notes from the workshop", accent: "yellow",
    intro: "Mock stories about building local AI products, open model infrastructure, and better agent interfaces.",
    cards: [["The quiet interface", "Why local AI software should feel more like a toolbench than a casino."], ["A model router in plain language", "What routing changes for teams with mixed local and hosted models."], ["Designing permission prompts", "How to ask for approval without interrupting every useful action."]],
  },
  "/changelog": {
    eyebrow: "Changelog", title: "What’s new in the prototype", accent: "blue",
    intro: "A fictional release log demonstrating how this self-contained site could publish product updates.",
    cards: [["v0.8.4 · Search & templates", "Added native web search, per-model templates, and a cleaner settings store."], ["v0.8.3 · Branching", "Added message branches, artifact previews, and more consistent desktop controls."], ["v0.8.2 · Faster startup", "Improved launch time, resumable model downloads, and hardware detection."]],
  },
  "/api": {
    eyebrow: "API Reference", title: "A familiar local endpoint", accent: "lilac",
    intro: "Mock API documentation for connecting scripts and apps to a local OpenAI-compatible service.",
    code: "curl http://localhost:1337/v1/chat/completions \\\n  -H 'Content-Type: application/json' \\\n  -d '{ \"model\": \"local-model\", \"messages\": [...] }'",
    cards: [["Chat completions", "Send messages and stream a response from the selected model."], ["Model library", "List installed models and inspect their basic capabilities."], ["Health", "Check whether the local service and active inference engine are ready."]],
  },
  "/community": {
    eyebrow: "Community", title: "Build the open future together", accent: "green",
    intro: "A local mock community hub for releases, events, contributors, and shared model experiments.",
    cards: [["Weekly build log", "A concise roundup of shipped work, open questions, and ways to help."], ["Contributor lab", "Small scoped projects for documentation, design, testing, and engineering."], ["Model club", "Compare open models on useful everyday tasks and share reproducible results."]],
  },
  "/download": {
    eyebrow: "Download", title: "Choose your platform", accent: "blue", downloads: true,
    intro: "Demo download choices for this prototype. Buttons show the intended states without fetching official installers.", cards: [],
  },
};

function Link({ href, onClick, children, ...props }) {
  return <a href={href} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || !href?.startsWith("/")) return;
    event.preventDefault();
    window.history.pushState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }} {...props}>{children}</a>;
}

function navigate(href) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? readDemoUser());
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? readDemoUser());
      setLoading(false);
    });
    const handleDemoAuth = () => { setUser(readDemoUser()); setLoading(false); };
    window.addEventListener("jan:demo-auth", handleDemoAuth);
    return () => { subscription.unsubscribe(); window.removeEventListener("jan:demo-auth", handleDemoAuth); };
  }, []);
  return { user, loading };
}

function requestAuth(mode = "signup") {
  window.dispatchEvent(new CustomEvent("jan:open-auth", { detail: { mode } }));
}

function AuthModal({ initialMode, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeys = (event) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const focusable = modalRef.current?.querySelectorAll("button, input");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeys);
    return () => { window.removeEventListener("keydown", handleKeys); document.body.style.overflow = previousOverflow; };
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() || email.split("@")[0] } },
        });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
      }
      onClose();
      navigate("/chat");
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const useDemo = () => { window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify({ id: "jan-demo", email: DEMO_ACCOUNT.email, user_metadata: { display_name: DEMO_ACCOUNT.name }, is_demo: true })); window.dispatchEvent(new CustomEvent("jan:demo-auth")); onClose(); navigate("/chat"); };
  return <div className="auth-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={modalRef} className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description"><button className="auth-close" type="button" onClick={onClose} aria-label="Close account dialog"><FiX /></button><div className="auth-mark"><img src="/assets/logo-jan.svg" alt="" /></div><span className="auth-eyebrow">PERSONAL INTELLIGENCE</span><h2 id="auth-title">{mode === "signup" ? "Create your Jan account" : "Welcome back"}</h2><p id="auth-description">{mode === "signup" ? "One private workspace for your conversations." : "Continue to your personal workspace."}</p>{mode === "login" && <button className="demo-account" type="button" onClick={useDemo}><span><b>LOCAL DEMO</b><small>{DEMO_ACCOUNT.name} · no sign-up needed</small></span><strong>Try demo</strong></button>}<form onSubmit={submit}>{mode === "signup" && <label><span>Name</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>}<label><span>Email</span><input autoFocus={mode === "login"} required type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" autoComplete="email" /></label><label><span>Password</span><input required minLength="6" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="At least 6 characters" autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}<FiArrowRight /></button></form><small>Your password is securely stored with Supabase. We never see it.</small><button className="auth-switch" type="button" onClick={() => { setMode((value) => value === "signup" ? "login" : "signup"); setError(""); }}>{mode === "signup" ? "Already have an account? Log in" : "New to Jan? Create an account"}</button></section></div>;
}

function Brand({ light = false }) {
  return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="Jan home"><img src="/assets/logo-jan.svg" alt="" /><strong>Jan</strong></Link>;
}

function Header({ home = false, showSearch = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [authMode, setAuthMode] = useState(null);
  const { user } = useUser();
  useEffect(() => { const check = () => setScrolled(window.scrollY > 24); check(); window.addEventListener("scroll", check, { passive: true }); return () => window.removeEventListener("scroll", check); }, []);
  useEffect(() => { document.body.style.overflow = mobileOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);
  useEffect(() => {
    const open = (event) => setAuthMode(event.detail?.mode || "signup");
    window.addEventListener("jan:open-auth", open);
    return () => window.removeEventListener("jan:open-auth", open);
  }, []);
  const matches = (label) => !search || label.toLowerCase().includes(search.toLowerCase());
  const close = () => setMobileOpen(false);
  const light = home && !scrolled;
  const companyItems = [["Changelog", "/changelog"], ["Blog", "/blog"], ["About Us", "/about"], ["Careers", "/careers"], ["Handbook", "/handbook"]];
  return <>
    <header className={`site-header ${light ? "header-light" : "header-solid"} ${showSearch ? "with-search" : ""}`}>
      <Brand light={light} />
      <nav className="desktop-nav" aria-label="Primary navigation">
        <Link href="/jan">Jan <FiChevronDown /></Link><Link href="/tokamak">Tokamak</Link><Link href="/research">Research</Link><Link href="/docs">Docs</Link>
        <span className="company-wrap"><button type="button" onClick={() => setCompanyOpen((open) => !open)} aria-expanded={companyOpen}>Company <FiChevronDown /></button>{companyOpen && <span className="company-menu"><Link href="/about">About Us</Link><Link href="/careers">Careers</Link><Link href="/handbook">Handbook</Link><Link href="/changelog">Changelog</Link></span>}</span>
      </nav>
      <div className="header-actions">{showSearch && <Link className="header-search" href="/docs"><FiSearch /><span>Search docs...</span><kbd>⌘K</kbd></Link>}{user ? <Link className="header-account" href="/chat"><span className="account-avatar">{user.name?.charAt(0).toUpperCase()}</span><span className="account-label">Open Jan</span></Link> : <div className="header-auth"><button type="button" onClick={() => setAuthMode("login")}>Log in</button><button type="button" onClick={() => setAuthMode("signup")}>Sign up</button></div>}<div className="header-socials"><Link href="/community" aria-label="Discord"><FaDiscord /></Link><Link href="/community" aria-label="X"><FaXTwitter /></Link><Link href="/company" aria-label="LinkedIn"><FaLinkedinIn /></Link><Link href="/community" aria-label="GitHub"><FaGithub /></Link></div><button className="mobile-menu-button" type="button" onClick={() => setMobileOpen(true)} aria-label="Toggle mobile menu">{mobileOpen ? <FiX /> : <FiMenu />}</button></div>
    </header>
    {mobileOpen && <div className="mobile-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><aside className="mobile-drawer" aria-label="Mobile navigation">
      <div className="drawer-head"><h2>Jan</h2><button type="button" onClick={close} aria-label="Close menu"><FiX /></button></div>
      <label className="drawer-search"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search docs..." aria-label="Search documentation" /></label>
      <nav>
        {matches("Jan") && <div className="drawer-group"><Link href="/jan" onClick={close}>Jan</Link>{matches("Jan Desktop") && <Link className="drawer-child" href="/jan" onClick={close}>Jan Desktop</Link>}{matches("Jan Agent") && <Link className="drawer-child" href="/agent" onClick={close}>Jan Agent</Link>}</div>}
        {[["Tokamak", "/tokamak"], ["Research", "/research"], ["Docs", "/docs"]].filter(([label]) => matches(label)).map(([label, href]) => <Link href={href} onClick={close} key={label}>{label}</Link>)}
        {matches("Company") && <div className="drawer-group"><Link href="/company" onClick={close}>Company</Link>{companyItems.filter(([label]) => matches(label)).map(([label, href]) => <Link className="drawer-child" href={href} onClick={close} key={label}>{label}</Link>)}</div>}
      </nav>
      <div className="drawer-socials"><Link href="/community" aria-label="Discord"><FaDiscord /></Link><Link href="/community" aria-label="X"><FaXTwitter /></Link><Link href="/company" aria-label="LinkedIn"><FaLinkedinIn /></Link><Link href="/community" aria-label="GitHub"><FaGithub /></Link></div>
      {user ? <Link className="drawer-account" href="/chat" onClick={close}><FiMessageCircle /> Open Jan</Link> : <div className="drawer-auth"><button type="button" onClick={() => { close(); setAuthMode("login"); }}>Log in</button><button type="button" onClick={() => { close(); setAuthMode("signup"); }}>Sign up</button></div>}
    </aside></div>}
    {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />}
  </>;
}

function DownloadControl({ compact = false }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const select = (label) => { setNotice(`${label} demo selected`); setOpen(false); };
  return <div className={`download-block ${compact ? "download-footer" : ""}`}><div className="download-wrap"><div className="download-control pressed"><button type="button" className="download-main" onClick={() => setOpen(true)}><FaApple /><span>Download for Mac</span></button><button type="button" className="download-toggle" onClick={() => setOpen((value) => !value)} aria-label="Choose download platform" aria-expanded={open}><LuChevronsUpDown /></button></div>{open && <div className={`download-menu ${compact ? "download-menu-up" : ""}`}>{DOWNLOADS.map(([label, size, Icon]) => <button className="download-option" type="button" onClick={() => select(label)} key={label}><span className="download-label"><Icon /><span>Download for {label}</span></span><strong>{size}</strong></button>)}</div>}</div>{!compact && <div className="download-count">+6.6M downloads</div>}{notice && <span className="download-notice" role="status">{notice}</span>}</div>;
}

function AccountCtas({ compact = false }) {
  const { user } = useUser();
  if (user) return <Link className={`account-primary pressed ${compact ? "account-primary-compact" : ""}`} href="/chat"><FiMessageCircle />Open Jan</Link>;
  return <div className={`account-ctas ${compact ? "account-ctas-compact" : ""}`}><button className="account-primary pressed" type="button" onClick={() => requestAuth("signup")}>Sign up free<FiArrowRight /></button><button className="account-secondary" type="button" onClick={() => requestAuth("login")}>Log in</button></div>;
}

function Hero() {
  return <><section className="hero"><div className="hero-copy"><Link className="release-pill" href="/changelog"><span>NEW</span><b>✨ Your private AI workspace is ready.</b></Link><div className="hero-title"><img className="hero-wave" src="/assets/logo-jan.svg" alt="Logo Jan" /><h1>Meet Jan</h1></div><p>Personal Intelligence that answers only to you</p><div className="hero-actions"><AccountCtas /><Link className="community-button pressed" href="/community"><FaDiscord className="discord-color" /><span>Join community</span><small><FaUsers />15k+</small></Link></div></div><img className="flying-robot" src="/assets/cute-robot-flying.png" alt="A cheerful flying robot" /></section><img className="app-preview" src="/assets/app-jan.png" alt="Jan App Interface" /></>;
}

function Ecosystem() {
  return <section className="ecosystem"><h2>An open model ecosystem</h2><div className="ecosystem-grid"><article className="outline-card"><h3>Jan Agent</h3><p>The core agent, distributed separately — run it on your own VM or container.</p><Link className="outline-button pressed" href="/agent">Install Jan Agent</Link></article><article className="outline-card"><h3>Tokamak</h3><p>Router, fusion model, and governance/audit — the self-hosted backend Jan agents connect to.</p><Link className="outline-button pressed" href="/tokamak">Explore Tokamak</Link></article></div></section>;
}

function Testimonials() {
  const [slide, setSlide] = useState(0);
  return <section className="testimonials"><h2>Over 4 million downloads</h2><div className="carousel-window"><div className="testimonial-track" style={{ "--slide": slide }}>{[...TESTIMONIALS, ...TESTIMONIALS].map((item, index) => <article className="testimonial" key={`${item.name}-${index}`}><div className="testimonial-head"><img src={item.avatar} alt="" /><span><strong>{item.name}</strong><small>{item.handle}</small></span><FaXTwitter /></div><p>{item.text}</p></article>)}</div></div><div className="carousel-controls"><button type="button" aria-label="Previous testimonials" onClick={() => setSlide((value) => Math.max(0, value - 1))}><FiArrowLeft /></button><button type="button" aria-label="Next testimonials" onClick={() => setSlide((value) => (value + 1) % 6)}><FiArrowRight /></button></div></section>;
}

function CommunityPanel() {
  return <section className="community-panel"><div className="community-copy"><h2>Jan is built in public</h2><p>We believe AI should be open, and grow<br /> through the people who build and use it</p><div className="community-stats"><Link className="stat-card stat-github pressed" href="/community"><span className="stat-icon"><FaGithub /></span><span><b>GitHub</b><small>44.5K stars</small></span></Link><Link className="stat-card stat-discord pressed" href="/community"><span className="stat-icon"><FaDiscord /></span><span><b>Discord</b><small>1.5K Online</small></span></Link><Link className="stat-card stat-hugging pressed" href="/research"><span className="stat-icon"><img src="/assets/huggingface.svg" alt="" /></span><span><b>HuggingFace</b><small>123 models</small></span></Link></div></div><img className="mountain-robot" src="/assets/cute-robot-bg-mountain.png" alt="A person assembling a friendly robot" /></section>;
}

function ModelGrid() { return <div className="model-grid">{MODELS.map(([name, maker, image]) => <div className="model" key={name}><img src={image} alt={name} /><strong>{name}</strong><span>{maker}</span></div>)}</div>; }
function NumberBadge({ children }) { return <span className="number-badge">{children}</span>; }

function Tools() {
  const memory = ["Minimalist UI tasted", "Currently on a portfolio refresh", "Wants brief, to-the-point answers", "Frequent Figma/prototyping questions", "Dark-mode sharer", "Curious about type trends (Mostly harmless)"];
  return <section className="tools"><div className="tools-inner"><h2>All the tools you need<br className="desktop-only" /> to make Jan yours</h2><div className="tool-row models-row"><div className="tool-copy"><NumberBadge>1</NumberBadge><h3>Models</h3><p>Choose from open models or plug in your favorite online models.</p></div><ModelGrid /></div><div className="tool-row memory-row"><div className="tool-copy"><NumberBadge>2</NumberBadge><h3>Memory <span>Coming Soon</span></h3><p>Your context carries over, so you don’t repeat yourself. Jan remembers your context and preferences.</p></div><div className="memory-cards" aria-label="Example memory card"><div className="memory-card-stack"><div className="memory-card-shadow memory-lilac" /><div className="memory-card-shadow memory-mint" /><article className="memory-card"><div className="memory-person"><img src="/assets/avatar.png" alt="Joe's avatar" /><div><h4>Joe</h4><p>Designer, Singapore</p></div></div><h5>Things Jan keeps in mind</h5><ul>{memory.map((item) => <li key={item}><b>•</b><span>{item}</span></li>)}</ul></article></div></div></div></div></section>;
}

function FinalCta() { return <section className="final-cta"><div className="final-cta-top"><h2>Ask Jan anything</h2><div><AccountCtas compact /><p>Your private workspace, ready in the browser.</p></div></div><img src="/assets/cute-robot-flying.png" alt="Jan flying through the clouds" /></section>; }

function Footer() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false);
  const submit = (event) => { event.preventDefault(); if (email.trim()) setSent(true); };
  return <footer><div className="footer-main"><div className="footer-brand"><Brand /><h3><FiMail /> Subscribe to our newsletter</h3><form onSubmit={submit}><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" aria-label="Enter your email" /><button type="submit">Submit</button></form>{sent && <p role="status">Thanks — you’re on the list.</p>}</div><div className="footer-column"><h3>Company</h3><Link href="/careers">Careers</Link><Link href="/community">Discord</Link><Link href="/community">GitHub</Link><Link href="/company">LinkedIn</Link><Link href="/community">X</Link></div><div className="footer-column"><h3>Resources</h3><Link href="/blog">Blog</Link><Link href="/docs">Docs</Link><Link href="/changelog">Changelog</Link><Link href="/api">API Reference</Link></div></div></footer>;
}

function Home() { return <><Header home /><main className="home-page"><Hero /><Ecosystem /><Testimonials /><CommunityPanel /><Tools /><FinalCta /></main><Footer /></>; }

function DownloadCards() {
  const [choice, setChoice] = useState("");
  return <div className="platform-grid">{DOWNLOADS.slice(0, 3).map(([label, size, Icon]) => <button type="button" className="platform-card pressed" key={label} onClick={() => setChoice(label)}><Icon /><span><b>{label}</b><small>{size || "Available through the package manager"}</small></span><FiArrowRight /></button>)}{choice && <p className="platform-note" role="status">{choice} demo selected. No official installer was requested.</p>}</div>;
}

function DocsPage() {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const normalized = query.trim().toLowerCase();
  const products = DOC_PRODUCTS.filter((item) => !normalized || `${item.title} ${item.description} ${item.meta}`.toLowerCase().includes(normalized));
  const paths = DOC_PATHS.filter((item) => !normalized || `${item.title} ${item.detail}`.toLowerCase().includes(normalized));
  return <><Header showSearch /><main className="docs-page"><section className="docs-hero"><div className="docs-title"><img src="/assets/logo-jan.svg" alt="" /><h1>Jan Docs</h1></div><p>References for Jan Desktop, Jan Agent, and Tokamak.</p><label className="docs-search"><FiSearch /><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search docs..." aria-label="Search local documentation" /><kbd>⌘K</kbd></label></section><section className="docs-products" aria-label="Documentation products">{products.map(({ title, description, meta, href, icon: Icon, tone }) => <Link href={href} className="docs-product-card" key={title}><span className={`docs-icon docs-icon-${tone}`}><Icon /></span><h2>{title}</h2><p>{description}</p><span className="docs-card-foot"><small>{meta}</small><b>Read docs <FiArrowRight /></b></span></Link>)}</section>{!products.length && !paths.length ? <div className="docs-empty" role="status"><FiBookOpen /><h2>No matching guide yet</h2><p>Try “models,” “agent,” or “install.”</p><button type="button" onClick={() => setQuery("")}>Clear search</button></div> : <section className="docs-common"><h2>COMMON PATHS</h2><div>{paths.map(({ title, detail, href, icon: Icon }) => <Link href={href} className="docs-path" key={title}><span><Icon /></span><b>{title}</b><p>{detail}</p><FiArrowRight /></Link>)}</div></section>}</main><Footer /></>;
}

function ResearchMeta({ item }) {
  return <div className="research-meta">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}<time>{item.date}</time></div>;
}

function ResearchEntry({ item, featured = false }) {
  const content = <><div className="research-image-wrap"><img src={item.image} alt={item.title} /></div><div className={featured ? "research-feature-copy" : "research-card-copy"}>{featured && <ResearchMeta item={item} />}<h2>{item.title}</h2><p>{item.description}</p>{!featured && <ResearchMeta item={item} />}{item.href && <span className="research-entry-link">READ RESEARCH <FiArrowRight /></span>}</div></>;
  if (item.href) return <Link href={item.href} className={featured ? "research-feature" : "research-card"}>{content}</Link>;
  return <article className={featured ? "research-feature" : "research-card"}>{content}</article>;
}

function ResearchPage() {
  const [category, setCategory] = useState("ALL");
  const [loaded, setLoaded] = useState(false);
  const filtered = RESEARCH_ITEMS.filter((item) => category === "ALL" || item.tags.includes(category));
  const featured = filtered[0];
  const cards = filtered.slice(1);
  const categoryRows = [RESEARCH_CATEGORIES.slice(0, 3), RESEARCH_CATEGORIES.slice(3, 6), RESEARCH_CATEGORIES.slice(6)];
  return <><Header showSearch /><main className="research-page"><section className="research-top"><h1>Research</h1><div className="research-filters" role="tablist" aria-label="Research categories">{categoryRows.map((row, rowIndex) => <span className="research-filter-row" key={rowIndex}>{row.map((item) => <button type="button" role="tab" aria-selected={category === item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setLoaded(false); }} key={item}>{item}</button>)}</span>)}</div></section>{featured ? <section className="research-results" key={category}><ResearchEntry item={featured} featured /><div className="research-grid">{cards.map((item) => <ResearchEntry item={item} key={item.title} />)}</div><div className="research-load"><button type="button" onClick={() => setLoaded(true)} disabled={loaded}>{loaded ? "ALL RESEARCH LOADED" : "LOAD MORE"}</button>{loaded && <p role="status">You’re viewing every local research brief.</p>}</div></section> : <section className="research-empty" role="status"><h2>No research in this category yet.</h2><button type="button" onClick={() => setCategory("ALL")}>Show all research</button></section>}</main><Footer /></>;
}

function DocArticlePage({ article }) {
  return <><Header showSearch /><main className="article-page docs-article-page"><div className="article-shell"><aside className="article-sidebar"><Link href="/docs"><FiArrowLeft /> All documentation</Link><p>{article.eyebrow}</p>{article.sections.map((section) => <a href={`#${section.id}`} key={section.id}>{section.title.replace(/^\d\. /, "")}</a>)}</aside><article className="article-body"><div className="article-breadcrumb"><Link href="/docs">Docs</Link><span>/</span><span>{article.title}</span></div><header className="article-head"><span>{article.eyebrow}</span><h1>{article.title}</h1><p>{article.summary}</p></header>{article.sections.map((section) => <section id={section.id} className="article-section" key={section.id}><h2>{section.title}</h2><p>{section.body}</p>{section.note && <aside className="article-note"><strong>NOTE</strong><p>{section.note}</p></aside>}{section.code && <pre><code>{section.code}</code></pre>}</section>)}<nav className="article-next"><span>NEXT</span><Link href={article.title === "Desktop quickstart" ? "/docs/models" : "/research"}>{article.title === "Desktop quickstart" ? "Models and providers" : "Explore research"}<FiArrowRight /></Link></nav></article></div></main><Footer /></>;
}

function ResearchArticlePage({ article }) {
  return <><Header showSearch /><main className="article-page research-article-page"><article><Link href="/research" className="article-back"><FiArrowLeft /> RESEARCH</Link><header className="research-article-head"><ResearchMeta item={article} /><h1>{article.title}</h1><p>{article.kicker}</p></header><div className="research-article-visual"><img src={article.image} alt={article.title} /><span>LOCAL MODEL · 4B PARAMETERS</span></div><div className="research-story"><aside><span>RESEARCH NOTE 01</span><p>Prototype publication<br />Local-first evaluation</p></aside><div><p className="research-lede">What happens when a small reasoning model is tuned for both capability and character?</p><p>Jan-v3.5-4B is a fictional research brief built for this local recreation. It explores a compact model that can reason through multi-step tasks while preserving a clear, conversational voice.</p><h2>Small enough to belong to you</h2><p>The working target is simple: useful reasoning on everyday hardware. A compact model lowers startup time, reduces memory pressure, and makes private experimentation easier.</p><blockquote>Personality should make a model easier to work with—not less predictable.</blockquote><h2>Evaluation, not spectacle</h2><p>We test instruction following, visual grounding, mathematical reasoning, and recovery after an incorrect first attempt. The results shown here are mock data and are not official Jan benchmarks.</p><div className="metric-row"><div><strong>4B</strong><span>PARAMETERS</span></div><div><strong>128K</strong><span>CONTEXT</span></div><div><strong>LOCAL</strong><span>RUNTIME</span></div></div></div></div></article></main><Footer /></>;
}

const CHAT_STARTERS = [
  { eyebrow: "PLAN", title: "Plan a focused workday", copy: "Turn priorities into a calm, realistic schedule." },
  { eyebrow: "LEARN", title: "Explain a difficult idea simply", copy: "Break down a complex topic without the jargon." },
  { eyebrow: "WRITE", title: "Help me draft a thoughtful message", copy: "Find the right words, tone, and structure." },
];

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_ATTACHMENT_CHARS = 6_000;
const MAX_ATTACHMENTS = 6;
const MAX_IMAGES_PER_MESSAGE = 3;
const VISION_MODEL = "qwen/qwen3.8-27b";

function clampAttachmentText(value) {
  const text = String(value || "").replace(/\u0000/g, "").trim();
  return text.length > MAX_ATTACHMENT_CHARS ? `${text.slice(0, MAX_ATTACHMENT_CHARS)}\n\n[File excerpt truncated]` : text;
}

async function extractAttachment(file) {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const base = { name: file.name, type: file.type || (isPdf ? "application/pdf" : "text/plain"), size: file.size };

  if (file.type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} is larger than the 3 MB image limit.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return { ...base, preview: URL.createObjectURL(file), dataUrl: `data:${base.type};base64,${btoa(binary)}`, content: `[Image attached: ${file.name}]`, vision: true };
  }

  if (isPdf) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useWorkerFetch: false, isEvalSupported: false }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 20); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push(textContent.items.map((item) => item.str).join(" "));
    }
    const content = clampAttachmentText(pages.join("\n\n"));
    if (!content) throw new Error(`${file.name} has no selectable text.`);
    return { ...base, content: `[PDF: ${file.name}]\n${content}` };
  }

  const acceptedText = file.type.startsWith("text/") || /\.(md|txt|csv|json|js|jsx|ts|tsx|py|html|css|xml|yaml|yml)$/i.test(file.name);
  if (!acceptedText) throw new Error(`${file.name} is not a supported text, image, or PDF file.`);
  return { ...base, content: `[File: ${file.name}]\n${clampAttachmentText(await file.text())}` };
}

function ChatPage() {
  const { user, loading: authLoading } = useUser();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("checking");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem("jan-sidebar-collapsed") === "true");
  const [selectedModel, setSelectedModel] = useState("openai/gpt-oss-20b");
  const [modelList, setModelList] = useState([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [conversationMenuId, setConversationMenuId] = useState(null);
  const [workspaceView, setWorkspaceView] = useState("chat");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [fullSearchResults, setFullSearchResults] = useState([]);
  const [fullSearchStatus, setFullSearchStatus] = useState("idle");
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectNotice, setProjectNotice] = useState("");
  const [hubSearch, setHubSearch] = useState("");
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentNotice, setAttachmentNotice] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const modelMenuRef = useRef(null);
  const abortControllerRef = useRef(null);
  const creatingConversationRef = useRef(null);

  // Load conversations when user is available
  useEffect(() => {
    if (!user) return;
    if (user.is_demo) { setConversations(readDemoConversations()); return; }
    const loadConversations = async () => {
      const { data } = await supabase.from("conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (data) setConversations(data);
    };
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setProjects(readProjects(user.id || user.email));
  }, [user]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return; }
    if (creatingConversationRef.current === activeConversationId) return;
    if (user?.is_demo) { setMessages(readDemoMessages(activeConversationId)); return; }
    const loadMessages = async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", activeConversationId).order("created_at", { ascending: true });
      if (data) setMessages(data.map((m) => ({ role: m.role, content: m.content, id: m.id, attachments: m.attachments || [] })));
    };
    loadMessages();
  }, [activeConversationId, user]);

  useEffect(() => {
    const scrollConversation = () => scrollRef.current?.scrollTo({ top: messages.length ? scrollRef.current.scrollHeight : 0, behavior: messages.length ? "smooth" : "auto" });
    window.requestAnimationFrame(scrollConversation);
    const settleTimer = window.setTimeout(scrollConversation, 850);
    return () => window.clearTimeout(settleTimer);
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
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setChatSearchOpen(true);
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
    const { data, error: attachmentSaveError } = await supabase.from("messages").insert(payload).select().single();
    if (!attachmentSaveError) return data;
    const { data: fallback } = await supabase.from("messages").insert({ conversation_id: conversationId, role, content }).select().single();
    return fallback;
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
    if (!content && !attachments.length) return;
    if (loading) return;

    let convId = activeConversationId;
    const isFirstMessage = messages.length === 0;
    if (!convId) {
      const conv = await createConversation("New conversation");
      if (!conv) return;
      convId = conv.id;
      creatingConversationRef.current = convId;
      setActiveConversationId(convId);
    }

    const displayContent = content || (attachments.length ? `Uploaded ${attachments.length} file${attachments.length === 1 ? "" : "s"}` : "");
    const activeAttachments = attachments;
    const userMsg = { role: "user", content: displayContent, attachments: activeAttachments };
    const assistantId = globalThis.crypto?.randomUUID?.() || `stream-${Date.now()}`;
    const assistantMsg = { id: assistantId, role: "assistant", content: "", streaming: true };
    setMessages((current) => [...current, userMsg]);
    setDraft("");
    setAttachments([]);
    setAttachmentError("");
    setAttachmentNotice("");
    setError("");
    setLoading(true);

    await saveMessage(convId, "user", displayContent, activeAttachments.map(({ name, type, size }) => ({ name, type, size })));
    if (creatingConversationRef.current === convId) creatingConversationRef.current = null;

    let streamedContent = "";
    let requestAborted = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setMessages((current) => [...current, assistantMsg]);

    try {
      const allMessages = [...messages, userMsg].slice(-20);
      const buildUserContent = (m) => {
        const fileAttachments = (m.attachments || []).filter((attachment) => !attachment.vision || !attachment.dataUrl);
        const imageAttachments = (m.attachments || []).filter((attachment) => attachment.vision && attachment.dataUrl).slice(0, MAX_IMAGES_PER_MESSAGE);
        const fileDescription = fileAttachments.map((attachment) => attachment.content || `[Attached file: ${attachment.name} (${attachment.type})]`).join("\n\n");
        const text = [m.content, fileDescription].filter(Boolean).join("\n\n") || (imageAttachments.length ? "Please analyze the attached image." : "");
        if (!imageAttachments.length) return text;
        return [{ type: "text", text }, ...imageAttachments.map((attachment) => ({ type: "image_url", image_url: { url: attachment.dataUrl } }))];
      };
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ messages: allMessages.map((m) => ({ role: m.role, content: buildUserContent(m) })), model: selectedModel, stream: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw Object.assign(new Error(payload.error || "Jan couldn’t respond."), { code: payload.code });
      }
      if (!response.body) throw new Error("Jan couldn’t start a response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const applyEvent = (event) => {
        const data = event.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
        if (!data || data === "[DONE]") return;
        try {
          const payload = JSON.parse(data);
          const delta = payload?.choices?.[0]?.delta?.content;
          if (!delta) return;
          streamedContent += delta;
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: streamedContent } : message));
        } catch { /* Ignore incomplete provider events until the next stream chunk. */ }
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        events.forEach(applyEvent);
        if (done) break;
      }
      if (buffer) applyEvent(buffer);
    } catch (requestError) {
      requestAborted = requestError.name === "AbortError";
      if (!requestAborted) setError(requestError.code === "GROQ_NOT_CONFIGURED" ? "Groq is ready to connect. Add GROQ_API_KEY in Vercel when you have the token." : requestError.message || "Jan couldn’t connect. Please try again.");
    } finally {
      abortControllerRef.current = null;
      if (streamedContent.trim()) {
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: streamedContent, streaming: false } : message));
        await saveMessage(convId, "assistant", streamedContent);
        if (isFirstMessage) await updateConversationTitle(convId, makeConversationTitle(streamedContent, content || "New conversation"));
      } else {
        setMessages((current) => current.filter((message) => message.id !== assistantId));
      }
      if (requestAborted && streamedContent.trim()) setError("Response stopped.");
      setLoading(false);
    }
  };

  const stopGenerating = () => {
    if (!abortControllerRef.current) return;
    setMessages((current) => current.map((message) => message.streaming ? { ...message, streaming: false } : message));
    abortControllerRef.current.abort();
  };

  const switchConversation = (convId) => { setActiveConversationId(convId); setSidebarOpen(false); setConversationMenuId(null); setError(""); setAttachmentError(""); setAttachmentNotice(""); };
  const newConversation = () => { setActiveConversationId(null); setMessages([]); setDraft(""); setAttachments([]); setError(""); setAttachmentError(""); setAttachmentNotice(""); setSidebarOpen(false); textareaRef.current?.focus(); };
  const deleteConversation = async (convId) => { setConversationMenuId(null); if (user?.is_demo) { setConversations((previous) => { const next = previous.filter((conversation) => conversation.id !== convId); writeDemoConversations(next); return next; }); window.localStorage.removeItem(demoMessagesKey(convId)); } else { await supabase.from("conversations").delete().eq("id", convId); setConversations((prev) => prev.filter((c) => c.id !== convId)); } if (activeConversationId === convId) newConversation(); };
  const persistProjects = (nextProjects) => { setProjects(nextProjects); writeProjects(user?.id || user?.email, nextProjects); };
  const createProject = () => {
    const name = window.prompt("Name your new project", "New project")?.trim();
    if (!name) return;
    const project = { id: globalThis.crypto?.randomUUID?.() || `project-${Date.now()}`, name, files: [], created_at: new Date().toISOString() };
    persistProjects([project, ...projects]);
    setActiveProjectId(project.id);
    setWorkspaceView("project");
    setProjectNotice(`Project “${name}” created successfully`);
    window.setTimeout(() => setProjectNotice(""), 3200);
  };
  const openProject = (projectId) => { setActiveProjectId(projectId); setWorkspaceView("project"); setSidebarOpen(false); };
  const addProjectFiles = (fileList) => {
    const files = Array.from(fileList || []).slice(0, 8).map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, size: file.size, type: file.type || "file" }));
    if (!files.length || !activeProjectId) return;
    const next = projects.map((project) => project.id === activeProjectId ? { ...project, files: [...(project.files || []), ...files].slice(0, 8) } : project);
    persistProjects(next);
  };
  const renameConversation = async (convId, currentTitle) => {
    const nextTitle = window.prompt("Rename conversation", currentTitle)?.trim();
    setConversationMenuId(null);
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
    "openai/gpt-oss-20b": { name: "GPT‑OSS 20B", badge: "Recommended · Fast" },
    "openai/gpt-oss-120b": { name: "GPT‑OSS 120B", badge: "Best quality" },
    "qwen/qwen3.8-27b": { name: "Qwen 3.8 27B", badge: "Vision · Images" },
  };

  const addFiles = async (filesToAdd) => {
    const files = Array.from(filesToAdd || []).slice(0, Math.max(0, MAX_ATTACHMENTS - attachments.length));
    if (!files.length) {
      setAttachmentError(`You can add up to ${MAX_ATTACHMENTS} files to one message.`);
      return;
    }
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

  const signOut = async () => { if (user?.is_demo) { window.localStorage.removeItem(DEMO_USER_KEY); window.dispatchEvent(new CustomEvent("jan:demo-auth")); } else { await supabase.auth.signOut(); } setConversations([]); setActiveConversationId(null); setMessages([]); navigate("/"); };

  if (authLoading) return null;
  if (!user) return <><Header /><main className="chat-gate"><div><img src="/assets/logo-jan.svg" alt="" /><span>YOUR PRIVATE WORKSPACE</span><h1>Talk to Jan</h1><p>Create an account or log in to open your AI workspace.</p><div><button type="button" onClick={() => requestAuth("signup")}>Sign up free <FiArrowRight /></button><button type="button" onClick={() => requestAuth("login")}>Log in</button></div></div></main></>;

  const userDisplayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "You";
  const conversationTitle = conversations.find((conversation) => conversation.id === activeConversationId)?.title || "New conversation";
  const connectionLabel = connection === "ready" ? "Connected" : connection === "missing" ? "Setup needed" : "Connecting";
  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];
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
    <aside className="chat-sidebar">
      <div className="chat-sidebar-brand"><Brand /><div className="chat-sidebar-brand-actions"><button className="chat-sidebar-search" type="button" onClick={() => { setChatSearchOpen(true); setSidebarOpen(false); }} aria-label="Search chats" title="Search chats"><FiSearch /></button><button className="chat-sidebar-collapse" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <FiChevronRight /> : <FiChevronLeft />}</button><button className="chat-sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><FiX /></button></div></div>
      <div className="chat-shortcuts">
        <button className="new-chat" type="button" onClick={() => { setWorkspaceView("chat"); newConversation(); }}><FiMessageCircle /><span>New Chat</span><kbd>Ctrl N</kbd></button>
        <button type="button" className="chat-shortcut" onClick={createProject}><FiFolder /><span>New Project</span><kbd>Ctrl P</kbd></button>
      </div>
      <nav>{projects.length > 0 && <><span>PROJECTS</span>{projects.map((project) => <button type="button" className={`chat-project-link ${workspaceView === "project" && activeProject?.id === project.id ? "active" : ""}`} key={project.id} onClick={() => openProject(project.id)}><FiFolder /><span><strong>{project.name}</strong></span></button>)}</>}<span>CHATS</span>{conversations.map((conv) => <div className={`chat-conversation ${workspaceView === "chat" && conv.id === activeConversationId ? "active" : ""}`} key={conv.id}><button type="button" className="chat-conversation-select" onClick={() => { setWorkspaceView("chat"); switchConversation(conv.id); }} aria-label={`Open ${conv.title}`}><FiMessageCircle /><span><strong>{conv.title}</strong><small>{new Date(conv.updated_at).toLocaleDateString()}</small></span></button><button type="button" className="chat-conversation-more" onClick={() => setConversationMenuId((current) => current === conv.id ? null : conv.id)} aria-label={`Conversation actions for ${conv.title}`} aria-expanded={conversationMenuId === conv.id}><FiMoreHorizontal /></button>{conversationMenuId === conv.id && <div className="chat-conversation-menu" role="menu"><button type="button" role="menuitem" onClick={() => renameConversation(conv.id, conv.title)}><FiEdit2 />Rename</button><button type="button" className="chat-conversation-delete" role="menuitem" onClick={() => deleteConversation(conv.id)}><FiTrash2 />Delete</button></div>}</div>)}</nav>
      <div className="chat-profile"><button className="chat-profile-settings" type="button" onClick={() => { setWorkspaceView("settings"); setSidebarOpen(false); }} aria-label="Open account settings"><span>{userDisplayName.charAt(0).toUpperCase()}</span><div><strong>{userDisplayName}</strong><small>{user.email}</small></div></button><button type="button" onClick={signOut} aria-label="Log out"><FiLogOut /></button></div>
    </aside>
    <section className={`chat-workspace ${messages.length ? "chat-workspace-thread" : "chat-workspace-empty"}`}>
      <header className="chat-topbar"><div className="chat-topbar-title"><button className="chat-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><FiMenu /></button>{workspaceView === "chat" && <div><strong>{conversationTitle}</strong><small>Saved automatically</small></div>}</div><div className="chat-topbar-actions"><div className="chat-model-dropdown" ref={modelMenuRef}><button type="button" className={`chat-model connection-${connection}`} onClick={() => setModelMenuOpen(!modelMenuOpen)}><i /><span><small>MODEL</small>{MODEL_DISPLAY[selectedModel]?.name || selectedModel}</span><b>{connectionLabel}</b><FiChevronDown /></button>{modelMenuOpen && <div className="chat-model-menu"><p>AVAILABLE ON YOUR GROQ ACCOUNT</p>{(modelList.length ? modelList : ["openai/gpt-oss-20b"]).map((m) => <button key={m} type="button" className={m === selectedModel ? "active" : ""} onClick={() => { setSelectedModel(m); setModelMenuOpen(false); }}><span className="model-name">{MODEL_DISPLAY[m]?.name || m}</span><span className="model-badge">{MODEL_DISPLAY[m]?.badge || ""}</span>{m === selectedModel && <FiCheck />}</button>)}</div>}</div><Link href="/" aria-label="Back to website"><FiX /></Link></div></header>
      {chatSearchOpen && <div className="chat-search-overlay" role="dialog" aria-modal="true" aria-label="Search chats"><div className="chat-search-panel"><div className="chat-search-input"><FiSearch /><input autoFocus value={chatSearchQuery} onChange={(event) => setChatSearchQuery(event.target.value)} placeholder="Search chats" aria-label="Search chats" /><button type="button" onClick={() => { setChatSearchOpen(false); setChatSearchQuery(""); }} aria-label="Close chat search"><FiX /></button></div><p>{fullSearchStatus === "complete" && !matchingConversations.length ? "FULL SEARCH" : "CHATS"}</p>{displayedSearchResults.length ? <div className="chat-search-results">{displayedSearchResults.map((conversation) => <button type="button" key={conversation.id} onClick={() => { setWorkspaceView("chat"); switchConversation(conversation.id); setChatSearchOpen(false); setChatSearchQuery(""); }}><FiMessageCircle /><span><strong>{conversation.title}</strong>{conversation.match && <small className="chat-search-snippet">{conversation.match}</small>}</span><small>{new Date(conversation.updated_at).toLocaleDateString()}</small></button>)}</div> : chatSearchQuery.trim() ? <div className="chat-search-empty">{fullSearchStatus === "loading" ? "Searching every conversation…" : fullSearchStatus === "complete" ? "No matches in your conversations." : fullSearchStatus === "error" ? "Full search is unavailable. Try again." : <><span>No chat titles match “{chatSearchQuery.trim()}”.</span><button type="button" onClick={tryFullChatSearch}>Try full search</button><small>Search for this word in every conversation.</small></>}</div> : <div className="chat-search-empty">Start typing to search your chats.</div>}</div></div>}
      {workspaceView === "chat" ? <><div className="chat-scroll" ref={scrollRef}>
        {!messages.length ? <section className="chat-empty"><h1>How can I help you today?</h1></section> : <div className="chat-thread">{messages.map((message, index) => <article className={`chat-message chat-message-${message.role}`} key={message.id || `${message.role}-${index}`}>
          {message.role === "assistant" && <span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span>}
          <div className="chat-message-body"><div className="chat-message-meta"><strong>{message.role === "assistant" ? "Jan" : userDisplayName}</strong><span>{message.role === "assistant" ? message.streaming ? "Writing" : "Personal assistant" : "You"}</span></div>{message.attachments && message.attachments.length > 0 && <div className="chat-message-attachments">{message.attachments.map((a, i) => <div className="chat-msg-attachment" key={i}>{a.type?.startsWith("image/") && a.preview ? <img src={a.preview} alt={a.name} /> : <span className="chat-msg-file"><FiFile />{a.name}</span>}</div>)}</div>}{message.role === "assistant" ? message.streaming && !message.content ? <div className="chat-streaming-wait" aria-label="Jan is thinking"><i /><i /><i /><span>Jan is thinking</span></div> : <div className={message.streaming ? "chat-streaming-copy" : ""}><Suspense fallback={<p className="chat-response-loading">Formatting response…</p>}><MessageResponse>{message.content}</MessageResponse></Suspense></div> : <p className="chat-user-copy">{message.content}</p>}{message.role === "assistant" && !message.streaming && <div className="chat-message-actions"><button type="button" onClick={() => copyMessage(message.content, index)} aria-label="Copy response">{copiedMessage === index ? <FiCheck /> : <FiCopy />}<span>{copiedMessage === index ? "Copied" : "Copy"}</span></button></div>}</div>
        </article>)}{error && <div className="chat-error" role="alert"><span>{error === "Response stopped." ? "RESPONSE STOPPED" : "CONNECTION ISSUE"}</span><p>{error}</p></div>}<div ref={endRef} /></div>}
      </div>
      <div className="chat-composer-wrap"><form className={`chat-composer ${isDraggingFiles ? "chat-composer-drop-active" : ""}`} onSubmit={(event) => { event.preventDefault(); send(); }} onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setIsDraggingFiles(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDraggingFiles(false); }} onDrop={handleFileDrop}>
        <>{attachments.length > 0 && <div className="chat-attachments">{attachments.map((a, i) => <div className="chat-attachment" key={i}><div className="chat-attachment-preview">{a.type.startsWith("image/") ? <img src={a.preview} alt={a.name} /> : <FiFile />}<button type="button" onClick={() => removeAttachment(i)} aria-label="Remove file"><FiX /></button></div><span className="chat-attachment-name">{a.name}</span></div>)}</div>}{attachmentNotice && <p className="chat-attachment-notice">{attachmentNotice}</p>}{attachmentError && <p className="chat-attachment-error" role="alert">{attachmentError}</p>}
        <div className="chat-composer-input"><textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={attachments.length ? "Add a message about your files..." : "Ask Jan anything..."} aria-label="Message Jan" rows="1" maxLength="4000" /></div>
        <div className="chat-composer-footer"><div className="chat-composer-tools">{loading ? <button type="button" className="chat-stop-btn" onClick={stopGenerating} aria-label="Stop response"><span /></button> : <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} aria-label="Add photos, PDFs, or files" title="Add photos, PDFs, or files"><FiPlus /><span className="sr-only">Add files</span></button>}<input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" onChange={handleFileSelect} hidden /><span className="chat-connection"><i />{loading ? "Jan is responding" : connection === "ready" ? "Groq secured server-side" : "Groq connection unavailable"}</span></div><div className="chat-composer-send"><kbd>{loading ? "Stop" : "↵ to send"}</kbd>{loading ? <button type="button" className="chat-stop-text" onClick={stopGenerating}>Stop</button> : <button type="submit" disabled={(!draft.trim() && !attachments.length)} aria-label="Send message"><FiSend /></button>}</div></div></>
      </form><small>Jan can make mistakes. Check important information.</small></div></> : workspaceView === "project" && activeProject ? <section className="project-workspace">
        <header className="project-heading"><div><p>PROJECT</p><h1>{activeProject.name}</h1></div><button type="button" aria-label="Project actions"><FiMoreHorizontal /></button></header>
        <section className="project-composer"><textarea placeholder={`Ask about ${activeProject.name}...`} aria-label={`Message ${activeProject.name}`} /><div><button type="button" className="project-plus" onClick={() => projectFileInputRef.current?.click()} aria-label="Add project files"><FiPlus /></button><button type="button" className="project-send" aria-label="Start a project conversation" onClick={() => { setWorkspaceView("chat"); newConversation(); setDraft(`Help me with my ${activeProject.name} project: `); }}><FiSend /></button></div></section>
        <section className="project-empty-card"><FiMessageCircle /><h2>No conversations in {activeProject.name}</h2><p>Start a new conversation with {activeProject.name} below.</p></section>
        <section className="project-files-card"><div className="project-card-header"><div><strong>Assistant</strong><span><img src="/assets/logo-jan.svg" alt="" />Jan</span></div><button type="button"><FiEdit2 /> Edit</button></div><div className="project-card-header project-files-heading"><strong>Files</strong><button type="button" onClick={() => projectFileInputRef.current?.click()}><FiUpload /> Add</button><input ref={projectFileInputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.pdf" hidden onChange={(event) => { addProjectFiles(event.target.files); event.target.value = ""; }} /></div>{activeProject.files?.length ? <ul className="project-file-list">{activeProject.files.map((file) => <li key={file.id}><FiFile /><span>{file.name}</span></li>)}</ul> : <button type="button" className="project-dropzone" onClick={() => projectFileInputRef.current?.click()}><FiFile /><span>Add PDFs, documents, or other text to reference in this project.</span></button>}</section>
        {projectNotice && <div className="project-toast" role="status"><FiCheck />{projectNotice}</div>}
      </section> : workspaceView === "hub" ? <section className="hub-workspace"><header><p>HUB</p><h1>Plugins</h1><span>Work with Jan across your favorite tools.</span></header><label className="hub-search"><FiSearch /><input value={hubSearch} onChange={(event) => setHubSearch(event.target.value)} placeholder="Search plugins" aria-label="Search plugins" /></label><section className="hub-installed"><h2>Installed <FiChevronRight /></h2><div><span>✦</span><p>Jan tools<br /><small>Built-in workspace tools</small></p></div></section><section className="hub-popular"><h2>Popular</h2>{visiblePlugins.map((plugin) => { const Icon = plugin.icon; const installed = installedPlugins.includes(plugin.id); return <article key={plugin.id}><span className={`plugin-icon plugin-${plugin.tone}`}><Icon /></span><div><strong>{plugin.name}</strong><small>{plugin.copy}</small></div><button type="button" className={installed ? "installed" : ""} onClick={() => setInstalledPlugins((current) => installed ? current.filter((id) => id !== plugin.id) : [...current, plugin.id])} aria-label={`${installed ? "Remove" : "Install"} ${plugin.name}`}>{installed ? <FiCheck /> : <FiPlus />}</button></article>; })}{!visiblePlugins.length && <p className="hub-no-results">No plugins match that search.</p>}</section></section> : <section className="settings-workspace"><header><p>ACCOUNT</p><h1>Settings</h1><span>Manage your Jan workspace and account preferences.</span></header><section className="settings-account"><span>{userDisplayName.charAt(0).toUpperCase()}</span><div><strong>{userDisplayName}</strong><small>{user.email}</small></div><button type="button" onClick={signOut}>Log out <FiLogOut /></button></section><section className="settings-panel"><h2>Workspace</h2><label><span>Response streaming</span><input type="checkbox" defaultChecked /></label><label><span>Use the fastest free model when available</span><input type="checkbox" defaultChecked /></label><label><span>Model</span><button type="button" onClick={() => setModelMenuOpen(true)}>{MODEL_DISPLAY[selectedModel]?.name || selectedModel}<FiChevronRight /></button></label></section></section>}
    </section>
  </main>;
}

function ContentPage({ data }) {
  return <><Header /><main className="content-page"><section className={`content-hero accent-${data.accent}`}><span className="content-eyebrow">{data.eyebrow}</span><h1>{data.title}</h1><p>{data.intro}</p><Link className="content-cta pressed" href={data.downloads ? "/docs" : "/chat"}>{data.downloads ? "Read the quickstart" : "Start chatting"}<FiArrowRight /></Link></section>{data.code && <pre className="code-panel"><code>{data.code}</code></pre>}{data.downloads ? <DownloadCards /> : <section className="content-grid">{data.cards.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{copy}</p><Link href="/docs">Learn more <FiArrowRight /></Link></article>)}</section>}<section className="content-bottom"><div><span>OPEN · LOCAL · YOURS</span><h2>Keep the intelligence close.</h2></div><img src="/assets/logo-jan.svg" alt="" /></section></main><Footer /></>;
}

function NotFound() { return <><Header /><main className="not-found"><img src="/assets/logo-jan.svg" alt="" /><p>404</p><h1>This page wandered off.</h1><Link className="content-cta pressed" href="/">Back to Jan</Link></main><Footer /></>; }

export function App() {
  const [path, setPath] = useState(window.location.pathname.replace(/\/$/, "") || "/");
  useEffect(() => { const update = () => setPath(window.location.pathname.replace(/\/$/, "") || "/"); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  useEffect(() => {
    const elements = document.querySelectorAll(".ecosystem h2, .outline-card, .testimonials h2, .testimonial, .community-copy > *, .stat-card, .tools-inner > h2, .tool-copy, .model-grid, .memory-cards, .final-cta-top, .footer-main, .content-hero > *, .content-grid article, .platform-card, .code-panel, .content-bottom > *, .docs-hero > *, .docs-product-card, .docs-common > *, .docs-path, .research-top > *, .research-feature > *, .research-card, .research-load, .article-head > *, .article-section, .article-note, .research-article-head > *, .research-article-visual, .research-story > *");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    elements.forEach((element) => {
      element.classList.add("motion-section");
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, [path]);
  const page = useMemo(() => PAGE_DATA[path], [path]);
  if (path === "/") return <Home />;
  if (path === "/chat") return <ChatPage />;
  if (path === "/docs") return <DocsPage />;
  if (path === "/research") return <ResearchPage />;
  if (DOC_ARTICLES[path]) return <DocArticlePage article={DOC_ARTICLES[path]} />;
  if (RESEARCH_ARTICLES[path]) return <ResearchArticlePage article={RESEARCH_ARTICLES[path]} />;
  if (page) return <ContentPage data={page} />;
  return <NotFound />;
}
