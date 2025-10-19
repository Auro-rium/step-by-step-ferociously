from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from datetime import datetime, timedelta
import pytz
from logging_manager import log_event, log_error

# --- Timezone handling ---
# Keep a primary timezone for scheduling consistency
PRIMARY_TZ = pytz.timezone("Asia/Kolkata")
SECONDARY_TZ = pytz.timezone("America/New_York")

# --- Build Google Calendar Service once ---
try:
    _creds = Credentials.from_authorized_user_file(
        "token.json",
        ["https://www.googleapis.com/auth/calendar"]
    )
    _service = build("calendar", "v3", credentials=_creds)
    log_event("calendar_init", "Google Calendar API initialized")
except Exception as e:
    log_error("Calendar init failed", e)
    _service = None

# --- Utility: Convert naive or ISO datetime string to RFC3339 format with timezone ---
def _to_rfc3339(iso_str: str):
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = PRIMARY_TZ.localize(dt)
        return dt.isoformat()
    except Exception as e:
        log_error("Datetime parsing failed", e)
        return iso_str  # fallback to raw ISO

# --- Add Event ---
def add_event(summary: str, start_iso: str, end_iso: str, description: str = None):
    """Add event to Google Calendar and return dict with details."""
    if not _service:
        log_error("add_event", "Service not initialized")
        return {"error": "Google Calendar service not initialized"}

    event_body = {
        "summary": summary,
        "start": {"dateTime": _to_rfc3339(start_iso), "timeZone": "Asia/Kolkata"},
        "end": {"dateTime": _to_rfc3339(end_iso), "timeZone": "Asia/Kolkata"},
    }

    if description:
        event_body["description"] = description

    try:
        created = _service.events().insert(calendarId="primary", body=event_body).execute()
        log_event("event_created", "New event added", created)
        return {
            "id": created.get("id"),
            "link": created.get("htmlLink"),
            "summary": created.get("summary"),
            "start": created.get("start"),
            "end": created.get("end"),
        }
    except Exception as e:
        log_error("add_event_failed", e)
        return {"error": str(e)}

# --- Find Event ---
def find_events_by_summary_and_window(summary: str, window_start_iso: str, window_end_iso: str):
    """Find events matching summary within given datetime range."""
    if not _service:
        log_error("find_events", "Service not initialized")
        return []

    try:
        events_result = _service.events().list(
            calendarId="primary",
            timeMin=_to_rfc3339(window_start_iso),
            timeMax=_to_rfc3339(window_end_iso),
            q=summary,
            singleEvents=True,
            orderBy="startTime",
            maxResults=50
        ).execute()

        items = events_result.get("items", [])
        log_event("events_fetched", f"{len(items)} events fetched", {"summary": summary})
        return items
    except Exception as e:
        log_error("find_events_failed", e)
        return []

# --- Delete Event ---
def delete_event(event_id: str):
    """Delete an event by ID."""
    if not _service:
        log_error("delete_event", "Service not initialized")
        return False

    try:
        _service.events().delete(calendarId="primary", eventId=event_id).execute()
        log_event("event_deleted", "Event deleted", {"event_id": event_id})
        return True
    except Exception as e:
        log_error("delete_event_failed", e)
        return False
