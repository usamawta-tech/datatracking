// Creates a test user and mints a session JWT for Playwright testing
import { SignJWT } from "jose";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SECRET = "local-dev-secret-change-this-in-production-32chars";
const encodedKey = new TextEncoder().encode(SECRET);

const db = createClient({
  url: `file:${path.join(__dirname, "prisma", "dev.db")}`,
});

async function run() {
  // Find or create test user
  let user = null;
  try {
    const res = await db.execute({
      sql: "SELECT id, email, siteKey FROM User WHERE email = ? LIMIT 1",
      args: ["data@wetrackads.com"],
    });
    if (res.rows.length > 0) {
      user = res.rows[0];
      console.log("Found existing user:", user.email);
    }
  } catch (e) {
    console.error("DB query error:", e.message);
  }

  if (!user) {
    // Create test user
    const id = "test-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const siteKey = "sk-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      await db.execute({
        sql: `INSERT INTO User (id, email, siteKey, emailVerified, createdAt, updatedAt)
              VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
        args: [id, "data@wetrackads.com", siteKey],
      });
      user = { id, email: "data@wetrackads.com", siteKey };
      console.log("Created new user:", user.email);
    } catch (e) {
      console.error("Failed to create user:", e.message);
      process.exit(1);
    }
  }

  // Mint JWT
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ userId: user.id, email: user.email, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);

  console.log("SESSION_TOKEN=" + token);
  console.log("USER_ID=" + user.id);
  console.log("SITE_KEY=" + user.siteKey);
}

run().catch(console.error);
