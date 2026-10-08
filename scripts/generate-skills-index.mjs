import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(root, ".agents", "skills");
const output = path.join(root, "src", "generated", "installed-skills.json");

export async function generateSkillsIndex() {
  let entries = [];
  let skillsRootExists = true;
  try { entries = await readdir(skillsRoot, { withFileTypes: true }); }
  catch (error) { if (error.code !== "ENOENT") throw error; skillsRootExists = false; }

  let skills = [];
  if (!skillsRootExists) {
    try { skills = JSON.parse(await readFile(output, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (skillsRootExists) skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    let source;
    try { source = await readFile(path.join(skillsRoot, slug, "SKILL.md"), "utf8"); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    const frontmatterMatch = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const frontmatter = frontmatterMatch?.[1] || "";
    const value = (key) => frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2") || "";
    const name = value("name");
    const description = value("description");
    const instructions = frontmatterMatch ? source.slice(frontmatterMatch[0].length).trim() : source.trim();
    if (name) skills.push({ slug, name, description, instructions });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(skills, null, 2)}\n`);
  return skills;
}

await generateSkillsIndex();
