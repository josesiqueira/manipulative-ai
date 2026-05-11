"""
Conversation logger - saves completed conversations to text files for analysis.
"""

from pathlib import Path
from datetime import datetime

from ..models import Conversation, Session

# Logs directory (relative to project root)
LOGS_DIR = Path(__file__).parent.parent.parent.parent.parent / "logs"


def ensure_logs_dir():
    """Create logs directory if it doesn't exist."""
    LOGS_DIR.mkdir(exist_ok=True)


def format_conversation_log(conversation: Conversation, session: Session | None = None) -> str:
    """
    Format a completed conversation as a readable text log.

    Includes:
    - Conversation metadata (ID, assigned party, starter topic)
    - Session info
    - Full conversation (all messages in order)
    """
    lines = []

    # Header
    lines.append("=" * 70)
    lines.append("CONVERSATION LOG")
    lines.append("=" * 70)
    lines.append("")

    # Conversation metadata
    lines.append("CONVERSATION METADATA")
    lines.append("-" * 40)
    lines.append(f"Conversation ID:  {conversation.id}")
    lines.append(f"Assigned Party:   {conversation.assigned_party}")
    lines.append(f"Starter Topic:    {conversation.starter_topic or 'Free conversation'}")
    lines.append(f"Test Mode:        {conversation.is_test_mode}")
    lines.append(f"Started:          {conversation.started_at.isoformat() if conversation.started_at else 'N/A'}")
    lines.append(f"Ended:            {conversation.ended_at.isoformat() if conversation.ended_at else 'N/A'}")
    lines.append(f"Message Count:    {conversation.message_count}")
    lines.append("")

    # Session info
    if session:
        lines.append("SESSION INFO")
        lines.append("-" * 40)
        lines.append(f"Session ID:       {session.id}")
        lines.append(f"Session Created:  {session.created_at.isoformat() if session.created_at else 'N/A'}")
        lines.append("")

    # Conversation
    lines.append("CONVERSATION")
    lines.append("-" * 40)
    lines.append("")

    for msg in conversation.messages:
        role_label = "USER" if msg.role == "user" else "AI"
        timestamp = msg.created_at.strftime("%H:%M:%S") if msg.created_at else ""
        lines.append(f"[{role_label}] ({timestamp})")
        lines.append(msg.content)
        lines.append("")

    # Footer
    lines.append("=" * 70)
    lines.append(f"Log generated: {datetime.now().isoformat()}")
    lines.append("=" * 70)

    return "\n".join(lines)


def save_conversation_log(conversation: Conversation, session: Session | None = None) -> Path:
    """
    Save a completed conversation to a text file.

    Filename format: {timestamp}_{party}_{conversation_id_short}.txt

    Returns the path to the saved file.
    """
    ensure_logs_dir()

    # Generate filename
    timestamp = conversation.ended_at or conversation.started_at or datetime.now()
    timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
    conv_id_short = conversation.id[:8]

    filename = f"{timestamp_str}_{conversation.assigned_party}_{conv_id_short}.txt"
    filepath = LOGS_DIR / filename

    # Format and save
    content = format_conversation_log(conversation, session)
    filepath.write_text(content, encoding="utf-8")

    return filepath
