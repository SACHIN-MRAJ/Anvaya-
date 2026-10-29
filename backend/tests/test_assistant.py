"""Ask ANUMATI: understands the question, answers from records only for people allowed to see them, never guesses,
and, with an AI key, lets the AI assistant synthesize the reply from the same sources (falling back when unavailable)."""
from types import SimpleNamespace

import anthropic
import httpx2
from conftest import login

from app.config import settings
from app.services import assistant

ASK = "/api/public/assistant/ask"


def ask(client, question: str, history: tuple[str, ...] = ()) -> dict:
    r = client.post(ASK, json={"question": question, "history": list(history)})
    assert r.status_code == 200, r.text
    return r.json()


def test_rules_dates_and_terms(client):
    client.cookies.clear()
    docs = ask(client, "Documents for change of site?")
    assert len(docs["bullets"]) == 7 and docs["source"] == "handbook" and docs["link"]["to"] == "/rules?type=site"
    assert "30 Nov 2026" in ask(client, "when is the last date to apply")["text"]  # from the live calendar
    assert ask(client, "full form of LoD")["text"].startswith("LoD means Letter of Deficiency")
    assert "Chairman or Secretary" in ask(client, "who must sign the documnets")["text"]  # spelling corrected
    assert ask(client, "fees for new college")["cites"] == ["APH 1.4.2", "APH 2.3.2"]
    assert len(ask(client, "how do I appeal?")["followUps"]) >= 2


def test_follow_up_keeps_the_topic_but_not_too_long(client):
    client.cookies.clear()
    a = ask(client, "and how long does it take?", ("documents for increase in intake",))
    assert "Increase in intake" in a["text"] and "target of about" in a["text"]
    # A question with a topic of its own is not pulled back to the previous one.
    assert "Approved institutions" in ask(client, "is this college fake", ("renew approval",))["text"]


def test_unknown_questions_are_not_guessed(client):
    client.cookies.clear()
    a = ask(client, "what is the weather today")
    assert a["confident"] is False and len(a["followUps"]) == 3


def test_file_status_only_for_people_allowed_to_see_it(client):
    client.cookies.clear()
    public = ask(client, "status of ANU-2026-0412")
    assert "can’t share" in public["text"] and not public["bullets"]

    login(client, "aicte", "Bureau head")
    foreign = next(a["id"] for a in client.get("/api/applications").json() if a["institutionId"] != "INS-001")
    other_region = next(a["id"] for a in client.get("/api/applications").json() if a["region"] != "CRO")
    every = ask(client, "how many files are overdue")
    assert every["source"] == "records" and every["text"] == "Your queue right now:"
    assert "in WRO" in ask(client, "show me files at risk in Mumbai")["text"]

    login(client, "institution")
    mine = ask(client, "where is my application")
    assert mine["source"] == "records" and any(b.startswith("ANU-2026-0412") for b in mine["bullets"])
    assert ask(client, "status of ANU-2026-0412")["link"]["to"] == "/institution/applications/ANU-2026-0412"
    assert "can’t find" in ask(client, f"status of {foreign}")["text"]

    login(client, "aicte", "Dealing officer")  # locked to the Central region
    assert ask(client, "how many files are overdue")["text"] == "Your queue in CRO right now:"
    assert "not a file you can see" in ask(client, f"status of {other_region}")["text"]
    client.cookies.clear()


class FakeLLMClient:
    """Stands in for anthropic.AsyncAnthropic: records the request and returns a canned reply or raises."""

    def __init__(self, reply: str | None = None, error: Exception | None = None, stop_reason: str = "end_turn"):
        self.calls: list[dict] = []
        self.reply, self.error, self.stop_reason = reply, error, stop_reason
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(stop_reason=self.stop_reason, content=[SimpleNamespace(type="text", text=self.reply or "")])


def test_ai_assistant_writes_the_reply_from_the_sources(client, monkeypatch):
    client.cookies.clear()
    fake = FakeLLMClient("For a change of site you need these, each signed by the Trust [1]:\n- Land documents [1]\n- Building plan [1]")
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")
    monkeypatch.setattr(assistant, "_client", fake)
    a = ask(client, "what papers do I need to shift our campus?")
    assert a["source"] == "ai" and a["bullets"] == ["Land documents", "Building plan"] and "[1]" not in a["text"]
    assert "APH 2.17" in a["cites"] and a["link"]["to"] == "/rules?type=site"
    sent = fake.calls[0]
    assert sent["model"] == "neural-assistant-v1" and sent["fallbacks"] == "default" and sent["output_config"] == {"effort": "low"}
    assert "[1]" in sent["messages"][0]["content"] and "Question: what papers do I need" in sent["messages"][0]["content"]


def test_ai_assistant_unavailable_or_declining_falls_back_to_the_handbook(client, monkeypatch):
    client.cookies.clear()
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")
    down = anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))
    for fake in (FakeLLMClient(error=down), FakeLLMClient("I can’t help with that.", stop_reason="refusal")):
        monkeypatch.setattr(assistant, "_client", fake)
        a = ask(client, "Documents for change of site?")
        assert a["source"] == "handbook" and len(a["bullets"]) == 7 and fake.calls
