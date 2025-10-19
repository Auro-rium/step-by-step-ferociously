import os
import logging
from datetime import datetime

# --- Create logs directory ---
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

# --- Generate log file per session ---
timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
LOG_FILE = os.path.join(LOG_DIR, f"session_{timestamp}.log")

# --- Logging Configuration ---
LOG_FORMAT = "%(asctime)s | %(levelname)s | %(message)s"
logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("BotLogger")

# --- Utility for structured logging ---
def log_event(event_type: str, message: str, data: dict | None = None):
    """Log structured events with optional metadata."""
    entry = f"[{event_type.upper()}] {message}"
    if data:
        entry += f" | data={data}"
    logger.info(entry)

def log_error(message: str, exception: Exception = None):
    """Log errors cleanly."""
    if exception:
        logger.exception(f"[ERROR] {message}: {exception}")
    else:
        logger.error(f"[ERROR] {message}")

def log_section(title: str):
    """Visually separate key sections in log file."""
    separator = "=" * 60
    logger.info(f"\n{separator}\n{title.upper()}\n{separator}")
