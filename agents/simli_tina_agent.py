import json
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

import certifi
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, cli
from livekit.plugins import openai, simli
from openai.types import realtime

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env.local", override=True)
load_dotenv(ROOT_DIR / ".env", override=False)

# Python.org installs on macOS can miss a usable default CA bundle. Pin the
# worker to certifi so outbound TLS to OpenAI/Simli succeeds consistently.
CA_BUNDLE = certifi.where()
os.environ.setdefault("SSL_CERT_FILE", CA_BUNDLE)
os.environ.setdefault("REQUESTS_CA_BUNDLE", CA_BUNDLE)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vertex.simli_tina_agent")

server = AgentServer()
SIMLI_SAMPLE_RATE = 16000


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _build_instructions(metadata: dict[str, object]) -> str:
    tutor_name = os.getenv("NEXT_PUBLIC_TUTOR_AVATAR_NAME", "Tina").strip() or "Tina"
    instructions = str(metadata.get("instructions") or "").strip()
    if instructions:
        return instructions

    child_name = str(metadata.get("childName") or "friend")
    return (
        f"You are {tutor_name}, a warm and encouraging live math tutor helping {child_name}. "
        "Only discuss math. If the child asks about unrelated topics, gently bring the conversation back to math help."
    )


def _build_greeting(metadata: dict[str, object]) -> str:
    tutor_name = os.getenv("NEXT_PUBLIC_TUTOR_AVATAR_NAME", "Tina").strip() or "Tina"
    child_name = str(metadata.get("childName") or "friend").strip() or "friend"
    return (
        f"Hi {child_name}! I'm {tutor_name}. I'm happy to work on math with you today. "
        "What math problem would you like to start with?"
    )


def _can_publish_avatar_video(livekit_url: str) -> tuple[bool, str | None]:
    try:
        parsed = urlparse(livekit_url)
        hostname = (parsed.hostname or "").lower()
        is_local = hostname in {"localhost", "127.0.0.1", "0.0.0.0"} or hostname.endswith(".local")

        if parsed.scheme != "wss":
            return (
                False,
                "Simli avatar video needs a public LiveKit URL over wss://. The current room URL is not publicly reachable.",
            )

        if is_local:
            return (
                False,
                "Simli avatar video cannot join a localhost LiveKit room. Use a public wss:// LiveKit endpoint.",
            )

        return True, None
    except Exception:
        return False, "The LiveKit URL is invalid for Simli avatar video."


@server.rtc_session(agent_name=os.getenv("LIVEKIT_AGENT_NAME", "vertex-tina-tutor"))
async def tina_tutor(ctx: agents.JobContext):
    metadata = json.loads(ctx.job.metadata or "{}")
    logger.info("Starting live tutor", extra={"metadata": metadata})

    livekit_url = _required_env("LIVEKIT_URL")

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
            voice=os.getenv("OPENAI_REALTIME_VOICE", "marin"),
            modalities=["audio", "text"],
            input_audio_transcription=realtime.AudioTranscription(
                model=os.getenv("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-transcribe"),
            ),
            input_audio_noise_reduction="near_field",
            turn_detection=realtime.realtime_audio_input_turn_detection.SemanticVad(
                type="semantic_vad",
                create_response=True,
                eagerness="auto",
                interrupt_response=True,
            ),
            speed=float(os.getenv("OPENAI_REALTIME_SPEED", "0.96")),
        ),
    )

    avatar_supported, avatar_reason = _can_publish_avatar_video(livekit_url)
    if avatar_supported:
        avatar_session = simli.AvatarSession(
            simli_config=simli.SimliConfig(
                api_key=_required_env("SIMLI_API_KEY"),
                face_id=os.getenv("SIMLI_FACE_ID", "cace3ef7-a4c4-425d-a8cf-a5358eb0c427"),
                max_session_length=int(os.getenv("SIMLI_MAX_SESSION_LENGTH", "1800")),
                max_idle_time=int(os.getenv("SIMLI_MAX_IDLE_TIME", "120")),
            ),
            avatar_participant_identity=f"simli-avatar-{ctx.room.name[:12]}",
            avatar_participant_name=os.getenv("NEXT_PUBLIC_TUTOR_AVATAR_NAME", "Tina"),
        )
        await avatar_session.start(
            session,
            room=ctx.room,
            livekit_url=livekit_url,
            livekit_api_key=_required_env("LIVEKIT_API_KEY"),
            livekit_api_secret=_required_env("LIVEKIT_API_SECRET"),
        )
        logger.info("Simli avatar start requested", extra={"room": ctx.room.name})
    else:
        logger.warning("Skipping Simli avatar video", extra={"reason": avatar_reason, "livekit_url": livekit_url})

    await session.start(
        room=ctx.room,
        agent=Agent(
            instructions=_build_instructions(metadata),
        ),
    )
    session.say(_build_greeting(metadata), add_to_chat_ctx=False)


if __name__ == "__main__":
    cli.run_app(server)
