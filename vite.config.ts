import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: process.env.BASE_PATH,
  // don't copy the (potentially huge) public directory to the build
  publicDir: command === "serve" ? "public" : false,
}));
