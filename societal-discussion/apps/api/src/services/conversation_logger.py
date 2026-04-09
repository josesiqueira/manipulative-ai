"""
Conversation logger - saves completed chats to text files for analysis.
"""

from pathlib import Path
from datetime import datetime

from ..models import Chat, Participant

# Logs directory (relative to project root)
LOGS_DIR = Path(__file__).parent.parent.parent.parent.parent / "logs"


def ensure_logs_dir():
    """Create logs directory if it doesn't exist."""
    LOGS_DIR.mkdir(exist_ok=True)


def format_conversation_log(chat: Chat, participant: Participant) -> str:
    """
    Format a completed chat as a readable text log.

    Includes:
    - Chat metadata (ID, topic, assigned political block, language)
    - Participant demographics
    - Full conversation (all messages in order)
    - Survey results (perceived leaning, ratings, correct guess)
    """
    lines = []

    # Header
    lines.append("=" * 70)
    lines.append("CONVERSATION LOG")
    lines.append("=" * 70)
    lines.append("")

    # Chat metadata
    lines.append("CHAT METADATA")
    lines.append("-" * 40)
    lines.append(f"Chat ID:          {chat.id}")
    lines.append(f"Topic:            {chat.topic_category}")
    lines.append(f"Political Block:  {chat.political_block}")
    lines.append(f"Language:         {chat.language}")
    lines.append(f"Test Mode:        {chat.is_test_mode}")
    lines.append(f"Created:          {chat.created_at.isoformat() if chat.created_at else 'N/A'}")
    lines.append(f"Completed:        {chat.completed_at.isoformat() if chat.completed_at else 'N/A'}")
    lines.append("")

    # Participant demographics
    lines.append("PARTICIPANT DEMOGRAPHICS")
    lines.append("-" * 40)
    lines.append(f"Participant ID:       {participant.id}")
    lines.append(f"Age Group:            {participant.age_group or 'Not provided'}")
    lines.append(f"Gender:               {participant.gender or 'Not provided'}")
    lines.append(f"Education:            {participant.education or 'Not provided'}")
    lines.append(f"Political Leaning:    {participant.political_leaning or 'Not provided'}")
    lines.append(f"Political Knowledge:  {participant.political_knowledge or 'Not provided'}")
    lines.append("")

    # Conversation
    lines.append("CONVERSATION")
    lines.append("-" * 40)
    lines.append("")

    for msg in chat.messages:
        role_label = "USER" if msg.role == "user" else "AI"
        timestamp = msg.created_at.strftime("%H:%M:%S") if msg.created_at else ""
        lines.append(f"[{role_label}] ({timestamp})")
        lines.append(msg.content)
        lines.append("")

    # Survey results
    lines.append("SURVEY RESULTS")
    lines.append("-" * 40)
    lines.append(f"Perceived Leaning:    {chat.perceived_leaning or 'N/A'}")
    lines.append(f"Actual Block:         {chat.political_block}")
    correct = chat.perceived_leaning == chat.political_block if chat.perceived_leaning else None
    lines.append(f"Correct Guess:        {correct}")
    lines.append(f"Persuasiveness (1-5): {chat.persuasiveness or 'N/A'}")
    lines.append(f"Naturalness (1-5):    {chat.naturalness or 'N/A'}")
    lines.append(f"Confidence (1-5):     {chat.confidence or 'N/A'}")
    lines.append("")

    # Footer
    lines.append("=" * 70)
    lines.append(f"Log generated: {datetime.now().isoformat()}")
    lines.append("=" * 70)

    return "\n".join(lines)


def save_conversation_log(chat: Chat, participant: Participant) -> Path:
    """
    Save a completed conversation to a text file.

    Filename format: {timestamp}_{topic}_{block}_{chat_id_short}.txt

    Returns the path to the saved file.
    """
    ensure_logs_dir()

    # Generate filename
    timestamp = chat.completed_at or chat.created_at or datetime.now()
    timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
    chat_id_short = chat.id[:8]

    filename = f"{timestamp_str}_{chat.topic_category}_{chat.political_block}_{chat_id_short}.txt"
    filepath = LOGS_DIR / filename

    # Format and save
    content = format_conversation_log(chat, participant)
    filepath.write_text(content, encoding="utf-8")

    return filepath
