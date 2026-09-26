const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/prisma");

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[db] PostgreSQL connection OK");
  } catch (error) {
    console.error("[db] Could not connect to PostgreSQL:");
    console.error(error.message);
    console.error("Check DATABASE_URL in backend/.env and that PostgreSQL is running.");
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`\n  Nouri API  ->  http://localhost:${env.port}/api/health`);
    if (env.serveFrontend) {
      console.log(`  Frontend    ->  http://localhost:${env.port}/`);
    }
    console.log(`  AI provider ->  ${env.aiProvider}${env.aiProvider === "gemini" && env.geminiApiKey ? " (configured)" : (env.aiProvider === "gemini" || env.aiProvider === "mock") && !env.geminiApiKey ? " (mock fallback - no key)" : ""}\n`);
  });

  const shutdown = async () => {
    console.log("\nShutting down...");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();