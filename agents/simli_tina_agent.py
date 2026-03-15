import json
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

import aiohttp
import certifi
from dotenv import load_dotenv
from livekit import agents, api
from livekit.agents import Agent, AgentServer, AgentSession, cli, get_job_context
from livekit.agents.voice.avatar import DataStreamAudioOutput
from livekit.agents.voice.room_io import ATTRIBUTE_PUBLISH_ON_BEHALF
from livekit.plugins import openai, simli

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
    instructions = str(metadata.get("instructions") or "").strip()
    if instructions:
        return instructions

    child_name = str(metadata.get("childName") or "friend")
    return (
        f"You are Tina, a warm and encouraging live math tutor helping {child_name}. "
        "Only discuss math. If the child asks about unrelated topics, gently bring the conversation back to math help."
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


async def _start_simli_avatar(
    *,
    room,
    local_participant_identity: str,
    livekit_url: str,
) -> str | None:
    face_id = os.getenv("SIMLI_FACE_ID", "cace3ef7-a4c4-425d-a8cf-a5358eb0c427")
    avatar_identity = f"simli-avatar-{room.name[:12]}"
    avatar_name = os.getenv("NEXT_PUBLIC_TUTOR_AVATAR_NAME", "Tina")

    livekit_token = (
        api.AccessToken(
            api_key=_required_env("LIVEKIT_API_KEY"),
            api_secret=_required_env("LIVEKIT_API_SECRET"),
        )
        .with_kind("agent")
        .with_identity(avatar_identity)
        .with_name(avatar_name)
        .with_grants(api.VideoGrants(room_join=True, room=room.name))
        .with_attributes({ATTRIBUTE_PUBLISH_ON_BEHALF: local_participant_identity})
        .to_jwt()
    )

    payload = simli.SimliConfig(
        api_key=_required_env("SIMLI_API_KEY"),
        face_id=face_id,
        max_session_length=int(os.getenv("SIMLI_MAX_SESSION_LENGTH", "1800")),
        max_idle_time=int(os.getenv("SIMLI_MAX_IDLE_TIME", "120")),
    ).create_json()

    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as http_session:
        try:
            compose_response = await http_session.post(
                "https://api.simli.ai/compose/token",
                json=payload,
                headers={"x-simli-api-key": _required_env("SIMLI_API_KEY")},
            )
            compose_body = await compose_response.text()
            compose_response.raise_for_status()
            session_token = json.loads(compose_body)["session_token"]
        except Exception:
            logger.exception("Failed to create Simli session token")
            return None

        try:
            connect_response = await http_session.post(
                "https://api.simli.ai/integrations/livekit/agents",
                json={
                    "session_token": session_token,
                    "livekit_token": livekit_token,
                    "livekit_url": livekit_url,
                },
            )
            connect_body = await connect_response.text()
            connect_response.raise_for_status()
            logger.info(
                "Simli avatar joined room",
                extra={
                    "room": room.name,
                    "avatar_identity": avatar_identity,
                    "response": connect_body,
                },
            )
        except Exception:
            logger.exception("Failed to connect Simli avatar to LiveKit room")
            return None

    return avatar_identity


@server.rtc_session(agent_name=os.getenv("LIVEKIT_AGENT_NAME", "vertex-tina-tutor"))
async def tina_tutor(ctx: agents.JobContext):
    metadata = json.loads(ctx.job.metadata or "{}")
    logger.info("Starting Tina tutor", extra={"metadata": metadata})

    livekit_url = _required_env("LIVEKIT_URL")

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
            voice=os.getenv("OPENAI_REALTIME_VOICE", "alloy"),
        ),
    )

    avatar_supported, avatar_reason = _can_publish_avatar_video(livekit_url)
    if avatar_supported:
        job_ctx = get_job_context()
        avatar_identity = await _start_simli_avatar(
            room=ctx.room,
            local_participant_identity=job_ctx.local_participant_identity,
            livekit_url=livekit_url,
        )
        if avatar_identity:
            session.output.audio = DataStreamAudioOutput(
                room=ctx.room,
                destination_identity=avatar_identity,
                sample_rate=SIMLI_SAMPLE_RATE,
            )
        else:
            logger.warning("Simli avatar start failed; continuing voice-only agent")
    else:
        logger.warning("Skipping Simli avatar video", extra={"reason": avatar_reason, "livekit_url": livekit_url})

    await session.start(
        room=ctx.room,
        agent=Agent(
            instructions=_build_instructions(metadata),
        ),
    )


if __name__ == "__main__":
    cli.run_app(server)
