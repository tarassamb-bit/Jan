import { LuRocket } from "react-icons/lu";
import { FiBarChart2, FiCpu, FiFolder, FiHeart, FiMessageCircle } from "react-icons/fi";

export const DOC_PRODUCTS = [
  { title: "Get started with Jan", description: "Open your workspace, choose a model, and send your first message.", meta: "Accounts · First chat", href: "/docs/quickstart", icon: LuRocket, tone: "blue" },
  { title: "Models & providers", description: "Choose from the models available in your chat composer and learn when to switch.", meta: "Models · Switching", href: "/docs/models", icon: FiCpu, tone: "purple" },
  { title: "Usage & limits", description: "Learn how Jan Free tracks messages, uploads, daily resets, and provider-level capacity limits.", meta: "100 messages · 3 uploads", href: "/docs/usage", icon: FiBarChart2, tone: "yellow" },
  { title: "Projects & files", description: "Keep related conversations, source files, and work products together in a single project workspace.", meta: "Projects · Storage · Files", href: "/docs/projects", icon: FiFolder, tone: "green" },
  { title: "Memory & personalization", description: "Save helpful preferences, review what Jan remembers, and remove personal data whenever you want.", meta: "Memory · Preferences · Privacy", href: "/docs/memory", icon: FiHeart, tone: "rose" },
];

export const DOC_PATHS = [
  { title: "How do I start a chat?", detail: "Open New Chat, choose a model, and send your first prompt from the composer.", href: "/docs/quickstart", icon: FiMessageCircle },
  { title: "Which model should I use?", detail: "Start with a fast model for everyday work, then switch for reasoning or vision tasks.", href: "/docs/models", icon: FiCpu },
  { title: "How do usage limits work?", detail: "See your daily messages, uploads, reset time, and how limits are enforced in Settings → Usage.", href: "/docs/usage", icon: FiBarChart2 },
  { title: "How do I organize work in projects?", detail: "Create a project, move chats into it, and attach files that Jan can reference later.", href: "/docs/projects", icon: FiFolder },
  { title: "How does memory work?", detail: "Tell Jan about your preferences or manage saved facts in Settings → Personalization.", href: "/docs/memory", icon: FiHeart },
];

export const DOC_FAQS = [
  ["Where are my chats and projects saved?", "Signed-in chats and projects are stored in your Jan account. In the local demo flow, data remains on the current device unless you sign in to a synced account."],
  ["Can I use this chat offline?", "The chat in this prototype uses a hosted model, so sending a message requires an internet connection."],
  ["When do my free limits reset?", "The Jan Free allowance resets every day at 00:00 UTC. The Usage screen shows your remaining messages and uploads, plus the local time of the next reset."],
  ["What counts as an upload?", "Uploads include files attached to chats and project sources. Text-like files may be compressed for storage, while images can be resized and converted to WebP before saving."],
  ["Where are uploaded files saved?", "Files added to a signed-in project are saved in private account storage. You can remove project files from the workspace."],
  ["Can Jan remember something about me?", "Yes. You can ask Jan to remember a preference, or add it directly in Settings → Personalization → Memory. You can delete any saved memory at any time."],
  ["Which model should I choose?", "Choose a fast model for everyday questions. Switch to a reasoning or vision model when your task needs those abilities."],
  ["What happens when a provider is rate-limited?", "Jan will show a clear retry message and keep your message intact. In many cases, switching to another available model or trying again shortly resolves the issue."],
  ["Why was my file rejected?", "Jan supports common text, markdown, PDF, and image files within size limits. Large or unsupported formats may be rejected until they are converted or compressed."],
];

