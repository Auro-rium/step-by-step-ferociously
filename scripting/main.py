import asyncio
import os
import json
from datetime import datetime
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters
from dotenv import load_dotenv
import google.generativeai as genai
import workflow  # Google Calendar logic
from logging_manager import log_event, log_error, log_section
from session_manager import get_context, update_context

# --- Load environment variables ---
load_dotenv()
tel_key = os.getenv("TELEGRAM_KEY")
gemini_key = os.getenv("GEMINI_API_KEY")

# --- Validate credentials ---
if not tel_key:
    raise ValueError("Missing TELEGRAM_KEY in .env")
if not gemini_key:
    raise ValueError("Missing GEMINI_API_KEY in .env")

# --- Configure Gemini ---
genai.configure(api_key=gemini_key)
model = genai.GenerativeModel("gemini-2.5-flash")

log_section("BOT INITIALIZATION")
log_event("startup", "Bot initialized with Telegram and Gemini")

# --- JSON cleaner for Gemini ---
def clean_json(raw_text: str):
    if not raw_text:
        return None
    raw_text = raw_text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        try:
            fixed = raw_text.replace("'", '"')
            return json.loads(fixed)
        except Exception:
            return None

# --- Commands ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user.first_name
    msg = f"🚀 Hello {user}! I'm alive, synced with Google Calendar, and sarcastically intelligent."
    await update.message.reply_text(msg)
    log_event("command", "/start triggered", {"user": user})

async def chat_with_ai(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    user_text = update.message.text.strip()
    update_context(user_id, "user", user_text)

    prev_context = get_context(user_id)
    formatted_context = "\n".join(
        [f"{c['role'].upper()}: {c['text']}" for c in prev_context]
    )

    extract_prompt = f"""
You are a scheduling and calendar assistant.
Consider the full chat history below for context and relationships:
{formatted_context}

Extract any event if implied or mentioned. If user gives follow-up details (like time), link it to prior message intent.

Return JSON format:
{{
 "action": "create",
 "title": "event title",
 "start": "YYYY-MM-DD HH:MM",
 "end": "YYYY-MM-DD HH:MM"
}}
If not sure or missing time, ask clarifying question.
"""

    response = await asyncio.to_thread(model.generate_content, extract_prompt)
    text = response.text.strip()
    print("🤖 Gemini output:", text)
    update_context(user_id, "assistant", text)

    try:
        # --- Call Gemini in a thread-safe way ---
        response = await asyncio.to_thread(model.generate_content, extract_prompt)
        gemini_output = response.text.strip()
        log_event("gemini_output", "Raw Gemini response", {"output": gemini_output})

        data = clean_json(gemini_output)

        if data and all(k in data for k in ("title", "start", "end")):
            start_time = datetime.fromisoformat(data["start"]).isoformat()
            end_time = datetime.fromisoformat(data["end"]).isoformat()

            log_event("calendar_request", "Creating calendar event", data)
            event = workflow.add_event(data["title"], start_time, end_time)
            log_event("calendar_response", "Event successfully added", {"event": event})

            await update.message.reply_text(
                f"✅ Event added!\n"
                f"🗓 Title: {event.get('summary')}\n"
                f"⏰ Start: {event['start']['dateTime']}\n"
                f"⏰ End: {event['end']['dateTime']}\n"
                f"🔗 {event.get('link', 'No link')}"
            )
        else:
            # --- fallback to chat ---
            prompt = (
                f"User said: {user_text}\n"
                "Reply concisely, with professionalism. "
                "Stay focused on scheduling or time management — humbly deny irrelevant talks."
            )
            ai_response = await asyncio.to_thread(model.generate_content, prompt)
            log_event("chat_response", "Gemini fallback chat reply", {"response": ai_response.text})
            await update.message.reply_text(ai_response.text.strip())

    except Exception as e:
        log_error("Processing error", e)
        await update.message.reply_text(f"⚠️ Error: {e}")

# --- App Setup ---
app = ApplicationBuilder().token(tel_key).concurrent_updates(True).build()
app.add_handler(CommandHandler("start", start))
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, chat_with_ai))

log_section("BOT RUNNING")
log_event("system", "Bot running with Calendar integration. Press Ctrl+C to stop.")

print("🤖 Bot running with Calendar integration... Press Ctrl+C to stop.")
app.run_polling()
