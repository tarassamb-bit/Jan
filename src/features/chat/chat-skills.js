import workspaceSkills from "../../generated/installed-skills.json";

export const BUILT_IN_SKILLS = [
  { slug: "summarize", name: "Summarize", category: "Writing", description: "Turn long text into a clear, concise summary.", instructions: "Summarize the user's material accurately. Lead with the main point, then list the most important details and any decisions or open questions. Do not add facts that are not in the source." },
  { slug: "explain", name: "Explain simply", category: "Learning", description: "Explain a topic in plain language with a useful example.", instructions: "Explain the user's topic in plain, accessible language. Start with the core idea, define unfamiliar terms, give one concrete example, and mention any important limitation. Ask a short clarifying question only if the topic is unclear." },
  { slug: "brainstorm", name: "Brainstorm", category: "Productivity", description: "Generate varied ideas and recommend the strongest next step.", instructions: "Generate a varied set of practical ideas for the user's request. Avoid near-duplicates. Group ideas when useful, call out the strongest three, and suggest one concrete next step." },
  { slug: "plan", name: "Make a plan", category: "Productivity", description: "Break a goal into sequenced, actionable steps.", instructions: "Turn the user's goal into a practical step-by-step plan. Include the order of work, a clear next action, dependencies, and likely risks. State assumptions and ask only the most important missing question." },
  { slug: "rewrite", name: "Rewrite", category: "Writing", description: "Improve clarity and tone while preserving the original meaning.", instructions: "Rewrite the user's text to improve clarity, flow, and grammar while preserving the original meaning and factual details. Match any requested tone. Return the revised text first, then a brief note about meaningful changes only if useful." },
  { slug: "email", name: "Draft an email", category: "Writing", description: "Write a clear email with a subject and natural tone.", instructions: "Draft a concise, natural email for the user's situation. Include a subject line when appropriate. Preserve the user's facts, avoid inventing commitments, and ask for recipient or goal details if they are essential." },
  { slug: "translate", name: "Translate", category: "Writing", description: "Translate text naturally while preserving its meaning and tone.", instructions: "Translate the user's text into the requested language, preserving meaning, tone, formatting, and names. If the target language is not provided, ask which language they want." },
  { slug: "meeting-notes", name: "Meeting notes", category: "Productivity", description: "Turn rough notes or a transcript into decisions and action items.", instructions: "Organize the user's notes into a short meeting summary, decisions, action items with owners and due dates when stated, and open questions. Never invent an owner, date, or decision." },
  { slug: "study-guide", name: "Study guide", category: "Learning", description: "Make a focused study guide with key ideas and practice questions.", instructions: "Turn the provided material or topic into a focused study guide with key concepts, simple explanations, a short glossary, and five practice questions with answers. Clearly distinguish source facts from helpful examples." },
  { slug: "research-brief", name: "Research brief", category: "Research", description: "Structure a research question, evidence needs, and open uncertainties.", instructions: "Create a concise research brief: question, scope, what evidence would answer it, key uncertainties, and a practical research plan. Do not present unverified claims as findings; distinguish what is known from what needs research." },
];

export const WORKSPACE_SKILLS = workspaceSkills.map((skill) => ({
  ...skill,
  category: skill.category || "Developer tools",
  instructions: skill.instructions || skill.description,
  source: "workspace",
}));

export const ALL_SKILLS = [...BUILT_IN_SKILLS, ...WORKSPACE_SKILLS];

const skillStorageKey = (userId) => `jan-installed-skills-${userId || "guest"}`;

export function readInstalledSkillSlugs(userId) {
  const defaults = WORKSPACE_SKILLS.map((skill) => skill.slug);
  try {
    const saved = JSON.parse(window.localStorage.getItem(skillStorageKey(userId)) || "null");
    if (Array.isArray(saved)) return [...new Set(saved.filter((slug) => ALL_SKILLS.some((skill) => skill.slug === slug)))];
  } catch { /* Use workspace skills when storage is unavailable. */ }
  return defaults;
}

export function writeInstalledSkillSlugs(userId, slugs) {
  try { window.localStorage.setItem(skillStorageKey(userId), JSON.stringify([...new Set(slugs)])); }
  catch { /* Keep this session's installed list when storage is unavailable. */ }
}

export function parseSkillCommand(text, installedSlugs) {
  const match = String(text || "").match(/^\/([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
  if (!match || !installedSlugs.includes(match[1].toLowerCase())) return null;
  const skill = ALL_SKILLS.find((item) => item.slug.toLowerCase() === match[1].toLowerCase());
  return skill ? { skill, request: match[2]?.trim() || "" } : null;
}
