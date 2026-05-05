"""Agent Orchestration Loop — full tool-calling agent loop.

The agent loop:
1. Receives a user message + persona context
2. Builds the system prompt from persona config
3. Calls Gemini with tool definitions (from persona's allowed tools)
4. If Gemini requests a tool call → execute it via MCP gateway → feed result back
5. Repeats until Gemini returns a final text response (no more tool calls)
6. Saves all messages (user, assistant, tool_call, tool_result) to conversation

This replaces the simple "answer_query" approach with a proper agentic loop
where the AI can use tools autonomously.
"""

import json
import logging
from typing import Any

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

from backend.app.core.config import settings
from backend.app.models.ai import Persona, AIConversation, AIMessage

logger = logging.getLogger("aries.agent_loop")

MAX_TOOL_ROUNDS = 10  # prevent infinite tool loops


class AgentLoop:
    """Full tool-calling agent loop powered by Gemini."""

    def __init__(self, persona: Persona):
        self.persona = persona
        self.client = settings.get_genai_client()
        self.model = persona.model

        # Parse persona's allowed tools
        self.allowed_tools = json.loads(persona.allowed_tools) if persona.allowed_tools else []
        self.allowed_mcp_servers = json.loads(persona.allowed_mcp_servers) if persona.allowed_mcp_servers else []

    async def run(
        self,
        user_message: str,
        conversation_messages: list[AIMessage] | None = None,
        wiki_context: str = "",
    ) -> dict:
        """Run the full agent loop with tool calling.

        Returns: {
            "content": str,          # final text response
            "tool_calls": list,       # list of tool calls made
            "tool_results": list,     # list of tool results
            "rounds": int,            # number of tool-calling rounds
        }
        """
        # Build system prompt
        system_prompt = self._build_system_prompt(wiki_context)

        # Build conversation history in Gemini format
        contents = self._build_contents(system_prompt, user_message, conversation_messages, wiki_context)

        # Get available tool declarations for this persona
        tool_declarations = self._get_tool_declarations()

        # Track tool calls and results
        all_tool_calls = []
        all_tool_results = []
        rounds = 0

        # Agentic loop: call model → if tool_call → execute → feed back → repeat
        while rounds < MAX_TOOL_ROUNDS:
            rounds += 1

            try:
                config = {}
                if tool_declarations:
                    config["tools"] = tool_declarations

                response = self._generate(
                    model=self.model,
                    contents=contents,
                    config=config if config else None,
                )
            except Exception as e:
                logger.error("Agent loop Gemini call failed: %s", e)
                return {
                    "content": f"I encountered an error processing your request: {e}",
                    "tool_calls": all_tool_calls,
                    "tool_results": all_tool_results,
                    "rounds": rounds,
                }

            # Check if the model wants to call tools
            candidate = response.candidates[0] if response.candidates else None
            if not candidate:
                return {
                    "content": "I couldn't generate a response. Please try again.",
                    "tool_calls": all_tool_calls,
                    "tool_results": all_tool_results,
                    "rounds": rounds,
                }

            # Collect tool calls from the response
            tool_calls_in_response = []
            text_parts = []

            for part in candidate.content.parts:
                if part.text:
                    text_parts.append(part.text)
                elif part.function_call:
                    tool_calls_in_response.append({
                        "name": part.function_call.name,
                        "args": dict(part.function_call.args) if part.function_call.args else {},
                    })

            # If no tool calls, we're done — return the text response
            if not tool_calls_in_response:
                final_text = "\n".join(text_parts)
                return {
                    "content": final_text or "I couldn't generate a meaningful response.",
                    "tool_calls": all_tool_calls,
                    "tool_results": all_tool_results,
                    "rounds": rounds,
                }

            # Execute tool calls
            all_tool_calls.extend(tool_calls_in_response)
            tool_results = []

            for tc in tool_calls_in_response:
                tool_name = tc["name"]
                tool_args = tc["args"]

                logger.info("Agent calling tool: %s(%s)", tool_name, json.dumps(tool_args, default=str)[:200])

                try:
                    result = await self._execute_tool(tool_name, tool_args)
                    tool_results.append({
                        "name": tool_name,
                        "result": result,
                        "status": "success",
                    })
                    all_tool_results.append({"name": tool_name, "result": result, "status": "success"})
                except Exception as e:
                    logger.error("Tool %s execution failed: %s", tool_name, e)
                    tool_results.append({
                        "name": tool_name,
                        "result": f"Error: {e}",
                        "status": "error",
                    })
                    all_tool_results.append({"name": tool_name, "result": f"Error: {e}", "status": "error"})

            # Feed tool results back into conversation
            # Build function response parts
            function_response_parts = []
            for tr in tool_results:
                function_response_parts.append(
                    types.Part.from_function_response(
                        name=tr["name"],
                        response={"result": tr["result"][:10000]},  # limit response size
                    )
                )

            # Add assistant's tool call message + function responses to contents
            contents.append(candidate.content)
            contents.append(types.Content(role="user", parts=function_response_parts))

        # If we hit max rounds, return what we have
        return {
            "content": "I've completed my research using the available tools. Let me summarize what I found:\n\n" + "\n".join(
                f"**{tr['name']}**: {str(tr['result'])[:500]}" for tr in all_tool_results[-3:]
            ),
            "tool_calls": all_tool_calls,
            "tool_results": all_tool_results,
            "rounds": rounds,
        }

    def _build_system_prompt(self, wiki_context: str = "") -> str:
        """Build the system prompt from persona config."""
        prompt = self.persona.about or f"You are {self.persona.nickname}, {self.persona.position}."

        if self.persona.knowledge_base_prompt:
            prompt += f"\n\n{self.persona.knowledge_base_prompt}"

        if wiki_context:
            prompt += f"\n\n## Knowledge Base Context:\n{wiki_context[:30000]}"

        # Add tool usage guidance
        if self.allowed_tools:
            prompt += f"\n\n## Available Tools:\nYou have access to these tools: {', '.join(self.allowed_tools)}. Use them when needed to answer questions accurately."

        return prompt

    def _build_contents(
        self,
        system_prompt: str,
        user_message: str,
        conversation_messages: list[AIMessage] | None,
        wiki_context: str,
    ) -> list:
        """Build the Gemini content array from conversation history."""
        contents = []

        # Add system instruction as first user message
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=system_prompt)],
        ))
        contents.append(types.Content(
            role="model",
            parts=[types.Part.from_text(text=f"I am {self.persona.nickname}, ready to help.")],
        ))

        # Add conversation history
        if conversation_messages:
            for msg in conversation_messages[-20:]:  # limit context window
                role = "user" if msg.role == "user" else "model"
                if msg.content:
                    contents.append(types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg.content)],
                    ))

        # Add current user message
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)],
        ))

        return contents

    def _get_tool_declarations(self) -> list[types.Tool]:
        """Get Gemini tool declarations from the persona's allowed tools.

        Uses MCP_TOOLS schemas from gemini.py for proper parameter declarations.
        Falls back to generic schemas for non-MCP tools.
        """
        from backend.app.mcp_servers.gateway import gateway
        from backend.app.services.gemini import MCP_TOOLS

        # Build a lookup from tool name to parameter schema
        mcp_schemas = {t["name"]: t["parameters"] for t in MCP_TOOLS}

        declarations = []
        all_tools = gateway.list_tools()

        for tool_info in all_tools:
            if tool_info["name"] not in self.allowed_tools:
                continue

            schema = mcp_schemas.get(tool_info["name"])
            if schema:
                # Convert JSON Schema to Gemini types.Schema
                properties = {}
                required = schema.get("required", [])
                for prop_name, prop_def in schema.get("properties", {}).items():
                    prop_type = prop_def.get("type", "STRING").upper()
                    if prop_type == "OBJECT":
                        properties[prop_name] = types.Schema(type="OBJECT", description=prop_def.get("description", ""))
                    elif prop_type == "ARRAY":
                        properties[prop_name] = types.Schema(type="ARRAY", description=prop_def.get("description", ""))
                    elif prop_type == "NUMBER":
                        properties[prop_name] = types.Schema(type="NUMBER", description=prop_def.get("description", ""))
                    elif prop_type == "INTEGER":
                        properties[prop_name] = types.Schema(type="INTEGER", description=prop_def.get("description", ""))
                    elif prop_type == "BOOLEAN":
                        properties[prop_name] = types.Schema(type="BOOLEAN", description=prop_def.get("description", ""))
                    else:
                        properties[prop_name] = types.Schema(type="STRING", description=prop_def.get("description", ""))

                declarations.append(types.FunctionDeclaration(
                    name=tool_info["name"],
                    description=tool_info["description"],
                    parameters=types.Schema(
                        type="OBJECT",
                        properties=properties,
                        required=required,
                    ),
                ))
            else:
                # Generic schema for non-MCP tools (wiki, gemini, etc.)
                declarations.append(types.FunctionDeclaration(
                    name=tool_info["name"],
                    description=tool_info["description"],
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "query": types.Schema(type="STRING", description="Search query or input text"),
                            "path": types.Schema(type="STRING", description="Wiki page path"),
                            "question": types.Schema(type="STRING", description="Question to answer"),
                        },
                    ),
                ))

        if not declarations:
            return []

        return [types.Tool(function_declarations=declarations)]

    async def _execute_tool(self, tool_name: str, args: dict) -> str:
        """Execute an MCP tool via the gateway."""
        from backend.app.mcp_servers.gateway import gateway

        # Check if tool is in persona's allowed list
        if tool_name not in self.allowed_tools:
            return f"Tool '{tool_name}' is not available to {self.persona.nickname}"

        try:
            result = await gateway.call_tool(tool_name, **args)
            return result
        except ValueError as e:
            return f"Tool not found: {e}"
        except Exception as e:
            return f"Tool execution error: {e}"

    @retry(
        retry=retry_if_exception_type((ResourceExhausted, ServiceUnavailable)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        reraise=True,
    )
    def _generate(self, model: str, contents, config: dict | None = None):
        """Core Gemini call with retry on rate limits."""
        return self.client.models.generate_content(
            model=model,
            contents=contents,
            config=config or {},
        )
