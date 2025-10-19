import json, os
from datetime import datetime

FILE_PATH = "data/sessions.json"
MAX_CONTEXT = 5

# --- ensure directory ---
os.makedirs(os.path.dirname(FILE_PATH), exist_ok=True)

def _load():
    if not os.path.exists(FILE_PATH):
        return {}
    with open(FILE_PATH, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def _save(data):
    with open(FILE_PATH, "w") as f:
        json.dump(data, f, indent=2)

def get_context(user_id: str):
    data = _load()
    return data.get(user_id, [])

def update_context(user_id: str, role: str, text: str):
    data = _load()
    data.setdefault(user_id, []).append({
        "role": role,
        "text": text,
        "time": datetime.now().isoformat()
    })
    data[user_id] = data[user_id][-MAX_CONTEXT:]
    _save(data)

def clear_context(user_id: str):
    data = _load()
    if user_id in data:
        del data[user_id]
        _save(data)
