#!/usr/bin/env python3
"""
Unified AgentLoop Test — works with BOTH Gemini and Azure DeepSeek.

Both endpoints use the OpenAI Chat Completions API format:
  - Tool calling (function calling)
  - Multi-round tool loop (feed results back to model)
  - SSE streaming

Providers:
  gemini   → aiplatform.googleapis.com (API key or OAuth)
  azure    → westus2-1.openai.azure.com (API key)

Usage:
  python test-unified-agent-loop.py                  # default: gemini
  python test-unified-agent-loop.py --provider azure # DeepSeek V4 Flash
  python test-unified-agent-loop.py --provider gemini --auth oauth  # Gemini with OAuth
  python test-unified-agent-loop.py --test tools     # only test tool calling
  python test-unified-agent-loop.py --test stream    # only test streaming
"""

import os, sys, json, re, argparse
import urllib.request, urllib.error

# ── Load credentials from .env ────────────────────────────────────────────────

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
with open(ENV_PATH) as f:
    env_content = f.read()

# Parse GOOGLE_CLOUD_API_KEY
m = re.search(r"GOOGLE_CLOUD_API_KEY=['\"]?([^'\"\n]+)['\"]?", env_content)
GOOGLE_API_KEY = m.group(1) if m else ""

# Parse GCA_KEY (service account JSON)
m = re.search(r"GCA_KEY='([\s\S]*?)'", env_content)
SA_INFO = json.loads(m.group(1)) if m else {}

# Parse AZURE_API_KEY
m = re.search(r"AZURE_API_KEY=['\"]?([^'\"\n]+)['\"]?", env_content)
AZURE_API_KEY = m.group(1) if m else ""

PROJECT_ID = SA_INFO.get("project_id", "project-9a3e09d5-57ca-491d-a74")

# ── Provider configs ──────────────────────────────────────────────────────────

PROVIDERS = {
    "gemini": {
        "name": "Google Gemini",
        "models": ["google/gemini-3-flash-preview", "google/gemini-2.5-flash-preview-05-20"],
        "default_model": "google/gemini-3-flash-preview",
        # NOTE: hostname is aiplatform.googleapis.com (NO region prefix!)
        "url_apikey": f"https://aiplatform.googleapis.com/v1beta1/projects/{PROJECT_ID}/locations/us-central1/endpoints/openapi/chat/completions",
        "url_oauth": f"https://aiplatform.googleapis.com/v1beta1/projects/{PROJECT_ID}/locations/us-central1/endpoints/openapi/chat/completions",
        "auth_methods": ["apikey", "oauth"],
    },
    "azure": {
        "name": "Azure DeepSeek",
        "models": ["DeepSeek-V4-Flash"],
        "default_model": "DeepSeek-V4-Flash",
        "url": "https://westus2-1.openai.azure.com/openai/v1/chat/completions",
        "auth_methods": ["apikey"],
    },
}


# ── Auth helpers ───────────────────────────────────────────────────────────────

def get_google_oauth_token():
    """Mint an OAuth access token from the GCA_KEY service account."""
    from google.oauth2 import service_account
    import google.auth.transport.requests

    creds = service_account.Credentials.from_service_account_info(
        SA_INFO, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def get_google_apikey_url():
    """Return the Gemini endpoint URL with API key as query param."""
    return PROVIDERS["gemini"]["url_apikey"] + f"?key={GOOGLE_API_KEY}"


# ── Tool definitions (OpenAI Chat Completions format) ─────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files and directories in the specified path. Returns filenames, types (file/dir), and sizes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path to list. Use '.' for current directory."},
                    "show_hidden": {"type": "boolean", "description": "Whether to show hidden files. Default: false."},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file. Returns the file content as text (truncated to 2000 chars).",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Path to the file to read."}},
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cwd",
            "description": "Get the current working directory path.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


# ── Tool execution ────────────────────────────────────────────────────────────