export const DOC_ARTICLES = {
  "/docs/quickstart": {
    eyebrow: "GETTING STARTED", title: "Quickstart", summary: "Open your workspace, create a conversation, and choose a model in a few steps.",
    sections: [
      { id: "install", title: "1. Open your workspace", body: "Choose Log in or Sign up in the header to open the chat workspace. You can also explore the local demo, where changes stay on this device." },
      { id: "account", title: "2. Sign in or continue in demo mode", body: "You can sign in with your Jan account for synced chats and settings, or continue in demo mode to explore the interface locally. Demo mode is intended for trying the product without a full account setup.", note: "Your account keeps chats, projects, and usage data connected to the same identity." },
      { id: "model", title: "3. Choose a model", body: "Open the model picker in the composer and select an available model that fits your task. Choose a fast model for everyday questions and a reasoning or vision model when your work calls for it." },
      { id: "chat", title: "4. Send your first message", body: "Type a question or prompt and press Enter. Jan will respond in the thread, and you can continue the conversation with follow-ups, file attachments, or project context." },
      { id: "files", title: "5. Add files when needed", body: "Use the attachment button to add PDFs, images, or supported text documents. Jan can use those files as context in the current thread or in a project-based workflow." },
    ],
  },
  "/docs/models": {
    eyebrow: "MODELS & PROVIDERS", title: "Models and providers", summary: "Choose the right available model for speed, context, and the kind of work you want to do.",
    sections: [
      { id: "local", title: "Available models", body: "The chat composer shows models available to this account. The featured list keeps the most common choices close; use More models to see the full selection.", note: "This prototype sends chat requests through a server-side hosted provider. The model names in the picker show what is available here." },
      { id: "providers", title: "Hosted responses", body: "A hosted provider generates replies for this web chat. Your chosen model is sent with the request, and provider availability can affect response time.", note: "Provider capacity limits can be separate from your daily Jan allowance." },
      { id: "choose", title: "Choosing the right option", body: "Use a fast model for concise drafting and everyday questions. Choose a stronger reasoning model for multi-step work, or a vision-capable model when you need image understanding." },
      { id: "switch", title: "Switch the active model", body: "Open the model picker in the chat composer and select the model you want for that conversation. Each thread can keep a different active model, which makes it easy to compare results across tasks.", code: "Model picker → select model → continue the chat" },
    ],
  },
  "/docs/usage": {
    eyebrow: "JAN FREE", title: "Usage and limits", summary: "Understand your daily free allowance, upload caps, and the conditions that can trigger a retry or a temporary limit.",
    sections: [
      { id: "allowance", title: "Your daily allowance", body: "Jan Free includes up to 100 messages and 3 uploads per day. These counters are tracked for your account and are visible in Settings → Usage so you can see how much remains before the next reset." },
      { id: "reset", title: "When limits reset", body: "Your daily usage resets at 00:00 UTC. Jan shows the local time of the next reset and the remaining quota so you can plan work without surprises." },
      { id: "actions", title: "What happens at a limit", body: "When you reach your daily message or upload limit, Jan blocks new requests until the next reset. If the app is rate-limited by a provider, you may see a retry message and can attempt the same request again after a short wait." },
      { id: "provider", title: "Provider capacity", body: "Even when your Jan Free allowance is available, a provider may still enforce its own throughput constraints. Jan keeps requests bounded and shows a clear error or retry prompt when capacity is temporarily unavailable.", note: "Provider rate limits are separate from your Jan daily allowance." },
    ],
  },
  "/docs/projects": {
    eyebrow: "WORKSPACE", title: "Projects and files", summary: "Organize chats, files, and long-running work into a single, durable project workspace.",
    sections: [
      { id: "create", title: "Create a project", body: "Open the project area from the sidebar, choose Create project, and give it a clear name. Projects are useful when one task includes multiple chats, documents, and follow-up questions." },
      { id: "chats", title: "Add chats to a project", body: "From a saved conversation, use Project actions to move it into a project. Once a chat is inside a project, it stays grouped with related work so you can revisit it later without searching through every thread." },
      { id: "files", title: "Add project files", body: "Use Add files in a project to include PDFs, images, or text documents that Jan can reference. This is useful for research, spec work, design reviews, and any task that depends on working documents.", note: "Images are compressed to WebP and text files can be gzipped to reduce storage usage while keeping the content readable." },
      { id: "share", title: "Keep work organized", body: "Projects help reduce context switching. Instead of having a long list of independent chats, you can keep threads, notes, and files aligned around one goal or client.", code: "Project → Sources → Add files\nProject → Chats → open thread" },
    ],
  },
  "/docs/memory": {
    eyebrow: "PERSONALIZATION", title: "Memory and personalization", summary: "Give Jan useful context without losing control over what is remembered and when it is removed.",
    sections: [
      { id: "save", title: "Save a memory", body: "Tell Jan a durable preference such as “I prefer concise answers” or “I like working in markdown.” You can also add and manage preferences directly in Settings → Personalization → Memory." },
      { id: "review", title: "Review and remove entries", body: "Saved memories appear in the Personalization area. You can view each fact, update it, or delete it at any time. Removing a memory stops future prompts from including that fact unless you add it again." },
      { id: "privacy", title: "Privacy and control", body: "Memory should improve helpfulness without feeling intrusive. Jan lets you inspect what is remembered and remove it when it is no longer useful, which makes the feature more transparent and easier to trust." },
    ],
  },
};
