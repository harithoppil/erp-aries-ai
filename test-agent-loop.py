#!/usr/bin/env node
"""
Test Gemini AgentLoop via the google-genai Python SDK.
This is what the Next.js AgentLoop port will use under the hood.

Tests:
  1. Simple chat
  2. Tool calling (list_files → model calls it → we execute → feed result back)
  3. Multi-round tool loop (model can call multiple tools in sequence)
  4. Streaming

Auth: Uses GOOGLE_CLOUD_API_KEY (API key auth, which is confirmed working).
"""

import os, sys, json, re, subprocess
from google import genai
from google.genai import types

# ── Load credentials from .env ────────────────────────────────────────────────

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
with open(ENV_PATH) as f:
    env_content = f.read()

m = re.search(r"GOOGLE_CLOUD_API_KEY=['\"]?([^'\"\n]+)['\"]?", env_content)
API_KEY = m.group(1) if m else ""

PROJECT_ID = "project-9a3e09d5-57ca-491d-a74"
MODEL = "gemini-3-flash-preview"

# ── Initialize client ─────────────────────────────────────────────────────────

client = genai.Client(vertexai=True, api_key=API_KEY)


# ── Tool definitions ──────────────────────────────────────────────────────────

# Define tools using the SDK's FunctionDeclaration
list_files_tool = types.FunctionDeclaration(
    name="list_files",
    description="List files and directories in the specified path. Returns filenames, types (file/dir), and sizes.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "path": types.Schema(type="STRING", description="Directory path to list. Use '.' for current directory."),
            "show_hidden": types.Schema(type="BOOLEAN", description="Whether to show hidden files (starting with .). Default: false."),
        },
        required=["path"],
    ),
)

read_file_tool = types.FunctionDeclaration(
    name="read_file",
    description="Read the contents of a file. Returns the file content as text (truncated to 2000 chars).",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "path": types.Schema(type="STRING", description="Path to the file to read."),
        },
        required=["path"],
    ),
)

get_cwd_tool = types.FunctionDeclaration(
    name="get_cwd",
    description="Get the current working directory path.",
    parameters=types.Schema(type="OBJECT", properties={}),  # no params
)

ALL_TOOLS = types.Tool(function_declarations=[list_files_tool, read_file_tool, get_cwd_tool])


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


# ── Agent Loop ────────────────────────────────────────────────────────────────

def agent_loop(user_message: str, max_rounds: int = 5) -> str:
    """
    Multi-round tool-calling loop via the genai SDK.
    Mirrors the Python AgentLoop algorithm:
      while rounds < MAX:
        call model with tools + history
        if no tool_calls → return text
        execute tool calls → feed results back → repeat
    """
    contents = []

    # System instruction
    system_instruction = (
        "You are a helpful file system assistant. "
        "Use the provided tools to answer questions about files and directories. "
        "Always use tools rather than guessing. "
        "After getting tool results, provide a clear summary to the user."
    )

    # User message
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))

    all_tool_calls = []

    for round_num in range(1, max_rounds + 1):
        print(f"\n{'─'*60}")
        print(f"  🔄 Round {round_num}")
        print(f"{'─'*60}")

        # Call Gemini with tool definitions
        response = client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[ALL_TOOLS],
                temperature=0.1,
                max_output_tokens=4096,
            ),
        )

        # Check response for tool calls
        candidate = response.candidates[0]
        parts = candidate.content.parts

        tool_calls_in_round = []
        text_parts = []

        for part in parts:
            if part.function_call:
                tool_calls_in_round.append(part.function_call)
            if part.text:
                text_parts.append(part.text)

        # If no tool calls, we're done
        if not tool_calls_in_round:
            final_text = "\n".join(text_parts)
            print(f"  ✅ Final answer (no more tool calls):\n")
            print(f"  {final_text[:500]}")
            return final_text

        # Process tool calls
        print(f"  🔧 {len(tool_calls_in_round)} tool call(s) in this round:")

        # Add model's response (with tool calls) to conversation
        contents.append(candidate.content)

        # Execute ALL tool calls and collect results, then feed them back
        # as a SINGLE Content with multiple functionResponse parts (Gemini requirement)
        function_response_parts = []

        for fc in tool_calls_in_round:
            tool_name = fc.name
            tool_args = dict(fc.args) if fc.args else {}
            all_tool_calls.append({"name": tool_name, "args": tool_args})

            print(f"     → {tool_name}({json.dumps(tool_args)})")

            # Execute the tool
            result = execute_tool(tool_name, tool_args)
            result_preview = result[:120].replace("\n", " ")
            print(f"     ← Result: {result_preview}...")

            # Collect function response part
            function_response_parts.append(
                types.Part.from_function_response(
                    name=tool_name,
                    response={"result": result}
                )
            )

        # Feed ALL tool results back as a single Content message (Gemini requirement:
        # "number of function response parts is equal to the number of function call parts")
        contents.append(
            types.Content(
                role="user",
                parts=function_response_parts,
            )
        )

    return "Max rounds reached"


# ── Streaming test ────────────────────────────────────────────────────────────

def test_streaming():
    """Test the streamGenerateContent endpoint."""
    print("\n" + "=" * 70)
    print("🌊 Streaming Test")
    print("=" * 70)

    prompt = "Count from 1 to 5, one number per line."
    print(f"\n  Prompt: {prompt}")
    print(f"  Streaming response:\n")

    full_text = ""
    for chunk in client.models.generate_content_stream(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=100,
        ),
    ):
        if chunk.text:
            print(f"  {chunk.text}", end="", flush=True)
            full_text += chunk.text

    print(f"\n\n  ✅ Stream complete: \"{full_text[:80]}\"")


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🤖 Gemini AgentLoop Test (via genai SDK + API key)")
    print(f"   Model: {MODEL}")
    print(f"   Project: {PROJECT_ID}")
    print()

    # Test 1: Simple chat (no tools)
    print("=" * 70)
    print("💬 Test 1: Simple chat (no tools)")
    print("=" * 70)
    resp = client.models.generate_content(
        model=MODEL,
        contents="Why is the sky blue? Answer in one sentence.",
        config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=50),
    )
    text = resp.text or "(no text)"
    print(f"  Response: {text[:100]}")

    # Test 2: Single tool call (ls)
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
