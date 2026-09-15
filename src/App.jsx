import { useEffect, useMemo, useState } from "react";
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
import { LuChevronsUpDown } from "react-icons/lu";
import {
  FiArrowLeft,
  FiArrowRight,
  FiChevronDown,
  FiMail,
  FiMenu,
  FiSearch,
  FiX,
} from "react-icons/fi";

const DOWNLOADS = [
  ["Mac", "97.9 MB", FaApple],
  ["Windows", "55.1 MB", FaWindows],
  ["Linux (Flatpak)", "", FaLinux],
  ["Linux (AppImage)", "150.2 MB", FaLinux],
  ["Linux (Deb)", "82.9 MB", FaLinux],
];

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

function Brand({ light = false }) {
  return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="Jan home"><img src="/assets/logo-jan.svg" alt="" /><strong>Jan</strong></Link>;
}

function Header({ home = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => { const check = () => setScrolled(window.scrollY > 24); check(); window.addEventListener("scroll", check, { passive: true }); return () => window.removeEventListener("scroll", check); }, []);
  useEffect(() => { document.body.style.overflow = mobileOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);
  const matches = (label) => !search || label.toLowerCase().includes(search.toLowerCase());
  const close = () => setMobileOpen(false);
  const light = home && !scrolled;
  const companyItems = [["Changelog", "/changelog"], ["Blog", "/blog"], ["About Us", "/about"], ["Careers", "/careers"], ["Handbook", "/handbook"]];
  return <>
    <header className={`site-header ${light ? "header-light" : "header-solid"}`}>
      <Brand light={light} />
      <nav className="desktop-nav" aria-label="Primary navigation">
        <Link href="/jan">Jan <FiChevronDown /></Link><Link href="/tokamak">Tokamak</Link><Link href="/research">Research</Link><Link href="/docs">Docs</Link>
        <span className="company-wrap"><button type="button" onClick={() => setCompanyOpen((open) => !open)} aria-expanded={companyOpen}>Company <FiChevronDown /></button>{companyOpen && <span className="company-menu"><Link href="/about">About Us</Link><Link href="/careers">Careers</Link><Link href="/handbook">Handbook</Link><Link href="/changelog">Changelog</Link></span>}</span>
      </nav>
      <div className="header-actions"><Link className="header-download" href="/download"><span className="desktop-download-text">Download Jan</span><span className="mobile-download-text">Download</span></Link><div className="header-socials"><Link href="/community" aria-label="Discord"><FaDiscord /></Link><Link href="/community" aria-label="X"><FaXTwitter /></Link><Link href="/company" aria-label="LinkedIn"><FaLinkedinIn /></Link><Link href="/community" aria-label="GitHub"><FaGithub /></Link></div><button className="mobile-menu-button" type="button" onClick={() => setMobileOpen(true)} aria-label="Toggle mobile menu">{mobileOpen ? <FiX /> : <FiMenu />}</button></div>
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
      <Link className="drawer-download pressed" href="/download" onClick={close}><FaApple /> Download Jan</Link>
    </aside></div>}
  </>;
}

function DownloadControl({ compact = false }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const select = (label) => { setNotice(`${label} demo selected`); setOpen(false); };
  return <div className={`download-block ${compact ? "download-footer" : ""}`}><div className="download-wrap"><div className="download-control pressed"><button type="button" className="download-main" onClick={() => setOpen(true)}><FaApple /><span>Download for Mac</span></button><button type="button" className="download-toggle" onClick={() => setOpen((value) => !value)} aria-label="Choose download platform" aria-expanded={open}><LuChevronsUpDown /></button></div>{open && <div className={`download-menu ${compact ? "download-menu-up" : ""}`}>{DOWNLOADS.map(([label, size, Icon]) => <button className="download-option" type="button" onClick={() => select(label)} key={label}><span className="download-label"><Icon /><span>Download for {label}</span></span><strong>{size}</strong></button>)}</div>}</div>{!compact && <div className="download-count">+6.6M downloads</div>}{notice && <span className="download-notice" role="status">{notice}</span>}</div>;
}

function Hero() {
  return <><section className="hero"><div className="hero-copy"><Link className="release-pill" href="/changelog"><span>NEW</span><b>✨ v0.8.4 is now live on GitHub. Check it out!</b></Link><div className="hero-title"><img className="hero-wave" src="/assets/logo-jan.svg" alt="Logo Jan" /><h1>Meet Jan</h1></div><p>Personal Intelligence that answers only to you</p><div className="hero-actions"><DownloadControl /><Link className="community-button pressed" href="/community"><FaDiscord className="discord-color" /><span>Join community</span><small><FaUsers />15k+</small></Link></div></div><img className="flying-robot" src="/assets/cute-robot-flying.png" alt="A cheerful flying robot" /></section><img className="app-preview" src="/assets/app-jan.png" alt="Jan App Interface" /></>;
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

function FinalCta() { return <section className="final-cta"><div className="final-cta-top"><h2>Ask Jan anything</h2><div><DownloadControl compact /><p>+6.6M downloads, Free &amp; Open source</p></div></div><img src="/assets/cute-robot-flying.png" alt="Jan flying through the clouds" /></section>; }

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

function ContentPage({ data }) {
  return <><Header /><main className="content-page"><section className={`content-hero accent-${data.accent}`}><span className="content-eyebrow">{data.eyebrow}</span><h1>{data.title}</h1><p>{data.intro}</p><Link className="content-cta pressed" href={data.downloads ? "/docs" : "/download"}>{data.downloads ? "Read the quickstart" : "Get the demo"}<FiArrowRight /></Link></section>{data.code && <pre className="code-panel"><code>{data.code}</code></pre>}{data.downloads ? <DownloadCards /> : <section className="content-grid">{data.cards.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{copy}</p><Link href="/docs">Learn more <FiArrowRight /></Link></article>)}</section>}<section className="content-bottom"><div><span>OPEN · LOCAL · YOURS</span><h2>Keep the intelligence close.</h2></div><img src="/assets/logo-jan.svg" alt="" /></section></main><Footer /></>;
}

function NotFound() { return <><Header /><main className="not-found"><img src="/assets/logo-jan.svg" alt="" /><p>404</p><h1>This page wandered off.</h1><Link className="content-cta pressed" href="/">Back to Jan</Link></main><Footer /></>; }

export function App() {
  const [path, setPath] = useState(window.location.pathname.replace(/\/$/, "") || "/");
  useEffect(() => { const update = () => setPath(window.location.pathname.replace(/\/$/, "") || "/"); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  useEffect(() => {
    const elements = document.querySelectorAll(".ecosystem h2, .outline-card, .testimonials h2, .testimonial, .community-copy > *, .stat-card, .tools-inner > h2, .tool-copy, .model-grid, .memory-cards, .final-cta-top, .footer-main, .content-hero > *, .content-grid article, .platform-card, .code-panel, .content-bottom > *");
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
  if (page) return <ContentPage data={page} />;
  return <NotFound />;
}
