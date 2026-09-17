export const PROJECT_FILE_LIMIT = 8;
export const PROJECT_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const TEXT_FILE_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json", "application/javascript", "text/javascript", "text/css", "text/html"]);
export const TEXT_FILE_EXTENSION = /\.(md|txt|csv|json|js|jsx|ts|tsx|py|html|css|xml|yaml|yml)$/i;

export function safeProjectFileName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function compressProjectFile(file) {
  if (file.type === "image/webp") return { file, compression: "original" };
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
    if (!blob) throw new Error(`Couldn’t compress ${file.name}.`);
    const name = `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`;
    return { file: new File([blob], name, { type: "image/webp" }), compression: "webp" };
  }
  if ((TEXT_FILE_TYPES.has(file.type) || TEXT_FILE_EXTENSION.test(file.name)) && "CompressionStream" in window) {
    const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
    const blob = await new Response(stream).blob();
    return { file: new File([blob], `${file.name}.gz`, { type: "application/gzip" }), compression: "gzip" };
  }
  return { file, compression: "original" };
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_ATTACHMENT_CHARS = 6_000;
export const MAX_ATTACHMENTS = 6;
export const MAX_IMAGES_PER_MESSAGE = 3;
export const VISION_MODEL = "qwen/qwen3.8-27b";

export function clampAttachmentText(value) {
  const text = String(value || "").replace(/\u0000/g, "").trim();
  return text.length > MAX_ATTACHMENT_CHARS ? `${text.slice(0, MAX_ATTACHMENT_CHARS)}\n\n[File excerpt truncated]` : text;
}

export async function extractAttachment(file, maxBytes = MAX_ATTACHMENT_BYTES) {
  if (file.size > maxBytes) throw new Error(`${file.name} exceeds the file size limit.`);
  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const base = { name: file.name, type: file.type || (isPdf ? "application/pdf" : "text/plain"), size: file.size };

  if (file.type.startsWith("image/")) {
    const compressed = file.type === "image/webp" ? file : (await compressProjectFile(file)).file;
    if (compressed.size > 600_000) throw new Error(`${file.name} is too large after compression. Please use a smaller image.`);
    const bytes = new Uint8Array(await compressed.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    const dataUrl = `data:${compressed.type};base64,${btoa(binary)}`;
    return { ...base, type: compressed.type, size: compressed.size, preview: dataUrl, dataUrl, content: `[Image attached: ${file.name}]`, vision: true };
  }

  if (isPdf) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
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

  const acceptedText = file.type.startsWith("text/") || TEXT_FILE_EXTENSION.test(file.name);
  if (!acceptedText) throw new Error(`${file.name} is not a supported text, image, or PDF file.`);
  return { ...base, content: `[File: ${file.name}]\n${clampAttachmentText(await file.text())}` };
}


// Store useful source content, never ephemeral blob: preview URLs.
export function serializeAttachments(attachments = []) {
  return attachments.map(({ name, type, size, content, dataUrl, vision }) => ({ name, type, size, content, dataUrl, vision }));
}

export function restoreAttachments(attachments = []) {
  return attachments.map((file) => ({ ...file, preview: file.dataUrl }));
}

export async function loadProjectSources(project, client, isDemo) {
  return Promise.all((project.files || []).map(async (record) => {
    if (isDemo) {
      if (!record.source) throw new Error(`Attach ${record.name} again to use its contents in this demo.`);
      return record.source;
    }
    const { data, error } = await client.storage.from("project-files").download(record.path);
    if (error || !data) throw new Error(`Could not read ${record.name}. Please try again.`);
    const blob = record.compression === "gzip"
      ? await new Response(data.stream().pipeThrough(new DecompressionStream("gzip"))).blob()
      : data;
    const file = new File([blob], record.name, { type: record.compression === "webp" ? "image/webp" : record.type });
    return extractAttachment(file, PROJECT_FILE_MAX_BYTES);
  }));
}
