import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localChatApi } from "./server/dev-api.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const runtimeEnv = {
    ...env,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_URL_2 || "",
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
  };

  return {
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(runtimeEnv.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(runtimeEnv.VITE_SUPABASE_ANON_KEY),
  },
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-dom/client"],
          supabase: ["@supabase/supabase-js"],
          icons: ["react-icons/fi", "react-icons/fa", "react-icons/fa6", "react-icons/lu"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), localChatApi(env)],
  };
});
