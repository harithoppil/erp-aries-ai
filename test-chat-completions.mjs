#!/usr/bin/env node
/**
 * Google Gemini Chat Completions API Test
 *
 * Mirrors the google_openai_middleware.js pattern but adapted for our project.
 * Tests the OpenAI-compatible Chat Completions endpoint on Vertex AI.
 *
 * Two methods:
 *   1. Direct: Mint our own OAuth token from GCA_KEY service account → call Vertex AI
 *   2. Proxy:  Use the Python backend's /api/v1/ai/token endpoint → call Vertex AI
 *
 * Usage:
 *   node test-chat-completions.mjs              # Method 1 (direct)
 *   node test-chat-completions.mjs --proxy      # Method 2 (via Python backend token)
 *   node test-chat-completions.mjs --stream     # Test streaming
 *   node test-chat-completions.mjs --tools      # Test tool calling
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── Config ────────────────────────────────────────────────────────────────────

const PROJECT_ID = "project-9a3e09d5-57ca-491d-a74";
const PROJECT_NUMBER = "962758340842";
const LOCATION = "us-central1";
const MODEL = "google/gemini-2.0-flash-001"; // OpenAI-compatible format: google/{model}
const MODELS_TO_TRY = [
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-flash-preview-05-20",
  "google/gemini-3-flash-preview",
];

// URL variants to test (the user's middleware uses v1beta1 with /endpoints/openapi)
const URL_VARIANTS = {
  standard_v1beta1: `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/openapi/chat/completions`,
  standard_v1: `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/openapi/chat/completions`,
  custom_endpoint: `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_NUMBER}/locations/${LOCATION}/endpoints/openapi/chat/completions`,
};

// ── Auth: Method 1 — Direct from GCA_KEY ──────────────────────────────────────

async function getDirectToken() {
  // Read .env file and parse GCA_KEY (inline JSON)
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
  const envContent = fs.readFileSync(envPath, "utf-8");

  // Extract GCA_KEY value (multi-line JSON between single quotes)
  const match = envContent.match(/GCA_KEY='([\s\S]*?)'/);
  if (!match) {
    throw new Error("Could not find GCA_KEY in .env");
  }

  const keyJson = match[1];
  const keyData = JSON.parse(keyJson);

  // Use google-auth-library to mint an OAuth token
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: keyData,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const token = await auth.getAccessToken();
  console.log("✅ Direct token obtained (from GCA_KEY service account)");
  return token;
}

// ── Auth: Method 2 — Via Python backend ────────────────────────────────────────

async function getProxyToken() {
  const res = await fetch("http://localhost:8001/api/v1/ai/token");
  if (!res.ok) throw new Error(`Token endpoint failed: ${res.status}`);
  const data = await res.json();
  console.log("✅ Proxy token obtained (from Python backend /api/v1/ai/token)");
  return data.token;
}

// ── Test: Basic chat completion ────────────────────────────────────────────────

async function testBasicChat(token, url, model) {
  const payload = {
    model,
    messages: [
      { role: "system", content: "You are a helpful assistant. Reply in one sentence." },
      { role: "user", content: "Why is the sky blue?" },
    ],
    max_tokens: 200,
    temperature: 0.7,
  };

  console.log(`\n📤 Testing: ${url}`);
  console.log(`   Model: ${model}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (!response.ok) {
    console.log(`   ❌ HTTP ${response.status}`);
    try {
      const err = JSON.parse(text);
      console.log(`   Error: ${err.error?.message || JSON.stringify(err).slice(0, 200)}`);
    } catch {
      console.log(`   Error: ${text.slice(0, 200)}`);
    }
    return null;
  }

  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content || "(no content)";
  console.log(`   ✅ Success!`);
  console.log(`   Response: ${content.slice(0, 150)}`);
  console.log(`   Usage: ${JSON.stringify(data.usage)}`);
  return data;
}

// ── Test: Streaming ────────────────────────────────────────────────────────────

async function testStreaming(token, url, model) {
  const payload = {
    model,
    messages: [
      { role: "user", content: "Count from 1 to 5, one number per line." },
    ],
    max_tokens: 100,
    stream: true,
  };

  console.log(`\n📤 Testing STREAMING: ${url}`);
  console.log(`   Model: ${model}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    console.log(`   ❌ HTTP ${response.status}: ${err.slice(0, 200)}`);
    return;
  }

  console.log("   ✅ Stream started:");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    // Parse SSE data lines
    for (const line of chunk.split("\n")) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const parsed = JSON.parse(line.slice(6));
          const delta = parsed.choices?.[0]?.delta?.content || "";
          if (delta) {
            process.stdout.write(delta);
            fullContent += delta;
          }
        } catch {}
      }
    }
  }

  console.log(`\n   ✅ Stream complete. Full: "${fullContent.slice(0, 100)}"`);
}

// ── Test: Tool calling ────────────────────────────────────────────────────────

async function testToolCalling(token, url, model) {
  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: "You are an ERP assistant. Use the provided tools to help users.",
      },
      {
        role: "user",
        content: "Look up the customer named Acme Marine",
      },
    ],
    max_tokens: 500,
    tools: [
      {
        type: "function",
        function: {
          name: "erp_customer_lookup",
          description: "Look up a customer by name in the ERP system",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Customer name to search for",
              },
            },
            required: ["name"],
          },
        },
      },
    ],
  };

  console.log(`\n📤 Testing TOOL CALLING: ${url}`);
  console.log(`   Model: ${model}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (!response.ok) {
    console.log(`   ❌ HTTP ${response.status}: ${text.slice(0, 200)}`);
    return null;
  }

  const data = JSON.parse(text);
  const choice = data.choices?.[0];

  if (choice?.message?.tool_calls) {
    console.log(`   ✅ Tool call received!`);
    for (const tc of choice.message.tool_calls) {
      console.log(`   Tool: ${tc.function.name}(${tc.function.arguments})`);
    }
  } else if (choice?.message?.content) {
    console.log(`   ⚠️  No tool call — model responded with text instead:`);
    console.log(`   "${choice.message.content.slice(0, 150)}"`);
  } else {
    console.log(`   ⚠️  Unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return data;
}

// ── Test: URL discovery ────────────────────────────────────────────────────────

async function testUrlDiscovery(token) {
  console.log("\n🔍 URL DISCOVERY — Testing all URL variants with all models...\n");

  const results = [];

  for (const [urlName, url] of Object.entries(URL_VARIANTS)) {
    for (const model of MODELS_TO_TRY) {
      const label = `${urlName} + ${model}`;
      process.stdout.write(`   Testing ${label} ... `);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          }),
        });

        if (res.ok) {
          console.log("✅ WORKS!");
          results.push({ urlName, url, model, status: "OK" });
        } else {
          const err = await res.text().catch(() => "");
          const code = err.includes('"code"') ? err.match(/"code":\s*(\d+)/)?.[1] : res.status;
          console.log(`❌ ${code}`);
          results.push({ urlName, url, model, status: `${res.status}` });
        }
      } catch (e) {
        console.log(`❌ ${e.message.slice(0, 60)}`);
        results.push({ urlName, url, model, status: "ERROR" });
      }
    }
  }

  // Summary
  const working = results.filter((r) => r.status === "OK");
  console.log("\n📋 SUMMARY:");
  if (working.length > 0) {
    console.log(`   ${working.length} working combination(s):`);
    for (const w of working) {
      console.log(`   ✅ ${w.urlName} + ${w.model}`);
      console.log(`      URL: ${w.url}`);
    }
  } else {
    console.log("   ❌ No working combinations found.");
    console.log("   The Chat Completions API may not be enabled for this GCP project.");
  }

  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const useProxy = args.includes("--proxy");
  const doStream = args.includes("--stream");
  const doTools = args.includes("--tools");
  const doDiscovery = args.includes("--discover") || args.length === 0;

  console.log("🌐 Gemini Chat Completions API Test");
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log(`   Project Number: ${PROJECT_NUMBER}`);
  console.log(`   Auth method: ${useProxy ? "Proxy (Python backend)" : "Direct (GCA_KEY)"}`);

  // Step 1: Get token
  let token;
  try {
    token = useProxy ? await getProxyToken() : await getDirectToken();
  } catch (e) {
    console.error(`❌ Failed to get token: ${e.message}`);
    if (useProxy) {
      console.error("   Make sure the Python backend is running on port 8001");
    }
    process.exit(1);
  }

  // Step 2: Discover which URL + model combo works
  if (doDiscovery) {
    await testUrlDiscovery(token);
  }

  // Step 3: If a working combo is found, run deeper tests
  // (You can also manually specify --url and --model after finding a working combo)
  const targetUrl = URL_VARIANTS.standard_v1beta1;
  const targetModel = MODELS_TO_TRY[0];

  if (doStream) {
    try {
      await testStreaming(token, targetUrl, targetModel);
    } catch (e) {
      console.error(`❌ Streaming test failed: ${e.message}`);
    }
  }

  if (doTools) {
    try {
      await testToolCalling(token, targetUrl, targetModel);
    } catch (e) {
      console.error(`❌ Tool calling test failed: ${e.message}`);
    }
  }
}

main().catch(console.error);
