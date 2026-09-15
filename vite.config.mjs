import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { requestGroq, validateMessages } from "./api/chat.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localChatApi = {
    name: "local-chat-api",
    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (req.method === "GET") {
          res.statusCode = 200;
          res.end(JSON.stringify({ configured: Boolean(env.GROQ_API_KEY), model: env.GROQ_MODEL || "openai/gpt-oss-20b" }));
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
          res.end(JSON.stringify({ error: "Send between 1 and 20 valid chat messages." }));
          return;
        }
        if (!env.GROQ_API_KEY) {
          res.statusCode = 503;
          res.end(JSON.stringify({ code: "GROQ_NOT_CONFIGURED", error: "Groq is not connected yet." }));
          return;
        }
        try {
          const answer = await requestGroq({ messages, apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL });
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