def execute_tool(name: str, args: dict) -> str:
    if name == "list_files":
        path = args.get("path", ".")
        show_hidden = args.get("show_hidden", False)
        try:
            entries = os.listdir(path)
            if not show_hidden:
                entries = [e for e in entries if not e.startswith(".")]
            result = []
            for e in sorted(entries):
                full = os.path.join(path, e)
                is_dir = os.path.isdir(full)
                size = os.path.getsize(full) if not is_dir else "-"
                result.append({"name": e, "type": "dir" if is_dir else "file", "size": size})
            return json.dumps({"files": result[:30], "total": len(entries)}, indent=2)
        except Exception as ex:
            return json.dumps({"error": str(ex)})
    elif name == "read_file":
        path = args.get("path", "")
        try:
            with open(path) as f:
                content = f.read(2000)
            return content if len(content) < 2000 else content + "\n... (truncated)"
        except Exception as ex:
            return json.dumps({"error": str(ex)})
    elif name == "get_cwd":
        return os.getcwd()
    else:
        return json.dumps({"error": f"Unknown tool: {name}"})


# ── Chat Completions API call ─────────────────────────────────────────────────

def call_chat_completions(url, headers, messages, tools=None, stream=False, max_tokens=2000, model=None):
    """Call a Chat Completions endpoint. Returns parsed JSON or stream request."""
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.1,
        "stream": stream,
    }
    if tools:
        payload["tools"] = tools

    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    if stream:
        return req  # Caller reads the stream

    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


# ── Agent Loop ────────────────────────────────────────────────────────────────

def agent_loop(url, headers, model, user_message, max_rounds=5):
    """
    Multi-round tool-calling loop via Chat Completions API.
    Works identically for Gemini and Azure DeepSeek.
    """
    messages = [
        {"role": "system", "content": "You are a helpful file system assistant. Use the provided tools to answer questions about files. Always use tools rather than guessing."},
        {"role": "user", "content": user_message},
    ]

    all_tool_calls = []

    for round_num in range(1, max_rounds + 1):
        print(f"\n{'─' * 60}")
        print(f"  🔄 Round {round_num}")
        print(f"{'─' * 60}")

        response = call_chat_completions(url, headers, messages, tools=TOOLS, model=model)
        choice = response["choices"][0]
        msg = choice["message"]

        tool_calls = msg.get("tool_calls", [])
        content = msg.get("content", "")

        if not tool_calls:
            print(f"  ✅ Final answer:\n")
            print(f"  {content[:500]}")
            return content

        # Add assistant message with tool calls to history
        messages.append(msg)

        print(f"  🔧 {len(tool_calls)} tool call(s):")

        for tc in tool_calls:
            fn = tc["function"]
            tool_name = fn["name"]
            tool_args = json.loads(fn["arguments"])
            tool_call_id = tc["id"]

            all_tool_calls.append({"name": tool_name, "args": tool_args})
            print(f"     → {tool_name}({json.dumps(tool_args)})")

            result = execute_tool(tool_name, tool_args)
            result_preview = result[:120].replace("\n", " ")
            print(f"     ← Result: {result_preview}...")

            # Feed result back as "tool" role message
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": result,
            })

    return "Max rounds reached"


# ── Streaming test ────────────────────────────────────────────────────────────

