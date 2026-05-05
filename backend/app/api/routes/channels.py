"""Multi-Channel Webhook Handlers — WhatsApp, Telegram, Slack.

Each handler:
1. Receives inbound messages from the platform's webhook
2. Resolves the default persona for that channel
3. Creates/updates an AI conversation
4. Triggers AI response through the persona
5. Sends the reply back through the channel's outbound API

Inspired by OpenClaw's ChannelPlugin adapter pattern — each channel
has its own message normalization, but all funnel through the same
AI chat pipeline.
"""

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import get_current_user
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.ai import Persona, AIConversation, AIMessage, ChannelConnector

logger = logging.getLogger("aries.channels")

router = APIRouter(prefix="/channels", tags=["channels"])


# --- Channel Connector CRUD ---

class ConnectorCreate(BaseModel):
    channel_type: str  # whatsapp, telegram, slack, email
    name: str
    config: dict | None = None
    default_persona_id: uuid.UUID | None = None


@router.get("/connectors")
async def list_connectors(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    stmt = select(ChannelConnector)
    result = await db.execute(stmt.order_by(ChannelConnector.channel_type))
    connectors = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "channel_type": c.channel_type,
            "name": c.name,
            "enabled": c.enabled,
            "webhook_url": c.webhook_url,
            "default_persona_id": str(c.default_persona_id) if c.default_persona_id else None,
        }
        for c in connectors
    ]


