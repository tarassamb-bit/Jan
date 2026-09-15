import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_MODEL, listAvailableModels, requestGroq, requestGroqStream, validateMessages } from "./api/chat.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localChatApi = {
    name: "local-chat-api",
    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (req.method === "GET") {
          res.statusCode = 200;
          const models = await listAvailableModels(env.GROQ_API_KEY);
          const preferred = env.GROQ_MODEL || DEFAULT_MODEL;
          res.end(JSON.stringify({ configured: Boolean(env.GROQ_API_KEY), model: models.includes(preferred) ? preferred : models[0], models }));
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Request body must be valid JSON." }));
          return;
        }
        const messages = validateMessages(body.messages);
        if (!messages) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Send between 1 and 20 valid chat messages, up to 16,000 characters each." }));
          return;
        }
        if (!env.GROQ_API_KEY) {
          res.statusCode = 503;
          res.end(JSON.stringify({ code: "GROQ_NOT_CONFIGURED", error: "Groq is not connected yet." }));
          return;
        }
        const availableModels = await listAvailableModels(env.GROQ_API_KEY);
        const requestedModel = body.model;
        const configuredModel = env.GROQ_MODEL || DEFAULT_MODEL;
        const model = requestedModel && availableModels.includes(requestedModel) ? requestedModel : availableModels.includes(configuredModel) ? configuredModel : availableModels[0];
        const containsImages = messages.some((message) => Array.isArray(message.content) && message.content.some((part) => part.type === "image_url"));
        if (containsImages && model !== "qwen/qwen3.8-27b") {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Photos require Qwen 3.8 Vision. Select that model and try again." }));
          return;
        }
        try {
          if (body.stream === true) {
            const controller = new AbortController();
            req.once("aborted", () => controller.abort());
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache, no-transform");
            res.setHeader("Connection", "keep-alive");
            const upstream = await requestGroqStream({ messages, apiKey: env.GROQ_API_KEY, model, signal: controller.signal });
            const reader = upstream.body.getReader();
            res.once("close", () => { if (!res.writableEnded) reader.cancel().catch(() => {}); });
            while (!res.writableEnded) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(Buffer.from(value));
            }
            if (!res.writableEnded) res.end();
            return;
          }
          const answer = await requestGroq({ messages, apiKey: env.GROQ_API_KEY, model });
          res.statusCode = 200;
          res.end(JSON.stringify(answer));
        } catch (error) {
          res.statusCode = error.status >= 400 && error.status < 500 ? error.status : 502;
          res.end(JSON.stringify({ error: error.message || "The AI provider is unavailable." }));
        }
      });
    },
  };

  return {
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), localChatApi],
  };
});