def test_streaming(url, headers, model):
    print("\n" + "=" * 70)
    print("🌊 Streaming Test")
    print("=" * 70)

    messages = [{"role": "user", "content": "Count from 1 to 5, one number per line."}]
    req = call_chat_completions(url, headers, messages, stream=True, max_tokens=50, model=model)

    print(f"\n  Streaming response:\n")
    full_text = ""

    with urllib.request.urlopen(req, timeout=30) as resp:
        for line in resp:
            line = line.decode().strip()
            if line.startswith("data: ") and line != "data: [DONE]":
                try:
                    chunk = json.loads(line[6:])
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        print(f"  {content}", end="", flush=True)
                        full_text += content
                except:
                    pass

    print(f"\n\n  ✅ Stream complete: \"{full_text[:80]}\"")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Unified AgentLoop Test — Gemini + Azure DeepSeek")
    parser.add_argument("--provider", choices=["gemini", "azure"], default="gemini", help="AI provider")
    parser.add_argument("--auth", choices=["apikey", "oauth"], default="apikey", help="Auth method (gemini only)")
    parser.add_argument("--test", choices=["all", "chat", "tools", "stream", "loop"], default="all", help="Which test to run")
    parser.add_argument("--model", default=None, help="Override model name")
    args = parser.parse_args()

    provider_key = args.provider
    provider = PROVIDERS[provider_key]
    model = args.model or provider["default_model"]

    # ── Build URL + headers based on provider + auth ──────────────────────────

    if provider_key == "gemini":
        if args.auth == "apikey":
            url = get_google_apikey_url()
            headers = {"Content-Type": "application/json"}
            auth_label = f"API key ({GOOGLE_API_KEY[:15]}...)"
        else:  # oauth
            token = get_google_oauth_token()
            url = provider["url_oauth"]
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            auth_label = f"OAuth ({token[:15]}...)"
    else:  # azure
        url = provider["url"]
        headers = {
            "Authorization": f"Bearer {AZURE_API_KEY}",
            "Content-Type": "application/json",
        }
        auth_label = f"API key ({AZURE_API_KEY[:15]}...)"

    print(f"🤖 Unified AgentLoop Test")
    print(f"   Provider: {provider['name']}")
    print(f"   Model: {model}")
    print(f"   Auth: {auth_label}")
    print(f"   URL: {url[:80]}...")
    print()

    # ── Test 1: Simple chat ────────────────────────────────────────────────────

    if args.test in ("all", "chat"):
        print("=" * 70)
        print("💬 Test: Simple chat (no tools)")
        print("=" * 70)
        try:
            resp = call_chat_completions(
                url, headers,
                [{"role": "user", "content": "Why is the sky blue? Answer in one sentence."}],
                max_tokens=500,  # Gemini 3 flash uses reasoning tokens, needs higher limit
                model=model,
            )
            choice = resp["choices"][0]
            # Gemini may not include message when all tokens go to reasoning
            msg = choice.get("message", {})
            content = msg.get("content", "(no text content — reasoning tokens used)")
            finish = choice.get("finish_reason", "?")
            print(f"  ✅ Response (finish_reason={finish}): {content[:200]}")
        except Exception as e:
            print(f"  ❌ Failed: {e}")

    # ── Test 2: Tool calling ───────────────────────────────────────────────────

    if args.test in ("all", "tools"):
        print("\n" + "=" * 70)
        print("📂 Test: Tool calling — list files")
        print("=" * 70)
        try:
            resp = call_chat_completions(
                url, headers,
                [
                    {"role": "system", "content": "You are a file system assistant. Use tools."},
                    {"role": "user", "content": "List files in the current directory"},
                ],
                tools=TOOLS,
                max_tokens=300,
                model=model,
            )
            msg = resp["choices"][0]["message"]
            if msg.get("tool_calls"):
                print("  ✅ Tool call received!")
                for tc in msg["tool_calls"]:
                    fn = tc["function"]
                    print(f"     Tool: {fn['name']}({fn['arguments']})")
                    # Execute and show result
                    result = execute_tool(fn["name"], json.loads(fn["arguments"]))
                    print(f"     Result: {result[:120]}...")
            else:
                print(f"  ⚠️  No tool call, text: {msg.get('content','')[:150]}")
        except Exception as e:
            print(f"  ❌ Failed: {e}")

    # ── Test 3: Multi-round loop ───────────────────────────────────────────────

    if args.test in ("all", "loop"):
        print("\n" + "=" * 70)
        print("🔄 Test: Multi-round loop — list → read → summarize")
        print("=" * 70)
        try:
            agent_loop(
                url, headers, model,
                "What files are in the current directory? Then read the package.json and tell me the project name and version."
            )
        except Exception as e:
            print(f"  ❌ Failed: {e}")

    # ── Test 4: Streaming ──────────────────────────────────────────────────────

    if args.test in ("all", "stream"):
        try:
            test_streaming(url, headers, model)
        except Exception as e:
            print(f"  ❌ Streaming failed: {e}")

    # ── Summary ────────────────────────────────────────────────────────────────

    print("\n" + "=" * 70)
    print("📋 SUMMARY")
    print("=" * 70)
    print(f"   Provider: {provider['name']}")
    print(f"   Model: {model}")
    print(f"   URL: {url[:70]}...")
    print(f"   Auth: {args.auth}")
    print()
    print("   Available models:")
    for m in provider["models"]:
        print(f"     - {m}")


if __name__ == "__main__":
    main()
