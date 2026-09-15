import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
import {
  FaApple,
  FaDiscord,
  FaGithub,
  FaLinux,
  FaLinkedinIn,
  FaUsers,
  FaWindows,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { LuBot, LuBrainCircuit, LuChevronsUpDown, LuRocket } from "react-icons/lu";
import {
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCheck,
  FiChevronDown,
  FiCopy,
  FiCpu,
  FiGitBranch,
  FiLogOut,
  FiMail,
  FiMenu,
  FiMessageCircle,
  FiMonitor,
  FiMoreHorizontal,
  FiPlus,
  FiSearch,
  FiSend,
  FiShield,
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
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
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

  const useDemo = () => { setEmail(DEMO_ACCOUNT.email); setPassword(DEMO_ACCOUNT.password); setError(""); };
  return <div className="auth-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={modalRef} className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description"><button className="auth-close" type="button" onClick={onClose} aria-label="Close account dialog"><FiX /></button><div className="auth-mark"><img src="/assets/logo-jan.svg" alt="" /></div><span className="auth-eyebrow">PERSONAL INTELLIGENCE</span><h2 id="auth-title">{mode === "signup" ? "Create your Jan account" : "Welcome back"}</h2><p id="auth-description">{mode === "signup" ? "One private workspace for your conversations." : "Continue to your personal workspace."}</p>{mode === "login" && <button className="demo-account" type="button" onClick={useDemo}><span><b>DEMO ACCOUNT</b><small>{DEMO_ACCOUNT.email}<br />{DEMO_ACCOUNT.password}</small></span><strong>Use demo</strong></button>}<form onSubmit={submit}>{mode === "signup" && <label><span>Name</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>}<label><span>Email</span><input autoFocus={mode === "login"} required type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" autoComplete="email" /></label><label><span>Password</span><input required minLength="6" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="At least 6 characters" autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}<FiArrowRight /></button></form><small>Your password is securely stored with Supabase. We never see it.</small><button className="auth-switch" type="button" onClick={() => { setMode((value) => value === "signup" ? "login" : "signup"); setError(""); }}>{mode === "signup" ? "Already have an account? Log in" : "New to Jan? Create an account"}</button></section></div>;
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
  const [copiedMessage, setCopiedMessage] = useState(null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Load conversations when user is available
  useEffect(() => {
    if (!user) return;
    const loadConversations = async () => {
      const { data } = await supabase.from("conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (data) setConversations(data);
    };
    loadConversations();
  }, [user]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return; }
    const loadMessages = async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", activeConversationId).order("created_at", { ascending: true });
      if (data) setMessages(data.map((m) => ({ role: m.role, content: m.content, id: m.id })));
    };
    loadMessages();
  }, [activeConversationId]);

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
    fetch("/api/chat").then((r) => r.json()).then((p) => { if (active) setConnection(p.configured ? "ready" : "missing"); }).catch(() => { if (active) setConnection("missing"); });
    return () => { active = false; };
  }, []);

  const createConversation = useCallback(async (title) => {
    if (!user) return null;
    const { data } = await supabase.from("conversations").insert({ user_id: user.id, title: title || "New conversation" }).select().single();
    if (data) setConversations((prev) => [data, ...prev]);
    return data;
  }, [user]);

  const saveMessage = useCallback(async (conversationId, role, content) => {
    if (!conversationId) return null;
    const { data } = await supabase.from("messages").insert({ conversation_id: conversationId, role, content }).select().single();
    return data;
  }, []);

  const updateConversationTitle = useCallback(async (conversationId, title) => {
    if (!conversationId) return;
    await supabase.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", conversationId);
    setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, title, updated_at: new Date().toISOString() } : c));
  }, []);

  const send = async (contentOverride) => {
    const content = (typeof contentOverride === "string" ? contentOverride : draft).trim();
    if (!content || loading) return;

    let convId = activeConversationId;
    if (!convId) {
      const title = content.length > 34 ? content.slice(0, 34) + "…" : content;
      const conv = await createConversation(title);
      if (!conv) return;
      convId = conv.id;
      setActiveConversationId(convId);
    }

    const userMsg = { role: "user", content };
    setMessages((current) => [...current, userMsg]);
    setDraft("");
    setError("");
    setLoading(true);

    await saveMessage(convId, "user", content);

    if (messages.length === 0) {
      const title = content.length > 34 ? content.slice(0, 34) + "…" : content;
      updateConversationTitle(convId, title);
    }

    try {
      const allMessages = [...messages, userMsg].slice(-20);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const payload = await response.json();
      if (!response.ok) throw Object.assign(new Error(payload.error || "Jan couldn’t respond."), { code: payload.code });

      const assistantMsg = { role: "assistant", content: payload.content };
      setMessages((current) => [...current, assistantMsg]);
      await saveMessage(convId, "assistant", payload.content);
    } catch (requestError) {
      setError(requestError.code === "GROQ_NOT_CONFIGURED" ? "Groq is ready to connect. Add GROQ_API_KEY in Vercel when you have the token." : requestError.message || "Jan couldn’t connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchConversation = (convId) => { setActiveConversationId(convId); setSidebarOpen(false); setError(""); };
  const newConversation = () => { setActiveConversationId(null); setMessages([]); setDraft(""); setError(""); setSidebarOpen(false); textareaRef.current?.focus(); };
  const deleteConversation = async (convId) => { await supabase.from("conversations").delete().eq("id", convId); setConversations((prev) => prev.filter((c) => c.id !== convId)); if (activeConversationId === convId) newConversation(); };
  const copyMessage = async (content, index) => { await navigator.clipboard.writeText(content); setCopiedMessage(index); window.setTimeout(() => setCopiedMessage(null), 1800); };
  const signOut = async () => { await supabase.auth.signOut(); setConversations([]); setActiveConversationId(null); setMessages([]); navigate("/"); };

  if (authLoading) return null;
  if (!user) return <><Header /><main className="chat-gate"><div><img src="/assets/logo-jan.svg" alt="" /><span>YOUR PRIVATE WORKSPACE</span><h1>Talk to Jan</h1><p>Create an account or log in to open your AI workspace.</p><div><button type="button" onClick={() => requestAuth("signup")}>Sign up free <FiArrowRight /></button><button type="button" onClick={() => requestAuth("login")}>Log in</button></div></div></main></>;

  const userDisplayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "You";
  const firstUserMessage = messages.find((m) => m.role === "user")?.content;
  const conversationTitle = firstUserMessage ? `${firstUserMessage.slice(0, 34)}${firstUserMessage.length > 34 ? "…" : ""}` : "New conversation";
  const connectionLabel = connection === "ready" ? "Connected" : connection === "missing" ? "Setup needed" : "Connecting";

  return <main className={`chat-page ${sidebarOpen ? "sidebar-open" : ""}`}>
    <button className="chat-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
    <aside className="chat-sidebar">
      <div className="chat-sidebar-brand"><Brand /><button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><FiX /></button></div>
      <button className="new-chat" type="button" onClick={newConversation}><FiPlus /><span>New conversation</span><kbd>⌘ N</kbd></button>
      <nav><span>RECENT</span>{conversations.map((conv) => <button type="button" className={conv.id === activeConversationId ? "active" : ""} onClick={() => switchConversation(conv.id)} key={conv.id}><FiMessageCircle /><span><strong>{conv.title}</strong><small>{new Date(conv.updated_at).toLocaleDateString()}</small></span><FiMoreHorizontal /></button>)}</nav>
      <div className="chat-private-note"><FiShield /><span><strong>Private workspace</strong><small>Your chats are stored securely in Supabase.</small></span></div>
      <div className="chat-profile"><span>{userDisplayName.charAt(0).toUpperCase()}</span><div><strong>{userDisplayName}</strong><small>{user.email}</small></div><button type="button" onClick={signOut} aria-label="Log out"><FiLogOut /></button></div>
    </aside>
    <section className="chat-workspace">
      <header className="chat-topbar"><div className="chat-topbar-title"><button className="chat-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><FiMenu /></button><div><strong>{conversationTitle}</strong><small>Saved automatically</small></div></div><div className="chat-topbar-actions"><span className={`chat-model connection-${connection}`}><i /><span><small>MODEL</small>GPT-OSS 20B</span><b>{connectionLabel}</b></span><Link href="/" aria-label="Back to website"><FiX /></Link></div></header>
      <div className="chat-scroll" ref={scrollRef}>
        {!messages.length ? <section className="chat-empty"><div className="chat-empty-mark"><span /><img src="/assets/logo-jan.svg" alt="" /></div><p>PERSONAL INTELLIGENCE</p><h1>Good to see you, {userDisplayName}.</h1><h2>What can I help you think through?</h2><div className="chat-starters">{CHAT_STARTERS.map((starter) => <button type="button" key={starter.title} onClick={() => send(starter.title)}><span>{starter.eyebrow}</span><strong>{starter.title}</strong><small>{starter.copy}</small><FiArrowRight /></button>)}</div></section> : <div className="chat-thread">{messages.map((message, index) => <article className={`chat-message chat-message-${message.role}`} key={message.id || `${message.role}-${index}`}>
          {message.role === "assistant" && <span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span>}
          <div className="chat-message-body"><div className="chat-message-meta"><strong>{message.role === "assistant" ? "Jan" : userDisplayName}</strong><span>{message.role === "assistant" ? "Personal assistant" : "You"}</span></div>{message.role === "assistant" ? <Suspense fallback={<p className="chat-response-loading">Formatting response…</p>}><MessageResponse>{message.content}</MessageResponse></Suspense> : <p className="chat-user-copy">{message.content}</p>}{message.role === "assistant" && <div className="chat-message-actions"><button type="button" onClick={() => copyMessage(message.content, index)} aria-label="Copy response">{copiedMessage === index ? <FiCheck /> : <FiCopy />}<span>{copiedMessage === index ? "Copied" : "Copy"}</span></button></div>}</div>
        </article>)}{loading && <article className="chat-message chat-message-assistant chat-message-loading"><span className="chat-avatar"><img src="/assets/logo-jan.svg" alt="Jan" /></span><div className="chat-message-body"><div className="chat-message-meta"><strong>Jan</strong><span>Thinking</span></div><div className="typing"><i /><i /><i /></div></div></article>}{error && <div className="chat-error" role="alert"><span>CONNECTION ISSUE</span><p>{error}</p></div>}<div ref={endRef} /></div>}
      </div>
      <div className="chat-composer-wrap"><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Ask Jan anything..." aria-label="Message Jan" rows="1" maxLength="4000" /><div className="chat-composer-footer"><span><i />{connection === "ready" ? "Groq secured server-side" : "Groq connection unavailable"}</span><div><kbd>↵ to send</kbd><button type="submit" disabled={!draft.trim() || loading} aria-label="Send message"><FiSend /></button></div></div></form><small>Jan can make mistakes. Check important information.</small></div>
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
