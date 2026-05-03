import { createRequire } from "module";

const backendRequire = createRequire(new URL("./TeachingBoard-backend/server.js", import.meta.url));
backendRequire("dotenv").config({ path: "./TeachingBoard-backend/.env" });
const { start } = backendRequire("./server.js");

start().catch(error => {
  console.error("Startup failed:", error);
  process.exit(1);
});
