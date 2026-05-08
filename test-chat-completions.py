#!/usr/bin/env node
"""
Test Gemini Chat Completions API with tool calling.
Tries all location variants and auth methods.
"""

import os, sys, json, re, subprocess

# ── Load credentials from .env ────────────────────────────────────────────────

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
with open(ENV_PATH) as f:
    env_content = f.read()

# Parse GOOGLE_CLOUD_API_KEY
m = re.search(r"GOOGLE_CLOUD_API_KEY=['\"]?([^'\"\n]+)['\"]?", env_content)
API_KEY = m.group(1) if m else ""

# Parse GCA_KEY (multiline JSON in single quotes)
m = re.search(r"GCA_KEY='([\s\S]*?)'", env_content)
SA_INFO = json.loads(m.group(1)) if m else {}

PROJECT_ID = SA_INFO.get("project_id", "project-9a3e09d5-57ca-491d-a74")

# ── Get OAuth token from service account ──────────────────────────────────────

def get_oauth_token():
    """Mint an OAuth access token from the GCA_KEY service account."""
    from google.oauth2 import service_account
    import google.auth.transport.requests

    creds = service_account.Credentials.from_service_account_info(
        SA_INFO, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token

# ── Test Chat Completions REST endpoint ────────────────────────────────────────

LOCATIONS = ["us-central1", "global", "us"]
API_VERSIONS = ["v1beta1", "v1"]

def test_chat_completions(token, location, api_version, model, payload, label=""):
    """Fire a request at the Chat Completions endpoint and return result."""
    url = (
        f"https://{location}-aiplatform.googleapis.com/{api_version}/"
        f"projects/{PROJECT_ID}/locations/{location}/endpoints/openapi/chat/completions"
    )

    import urllib.request, urllib.error

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
            return {"ok": True, "data": body, "url": url}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            err = json.loads(body)
            code = err.get("error", {}).get("code", e.code)
            msg = err.get("error", {}).get("message", body)[:120]
        except:
            code = e.code
            msg = body[:120]
        return {"ok": False, "code": code, "msg": msg, "url": url}
    except Exception as e:
        return {"ok": False, "code": 0, "msg": str(e)[:120], "url": url}

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("🌐 Gemini Chat Completions API — Full Sweep Test")
    print(f"   Project: {PROJECT_ID}")
    print()

    # Step 1: Get OAuth token
    try:
        token = get_oauth_token()
        print(f"✅ OAuth token obtained ({token[:20]}...)")
    except Exception as e:
        print(f"❌ Cannot get OAuth token: {e}")
        sys.exit(1)

    # Step 2: Build payloads

    # Simple chat payload
    simple_payload = {
        "model": "google/gemini-3-flash-preview",
        "messages": [
            {"role": "system", "content": "Reply in one sentence."},
            {"role": "user", "content": "Why is the sky blue?"},
        ],
        "max_tokens": 100,
    }

    # Tool-calling payload: ls tool
    tool_payload = {
        "model": "google/gemini-3-flash-preview",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant with access to file system tools. Use them when asked about files.",
            },
            {
                "role": "user",
                "content": "List the files in the current directory",
            },
        ],
        "max_tokens": 200,
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "list_files",
                    "description": "List files and directories in the specified path. Returns filenames and types.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Directory path to list. Use '.' for current directory.",
                            },
                            "show_hidden": {
                                "type": "boolean",
                                "description": "Whether to show hidden files (starting with .)",
                            },
                        },
                        "required": ["path"],
                    },
                },
            }
        ],
    }

    # ── Discovery: try all location + api_version combos ──────────────────────

    print("\n" + "=" * 70)
    print("🔍 PHASE 1: Discovery — all location × api_version combos")
    print("=" * 70)

    working_combos = []

    for location in LOCATIONS:
        for api_version in API_VERSIONS:
            label = f"{location}/{api_version}"
            print(f"\n   Testing {label} ...", end=" ")
            result = test_chat_completions(token, location, api_version, "google/gemini-3-flash-preview", simple_payload)
            if result["ok"]:
                content = result["data"]["choices"][0]["message"]["content"][:60]
                print(f"✅ WORKS! → {content}")
                working_combos.append({"location": location, "api_version": api_version, "url": result["url"]})
            else:
                print(f"❌ {result['code']}: {result['msg'][:60]}")

    # ── If we found working combos, test tool calling ──────────────────────────

    if not working_combos:
        print("\n" + "=" * 70)
        print("❌ No working Chat Completions endpoint found!")
        print("   Trying with project NUMBER instead of project ID...")
        print("=" * 70)

        # Try with project number
        PROJECT_NUMBER = "962758340842"
        for location in LOCATIONS:
            for api_version in API_VERSIONS:
                url = (
                    f"https://{location}-aiplatform.googleapis.com/{api_version}/"
                    f"projects/{PROJECT_NUMBER}/locations/{location}/endpoints/openapi/chat/completions"
                )
                import urllib.request, urllib.error
                headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                data = json.dumps(simple_payload).encode()
                req = urllib.request.Request(url, data=data, headers=headers, method="POST")
                print(f"\n   Testing {location}/{api_version} (project NUMBER)...", end=" ")
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        body = json.loads(resp.read().decode())
                        content = body["choices"][0]["message"]["content"][:60]
                        print(f"✅ WORKS! → {content}")
                        working_combos.append({"location": location, "api_version": api_version, "url": url})
                except urllib.error.HTTPError as e:
                    err = e.read().decode()[:80]
                    print(f"❌ {e.code}: {err}")
                except Exception as e:
                    print(f"❌ {e}")

    if not working_combos:
        print("\n❌ Chat Completions API is NOT available for this GCP project.")
        print("   The native generateContent API works (via genai SDK + API key).")
        print("   For the AgentLoop port, we should use the native API instead.")
        return

    # ── Test tool calling on the first working combo ──────────────────────────

    print("\n" + "=" * 70)
    print("🔧 PHASE 2: Tool calling test (ls tool)")
    print("=" * 70)

    combo = working_combos[0]
    print(f"\n   Using: {combo['location']}/{combo['api_version']}")
    print(f"   URL: {combo['url']}")

    result = test_chat_completions(token, combo["location"], combo["api_version"], "google/gemini-3-flash-preview", tool_payload)

    if result["ok"]:
        choice = result["data"]["choices"][0]
        msg = choice["message"]

        if msg.get("tool_calls"):
            print("   ✅ Tool call received!")
            for tc in msg["tool_calls"]:
                fn = tc["function"]
                print(f"   🔧 {fn['name']}({fn['arguments']})")

                # Simulate executing the tool
                args = json.loads(fn["arguments"])
                if fn["name"] == "list_files":
                    path = args.get("path", ".")
                    try:
                        entries = os.listdir(path)
                        tool_result = json.dumps({"files": entries[:20], "count": len(entries)})
                    except Exception as e:
                        tool_result = json.dumps({"error": str(e)})
                    print(f"   📂 Tool result: {tool_result[:100]}")

                    # Feed tool result back — multi-turn Chat Completions
                    print()
                    print("   📤 Feeding tool result back to model...")

                    multi_payload = {
                        "model": "google/gemini-3-flash-preview",
                        "messages": [
                            tool_payload["messages"][0],  # system
                            tool_payload["messages"][1],  # user
                            msg,  # assistant with tool_call
                            {
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": tool_result,
                            },
                        ],
                        "max_tokens": 200,
                    }

                    result2 = test_chat_completions(token, combo["location"], combo["api_version"], "google/gemini-3-flash-preview", multi_payload)
                    if result2["ok"]:
                        final = result2["data"]["choices"][0]["message"]["content"]
                        print(f"   ✅ Final answer: {final[:200]}")
                    else:
                        print(f"   ❌ Follow-up failed: {result2['msg'][:100]}")
        else:
            print(f"   ⚠️  No tool call — model said: {msg.get('content', '?')[:150]}")
    else:
        print(f"   ❌ Tool test failed: {result['msg'][:150]}")

    # ── Test streaming ────────────────────────────────────────────────────────

    print("\n" + "=" * 70)
    print("🌊 PHASE 3: Streaming test")
    print("=" * 70)

    stream_payload = {
        "model": "google/gemini-3-flash-preview",
        "messages": [{"role": "user", "content": "Count from 1 to 5"}],
        "max_tokens": 50,
        "stream": True,
    }

    combo = working_combos[0]
    url = combo["url"]
    print(f"   Streaming from: {url}")

    import urllib.request, urllib.error
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = json.dumps(stream_payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print("   ✅ Stream started:")
            full = ""
            for line in resp:
                line = line.decode().strip()
                if line.startswith("data: ") and line != "data: [DONE]":
                    try:
                        chunk = json.loads(line[6:])
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            print(f"   {delta}", end="", flush=True)
                            full += delta
                    except:
                        pass
            print(f"\n   ✅ Stream complete: \"{full[:80]}\"")
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:100]
        print(f"   ❌ Stream failed: {e.code}: {err}")
    except Exception as e:
        print(f"   ❌ Stream failed: {e}")

    # ── Summary ────────────────────────────────────────────────────────────────

    print("\n" + "=" * 70)
    print("📋 SUMMARY")
    print("=" * 70)
    print(f"   Working combos: {len(working_combos)}")
    for c in working_combos:
        print(f"   ✅ {c['location']}/{c['api_version']} → {c['url']}")


if __name__ == "__main__":
    main()