@router.post("/connectors")
async def create_connector(
    data: ConnectorCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    connector = ChannelConnector(
        channel_type=data.channel_type,
        name=data.name,
        config=json.dumps(data.config) if data.config else None,
        default_persona_id=data.default_persona_id,
    )
    db.add(connector)
    await db.commit()
    await db.refresh(connector)

    # Generate webhook URL
    base_url = f"http://localhost:8000/api/v1/channels/webhook/{connector.id}"
    connector.webhook_url = base_url
    await db.commit()

    return {
        "id": str(connector.id),
        "channel_type": connector.channel_type,
        "name": connector.name,
        "webhook_url": connector.webhook_url,
    }


# --- WhatsApp Webhook (PUBLIC — called by external services) ---

@router.get("/webhook/{connector_id}")
async def webhook_verification(
    connector_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """WhatsApp Cloud API verification endpoint (GET with hub.mode=subscribe)."""
    connector = await _get_connector(connector_id, db)
    if not connector:
        raise HTTPException(404, "Connector not found")

    config = json.loads(connector.config) if connector.config else {}
    verify_token = config.get("verify_token", "")

    params = dict(request.query_params)
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == verify_token:
        return Response(content=params.get("hub.challenge", ""), status_code=200)

    return Response(content="Forbidden", status_code=403)


@router.post("/webhook/{connector_id}")
async def webhook_receive(
    connector_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Universal webhook receiver — routes to the correct channel handler.

    Works for WhatsApp, Telegram, and Slack by examining the connector's channel_type.
    """
    connector = await _get_connector(connector_id, db)
    if not connector:
        raise HTTPException(404, "Connector not found")

    if not connector.enabled:
        raise HTTPException(400, "Connector is disabled")

    body = await request.json()
    config = json.loads(connector.config) if connector.config else {}

    if connector.channel_type == "whatsapp":
        return await _handle_whatsapp(connector, config, body, db)
    elif connector.channel_type == "telegram":
        return await _handle_telegram(connector, config, body, db)
    elif connector.channel_type == "slack":
        return await _handle_slack(connector, config, body, request, db)
    else:
        logger.warning("Unknown channel type: %s", connector.channel_type)
        return {"status": "ignored"}


# --- WhatsApp Handler ---

async def _handle_whatsapp(
    connector: ChannelConnector,
    config: dict,
    body: dict,
    db: AsyncSession,
):
    """Handle WhatsApp Cloud API webhook payload.

    Expected payload format:
    {
      "entry": [{
        "changes": [{
          "value": {
            "messages": [{
              "from": "1234567890",
              "type": "text",
              "text": {"body": "Hello"}
            }]
          }
        }]
      }]
    }
    """
    try:
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                messages = value.get("messages", [])

                for msg in messages:
                    phone_number = msg.get("from", "")
                    msg_type = msg.get("type", "text")

                    if msg_type == "text":
                        text = msg.get("text", {}).get("body", "")
                    else:
                        text = f"[{msg_type} message received]"

                    # Process the message through AI
                    await _process_inbound_message(
                        connector=connector,
                        platform_user_id=phone_number,
                        text=text,
                        channel="whatsapp",
                        db=db,
                    )

                    # Send reply via WhatsApp API
                    if connector.default_persona_id and text:
                        reply = await _get_ai_reply(phone_number, text, connector, db)
                        if reply:
                            await _send_whatsapp_reply(config, phone_number, reply)

    except Exception as e:
        logger.error("WhatsApp webhook processing failed: %s", e, exc_info=True)

    return {"status": "processed"}


async def _send_whatsapp_reply(config: dict, phone_number: str, text: str):
    """Send a reply via WhatsApp Cloud API."""
    access_token = config.get("access_token", "")
    phone_number_id = config.get("phone_number_id", "")

    if not access_token or not phone_number_id:
        logger.warning("WhatsApp config missing access_token or phone_number_id")
        return

    url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_number,
        "type": "text",
        "text": {"body": text[:4096]},  # WhatsApp text limit
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=30)
            if resp.status_code != 200:
                logger.error("WhatsApp send failed: %s %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("WhatsApp send error: %s", e)


# --- Telegram Handler ---

async def _handle_telegram(
    connector: ChannelConnector,
    config: dict,
    body: dict,
    db: AsyncSession,
):
    """Handle Telegram Bot API webhook payload.

    Expected payload format:
    {
      "message": {
        "from": {"id": 12345, "first_name": "John"},
        "text": "Hello"
      }
    }
    """
    try:
        message = body.get("message") or body.get("edited_message")
        if not message:
            return {"status": "no_message"}

        from_user = message.get("from", {})
        user_id = str(from_user.get("id", ""))
        text = message.get("text", "")

        if not text:
            return {"status": "no_text"}

        # Process through AI
        if connector.default_persona_id:
            reply = await _get_ai_reply(user_id, text, connector, db)
            if reply:
                await _send_telegram_reply(config, user_id, reply, message.get("message_id"))

    except Exception as e:
        logger.error("Telegram webhook processing failed: %s", e, exc_info=True)

    return {"status": "processed"}


async def _send_telegram_reply(config: dict, chat_id: str, text: str, reply_to: int | None = None):
    """Send a reply via Telegram Bot API."""
    bot_token = config.get("bot_token", "")
    if not bot_token:
        logger.warning("Telegram config missing bot_token")
        return

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload: dict = {
        "chat_id": chat_id,
        "text": text[:4096],  # Telegram text limit
        "parse_mode": "Markdown",
    }
    if reply_to:
        payload["reply_to_message_id"] = reply_to

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, timeout=30)
            if resp.status_code != 200:
                logger.error("Telegram send failed: %s %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Telegram send error: %s", e)


# --- Slack Handler ---

async def _handle_slack(
    connector: ChannelConnector,
    config: dict,
    body: dict,
    request: Request,
    db: AsyncSession,
):
    """Handle Slack Events API webhook.

    Supports:
    - URL verification challenge (setup)
    - Event messages (message.channels, message.im)
    """
    # URL verification challenge
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge", "")}

    # Verify Slack signing secret
    if not _verify_slack_signature(request, config):
        logger.warning("Slack signature verification failed")
        return {"status": "unverified"}

    try:
        event = body.get("event", {})
        if event.get("type") not in ("message", "app_mention"):
            return {"status": "ignored_event_type"}

        # Ignore bot's own messages
        if event.get("bot_id") or event.get("subtype") == "bot_message":
            return {"status": "ignored_bot_message"}

        user_id = event.get("user", "")
        text = event.get("text", "")
        channel_id = event.get("channel", "")
        thread_ts = event.get("thread_ts")

        # Strip bot mention from text
        bot_user_id = config.get("bot_user_id", "")
        if bot_user_id:
            text = text.replace(f"<@{bot_user_id}>", "").strip()

        if not text:
            return {"status": "no_text"}

        # Process through AI
        platform_user_id = f"slack:{channel_id}:{user_id}"
        if connector.default_persona_id:
            reply = await _get_ai_reply(platform_user_id, text, connector, db)
            if reply:
                await _send_slack_reply(config, channel_id, reply, thread_ts)

    except Exception as e:
        logger.error("Slack webhook processing failed: %s", e, exc_info=True)

    return {"status": "processed"}


def _verify_slack_signature(request: Request, config: dict) -> bool:
    """Verify Slack request signature using signing secret."""
    signing_secret = config.get("signing_secret", "")
    if not signing_secret:
        return True  # Skip verification if no secret configured (dev mode)

    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")

    # Replay attack check (5 min window)
    import time
    if abs(time.time() - float(timestamp)) > 60 * 5:
        return False

    sig_basestring = f"v0:{timestamp}:{request._body.decode()}"
    signature_hash = hmac.new(
        signing_secret.encode(),
        sig_basestring.encode(),
        hashlib.sha256,
    ).hexdigest()
    expected_signature = f"v0={signature_hash}"

    return hmac.compare_digest(expected_signature, signature)


async def _send_slack_reply(config: dict, channel_id: str, text: str, thread_ts: str | None = None):
    """Send a reply via Slack Web API."""
    bot_token = config.get("bot_token", "")
    if not bot_token:
        logger.warning("Slack config missing bot_token")
        return

    url = "https://slack.com/api/chat.postMessage"
    headers = {"Authorization": f"Bearer {bot_token}"}
    payload: dict = {
        "channel": channel_id,
        "text": text[:40000],  # Slack text limit
        "unfurl_links": False,
        "unfurl_media": False,
    }
    if thread_ts:
        payload["thread_ts"] = thread_ts

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=30)
            if resp.status_code != 200 or not resp.json().get("ok"):
                logger.error("Slack send failed: %s", resp.text)
        except Exception as e:
            logger.error("Slack send error: %s", e)


# --- Shared AI Processing ---

async def _process_inbound_message(
    connector: ChannelConnector,
    platform_user_id: str,
    text: str,
    channel: str,
    db: AsyncSession,
):
    """Save an inbound message from any channel as an AI conversation message."""
    # Find or create conversation for this user
    conversation = await _find_or_create_conversation(
        persona_id=connector.default_persona_id,
        user_id=platform_user_id,
        channel=channel,
        db=db,
    )

    # Save user message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=text,
    )
    db.add(user_msg)
    await db.commit()


async def _get_ai_reply(
    user_id: str,
    text: str,
    connector: ChannelConnector,
    db: AsyncSession,
) -> str | None:
    """Get an AI reply from the persona, saving both user and assistant messages."""
    if not connector.default_persona_id:
        return None

    # Load persona
    stmt = select(Persona).where(
        Persona.id == connector.default_persona_id,
        Persona.enabled == True,
    )
    result = await db.execute(stmt)
    persona = result.scalar_one_or_none()
    if not persona:
        logger.error("Persona %s not found or disabled", connector.default_persona_id)
        return None

    # Find or create conversation
    conversation = await _find_or_create_conversation(
        persona_id=persona.id,
        user_id=user_id,
        channel=connector.channel_type,
        db=db,
    )

    # Save user message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=text,
    )
    db.add(user_msg)
    await db.commit()

    # Get recent messages for context
    recent_stmt = (
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation.id)
        .order_by(AIMessage.created_at.desc())
        .limit(10)
    )
    recent_result = await db.execute(recent_stmt)
    recent_messages = list(reversed(recent_result.scalars().all()))

    # Get wiki context
    wiki_context = ""
    if persona.enable_knowledge_base:
        from backend.app.services.wiki import WikiService
        wiki = WikiService()
        search_results = wiki.search(text, limit=5)
        context_parts = []
        for r in search_results:
            page = wiki.read_page(r.path)
            if page:
                context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")
        wiki_context = "\n\n".join(context_parts) if context_parts else ""

    # Build prompt
    system_prompt = persona.about or f"You are {persona.nickname}, {persona.position}."
    prompt_parts = [system_prompt]

    if wiki_context:
        prompt_parts.append(f"## Knowledge Base:\n{wiki_context[:15000]}")

    for msg in recent_messages:
        prefix = "User" if msg.role == "user" else "Assistant"
        prompt_parts.append(f"{prefix}: {msg.content}")

    try:
        from backend.app.services.gemini import GeminiService
        gemini = GeminiService()
        reply = await gemini.answer_query("\n\n".join(prompt_parts), wiki_context or "No context")

        # Save assistant message
        assistant_msg = AIMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=reply,
            metadata_json=json.dumps({
                "model": persona.model,
                "channel": connector.channel_type,
                "persona": persona.nickname,
            }),
        )
        db.add(assistant_msg)
        await db.commit()

        return reply

    except Exception as e:
        logger.error("AI reply generation failed: %s", e, exc_info=True)
        return "Sorry, I encountered an error processing your message. Please try again later."


async def _find_or_create_conversation(
    persona_id: uuid.UUID,
    user_id: str,
    channel: str,
    db: AsyncSession,
) -> AIConversation:
    """Find an existing conversation for this user or create a new one."""
    # Look for existing conversation (same persona, user, channel)
    stmt = (
        select(AIConversation)
        .where(
            AIConversation.persona_id == persona_id,
            AIConversation.user_id == user_id,
            AIConversation.channel == channel,
        )
        .order_by(AIConversation.updated_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if conversation:
        return conversation

    # Create new conversation
    conversation = AIConversation(
        persona_id=persona_id,
        user_id=user_id,
        channel=channel,
        title=f"{channel.title()} conversation",
    )
    db.add(conversation)
    await db.flush()

    # Add persona greeting
    persona_stmt = select(Persona).where(Persona.id == persona_id)
    persona_result = await db.execute(persona_stmt)
    persona = persona_result.scalar_one_or_none()
    if persona and persona.greeting:
        greeting_msg = AIMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=persona.greeting,
        )
        db.add(greeting_msg)

    await db.commit()
    return conversation


# --- Helpers ---

async def _get_connector(connector_id: str, db: AsyncSession) -> ChannelConnector | None:
    stmt = select(ChannelConnector).where(ChannelConnector.id == uuid.UUID(connector_id))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
