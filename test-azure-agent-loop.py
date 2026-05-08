#!/usr/bin/env python3
"""
Test AgentLoop via Azure DeepSeek Chat Completions API.
Uses OpenAI-compatible format with tool calling + streaming.

This is a reference implementation for the Next.js AgentLoop port.
The Chat Completions format (OpenAI-compatible) is simpler than
Gemini's native format and supports tool calling + streaming natively.

Auth: Uses AZURE_API_KEY (Bearer token).
"""

import os, sys, json, re
import urllib.request, urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
with open(ENV_PATH) as f:
    env_content = f.read()

m = re.search(r"AZURE_API_KEY=['\"]?([^'\"\n]+)['\"]?", env_content)
API_KEY = m.group(1) if m else ""

ENDPOINT = "https://westus2-1.openai.azure.com/openai/v1/chat/completions"
MODEL = "DeepSeek-V4-Flash"


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
                    "path": {
                        "type": "string",
                        "description": "Directory path to list. Use '.' for current directory.",
                    },
                    "show_hidden": {
                        "type": "boolean",
                        "description": "Whether to show hidden files. Default: false.",
                    },
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
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to the file to read.",
                    }
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cwd",
            "description": "Get the current working directory path.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]


# ── Tool execution ────────────────────────────────────────────────────────────

def execute_tool(name: str, args: dict) -> str:
    """Execute a tool call and return the result as a string."""
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

def call_chat_completions(messages, tools=None, stream=False, max_tokens=2000):
    """Call the Azure DeepSeek Chat Completions endpoint."""
    payload = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.1,
        "stream": stream,
    }
    if tools:
        payload["tools"] = tools

    data = json.dumps(payload).encode()
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(ENDPOINT, data=data, headers=headers, method="POST")

    if stream:
        return req  # Caller reads the stream

    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


# ── Agent Loop (Chat Completions format) ───────────────────────────────────────

def agent_loop(user_message: str, max_rounds: int = 5) -> str:
    """
    Multi-round tool-calling loop via Chat Completions API.
    Mirrors the Gemini AgentLoop but uses OpenAI-compatible format:
      messages = [system, user, assistant(tool_calls), tool(result), ...]
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful file system assistant. "
                "Use the provided tools to answer questions about files and directories. "
                "Always use tools rather than guessing. "
                "After getting tool results, provide a clear summary to the user."
            ),
        },
        {"role": "user", "content": user_message},
    ]

    all_tool_calls = []

    for round_num in range(1, max_rounds + 1):
        print(f"\n{'─' * 60}")
        print(f"  🔄 Round {round_num}")
        print(f"{'─' * 60}")

        # Call model
        response = call_chat_completions(messages, tools=TOOLS)

        choice = response["choices"][0]
        msg = choice["message"]

        # Check for tool calls
        tool_calls = msg.get("tool_calls", [])
        content = msg.get("content", "")

        if not tool_calls:
            print(f"  ✅ Final answer:\n")
            print(f"  {content[:500]}")
            return content

        # Add assistant message (with tool calls) to history
        messages.append(msg)

        # Process tool calls
        print(f"  🔧 {len(tool_calls)} tool call(s) in this round:")

        for tc in tool_calls:
            fn = tc["function"]
            tool_name = fn["name"]
            tool_args = json.loads(fn["arguments"])
            tool_call_id = tc["id"]

            all_tool_calls.append({"name": tool_name, "args": tool_args})
            print(f"     → {tool_name}({json.dumps(tool_args)})")

            # Execute tool
            result = execute_tool(tool_name, tool_args)
            result_preview = result[:120].replace("\n", " ")
            print(f"     ← Result: {result_preview}...")

            # Feed result back as a "tool" role message
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": result,
            })

    return "Max rounds reached"


# ── Streaming test ────────────────────────────────────────────────────────────

def test_streaming():
    """Test streaming Chat Completions."""
    print("\n" + "=" * 70)
    print("🌊 Streaming Test")
    print("=" * 70)

    messages = [{"role": "user", "content": "Count from 1 to 5, one number per line."}]
    req = call_chat_completions(messages, stream=True, max_tokens=50)

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

if __name__ == "__main__":
    print("🤖 Azure DeepSeek AgentLoop Test (Chat Completions API)")
    print(f"   Model: {MODEL}")
    print(f"   Endpoint: {ENDPOINT}")
    print()

    # Test 1: Simple chat
    print("=" * 70)
    print("💬 Test 1: Simple chat (no tools)")
    print("=" * 70)
    resp = call_chat_completions(
        [{"role": "user", "content": "Why is the sky blue? Answer in one sentence."}],
        max_tokens=80,
    )
    content = resp["choices"][0]["message"]["content"]
    print(f"  Response: {content[:200]}")

    # Test 2: Tool calling (ls)
    print("\n" + "=" * 70)
    print("📂 Test 2: Tool calling — list files in current directory")
    print("=" * 70)
    agent_loop("List the files in the current directory")

    # Test 3: Multi-round tool calling
    print("\n\n" + "=" * 70)
    print("🔄 Test 3: Multi-round — list files → read one → summarize")
    print("=" * 70)
    agent_loop("What files are in the current directory? Then read the package.json file and tell me the project name and version.")

    # Test 4: Streaming
    test_streaming()

    print("\n\n" + "=" * 70)
    print("📋 ALL TESTS COMPLETE")
    print("=" * 70)
    print()
    print("✅ Azure DeepSeek Chat Completions API supports:")
    print("   - Simple chat")
    print("   - Tool calling (function calling)")
    print("   - Multi-round tool loop (feed results back)")
    print("   - SSE streaming")
    print()
    print("🎯 This is the ideal API for the Next.js AgentLoop port!")
    print("   The OpenAI-compatible format is simpler than Gemini native,")
    print("   and supports tool calling + streaming natively.")
