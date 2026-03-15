import json
import logging
import os
from pathlib import Path

import certifi
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, WorkerType, cli
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


async def entrypoint(ctx: JobContext):
    metadata = json.loads(ctx.job.metadata or "{}")
    logger.info("Starting live tutor", extra={"metadata": metadata})

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
            voice=os.getenv("OPENAI_REALTIME_VOICE", "alloy"),
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

    simli_avatar = None
    try:
        simli_avatar = simli.AvatarSession(
            simli_config=simli.SimliConfig(
                api_key=_required_env("SIMLI_API_KEY"),
                face_id=os.getenv("SIMLI_FACE_ID", "cace3ef7-a4c4-425d-a8cf-a5358eb0c427"),
                max_session_length=int(os.getenv("SIMLI_MAX_SESSION_LENGTH", "1800")),
                max_idle_time=int(os.getenv("SIMLI_MAX_IDLE_TIME", "120")),
            ),
            avatar_participant_identity=f"simli-avatar-{ctx.room.name[:12]}",
            avatar_participant_name=os.getenv("NEXT_PUBLIC_TUTOR_AVATAR_NAME", "Tina"),
        )
    except Exception as e:
        logger.exception("Simli avatar config failed: %s", e, extra={"room": ctx.room.name})

    await session.start(
        room=ctx.room,
        agent=Agent(
            instructions=_build_instructions(metadata),
        ),
    )

    if simli_avatar:
        try:
            await simli_avatar.start(session, room=ctx.room)
            logger.info("Simli avatar start requested", extra={"room": ctx.room.name})
        except Exception as e:
            logger.exception("Simli avatar failed to start: %s", e, extra={"room": ctx.room.name})

    await session.generate_reply(instructions=_build_greeting(metadata))


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            agent_name=os.getenv("LIVEKIT_AGENT_NAME", "vertex-tina-tutor"),
        )
    )
