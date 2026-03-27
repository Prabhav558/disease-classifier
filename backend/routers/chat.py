"""
routers/chat.py — Agentic Grok-powered chatbot endpoint.

Uses Grok's (xAI) OpenAI-compatible API with function/tool calling.
The agent can: dismiss alerts, start/stop irrigation, create schedules, etc.
"""

import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from database import get_db
from schemas import ActionTaken, ChatRequest, ChatResponse
from services.chat_agent import TOOL_DEFINITIONS, build_system_prompt, execute_tool

router = APIRouter()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL   = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

grok_client = AsyncOpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    try:
        system_prompt = await build_system_prompt(db)
    except Exception as e:
        logger.error(f"[Chat] build_system_prompt failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to load farm context: {e}")

    messages = [{"role": "system", "content": system_prompt}]

    # Append conversation history (last 10 turns to stay within context)
    for msg in body.history[-10:]:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": body.message})

    actions_taken: list[ActionTaken] = []

    try:
        # ── Agentic loop (tool calls until model stops) ────────────────────────
        max_iterations = 6
        for _ in range(max_iterations):
            response = await grok_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
                parallel_tool_calls=False,
            )

            ai_msg = response.choices[0].message

            # No tool calls → final response
            if not ai_msg.tool_calls:
                return ChatResponse(reply=ai_msg.content or "", actions_taken=actions_taken)

            # Serialize assistant message to dict before appending (avoids SDK version issues)
            messages.append({
                "role": "assistant",
                "content": ai_msg.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in ai_msg.tool_calls
                ],
            })

            # Execute each tool call
            for tc in ai_msg.tool_calls:
                tool_name = tc.function.name
                try:
                    parsed = json.loads(tc.function.arguments or "{}")
                    tool_args = parsed if isinstance(parsed, dict) else {}
                except (json.JSONDecodeError, TypeError):
                    tool_args = {}

                tool_result = await execute_tool(tool_name, tool_args, db)

                actions_taken.append(ActionTaken(
                    tool=tool_name,
                    args=tool_args,
                    result=tool_result,
                ))

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_result,
                })

        # Fallback if max iterations hit
        final = await grok_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
        )
        return ChatResponse(
            reply=final.choices[0].message.content or "I completed the requested actions.",
            actions_taken=actions_taken,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Chat] Groq API or tool error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
