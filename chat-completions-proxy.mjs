#!/usr/bin/env node
/**
 * Chat Completions API Proxy — Express Server
 *
 * Mirrors google_openai_middleware.js but adapted for our GCP project.
 * Forwards OpenAI-compatible requests to Gemini's Chat Completions API on Vertex AI.
 *
 * This lets any OpenAI SDK client (Claude Code, Cursor, etc.) talk to Gemini.
 *
 * Usage:
 *   node chat-completions-proxy.mjs
 *
 * Then point your OpenAI client at:
 *   base_url = http://localhost:4000/v1
 *   api_key  = anything (we use our own OAuth token)
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleAuth } from "google-auth-library";

// ── Config ────────────────────────────────────────────────────────────────────

const PORT = 4000;
const PROJECT_ID = "project-9a3e09d5-57ca-491d-a74";
const PROJECT_NUMBER = "962758340842";
const LOCATION = "us-central1";
const DEFAULT_MODEL = "google/gemini-2.0-flash-001";

// URL variants — the standardUrl is what the user's middleware uses
const standardUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/openapi/chat/completions`;
const customUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_NUMBER}/locations/${LOCATION}/endpoints/openapi/chat/completions`;

// ── Auth Setup ────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
const envContent = fs.readFileSync(envPath, "utf-8");

// Parse GCA_KEY from .env (inline JSON in single quotes)
const match = envContent.match(/GCA_KEY='([\s\S]*?)'/);
if (!match) {
  console.error("❌ Could not find GCA_KEY in .env");
  process.exit(1);
}

const keyData = JSON.parse(match[1]);
console.log(`📋 Service account: ${keyData.client_email}`);
console.log(`📋 Project ID: ${keyData.project_id}`);

const auth = new GoogleAuth({
  credentials: keyData,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

// Token caching
let accessToken = null;
let expiresAt = 0;

async function getAuthToken() {
  const now = Date.now();
  if (accessToken && expiresAt > now + 60000) {
    return accessToken;
  }
  console.log("🔄 Refreshing OAuth token...");
  const token = await auth.getAccessToken();
  // GoogleAuth tokens typically expire in 1 hour
  accessToken = token;
  expiresAt = now + 55 * 60 * 1000; // assume 55 min to be safe
  return token;
}

// ── Express App ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", project: PROJECT_ID, upstream: standardUrl });
});

// Models list (minimal — just enough for OpenAI SDK client discovery)
app.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: [
      { id: DEFAULT_MODEL, object: "model", owned_by: "google" },
      { id: "google/gemini-2.5-flash-preview-05-20", object: "model", owned_by: "google" },
      { id: "google/gemini-3-flash-preview", object: "model", owned_by: "google" },
    ],
  });
});

// Chat completions — the main proxy
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const reqBody = req.body;

    // Override model if not specified or if client sends a non-Gemini model
    const model = reqBody.model?.startsWith("google/")
      ? reqBody.model
      : DEFAULT_MODEL;

    // Build the forwarded payload
    const payload = {
      ...reqBody,
      model,
    };

    // Remove any OpenAI-specific fields that Gemini doesn't understand
    // (Gemini's Chat Completions API is compatible but may reject some fields)
    // Keep: model, messages, temperature, max_tokens, top_p, stream, tools, tool_choice

    console.log(`\n📥 Request: model=${model}, stream=${payload.stream || false}, messages=${payload.messages?.length}`);

    // Get auth token
    const token = await getAuthToken();

    // Try standard URL first, fall back to custom URL
    let targetUrl = standardUrl;
    let response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    // If standard URL fails with 404, try custom URL with project number
    if (response.status === 404) {
      console.log(`⚠️  Standard URL returned 404, trying custom URL...`);
      targetUrl = customUrl;
      response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    }

    // Handle streaming
    if (payload.stream) {
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Upstream error: ${response.status} ${errorText.slice(0, 200)}`);
        return res.status(response.status).json({ error: { message: errorText.slice(0, 500) } });
      }

      console.log("📤 Streaming response...");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (e) {
        console.error("Stream read error:", e.message);
      }
      res.end();
      return;
    }

    // Non-streaming
    const responseText = await response.text();

    if (!response.ok) {
      console.error(`❌ Upstream error: ${response.status}`);
      console.error(`   ${responseText.slice(0, 300)}`);
      return res.status(response.status).send(responseText);
    }

    const responseData = JSON.parse(responseText);
    console.log(`✅ Response: ${responseData.choices?.[0]?.message?.content?.slice(0, 80) || "(tool call)"}`);

    // Log usage
    if (responseData.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } = responseData.usage;
      const timestamp = new Date().toISOString();
      const tsvLine = `${timestamp}\t${prompt_tokens}\t${completion_tokens}\t${total_tokens}\n`;
      fs.appendFile(path.join(__dirname, "usage_log.tsv"), tsvLine, () => {});
    }

    // Log request for debugging
    fs.appendFile(
      path.join(__dirname, "req_log.tsv"),
      `${new Date().toISOString()}\t${model}\t${JSON.stringify(reqBody.messages?.slice(-1)?.[0]?.content || "").slice(0, 100)}\n`,
      () => {}
    );

    res.json(responseData);
  } catch (error) {
    console.error("❌ Proxy error:", error.message);
    res.status(500).json({ error: { message: error.message } });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Chat Completions Proxy running at http://localhost:${PORT}`);
  console.log(`   Target: ${standardUrl}`);
  console.log(`   Default model: ${DEFAULT_MODEL}`);
  console.log(`\n   Usage with OpenAI SDK:`);
  console.log(`     const openai = new OpenAI({`);
  console.log(`       baseURL: "http://localhost:${PORT}/v1",`);
  console.log(`       apiKey: "anything"`);
  console.log(`     });`);
  console.log(`\n   Test: curl http://localhost:${PORT}/health`);
});
