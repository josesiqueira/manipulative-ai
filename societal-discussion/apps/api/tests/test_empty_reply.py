"""An empty model reply is never stored: it is retried once, and a second
empty reply is an error the phone can show."""
import pytest

from src.services import llm_client
from src.services.llm_client import EmptyReplyError, PreparedReply, generate_reply


class _Provider:
    def __init__(self, replies):
        self.replies = list(replies)
        self.max_tokens = []

    async def generate(self, messages, model, max_tokens=1024, temperature=0.1):
        self.max_tokens.append(max_tokens)
        return self.replies.pop(0), 100


async def test_empty_reply_is_retried_once():
    provider = _Provider(["", "  vastaus  "])
    text, tokens, model = await generate_reply(PreparedReply(provider, "gpt-6-astra", []))
    assert (text, tokens, model) == ("vastaus", 200, "gpt-6-astra")
    assert provider.max_tokens == [llm_client.MAX_COMPLETION_TOKENS] * 2
    assert llm_client.MAX_COMPLETION_TOKENS >= 4096


async def test_two_empty_replies_raise():
    with pytest.raises(EmptyReplyError):
        await generate_reply(PreparedReply(_Provider([None, " "]), "gpt-6-astra", []))
