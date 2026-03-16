import asyncio
import json
import logging
import os
import ssl
from pathlib import Path
from typing import Any

import aiohttp
import certifi
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, WorkerType, cli
from livekit.plugins import elevenlabs, openai, simli
from openai.types import realtime

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env.local", override=True)
load_dotenv(ROOT_DIR / ".env", override=False)

# Python.org installs on macOS can miss a usable default CA bundle. Pin the
# worker to certifi so outbound TLS to OpenAI/Simli succeeds consistently.
CA_BUNDLE = certifi.where()
os.environ.setdefault("SSL_CERT_FILE", CA_BUNDLE)
os.environ.setdefault("REQUESTS_CA_BUNDLE", CA_BUNDLE)
SSL_CONTEXT = ssl.create_default_context(cafile=CA_BUNDLE)

_original_create_default_context = ssl.create_default_context
_original_tcp_connector_init = aiohttp.TCPConnector.__init__


def _create_default_context_with_certifi(*args, **kwargs):
    if not args and "cafile" not in kwargs and "capath" not in kwargs and "cadata" not in kwargs:
        kwargs["cafile"] = CA_BUNDLE
    return _original_create_default_context(*args, **kwargs)


def _tcp_connector_init_with_certifi(self, *args, **kwargs):
    kwargs.setdefault("ssl", SSL_CONTEXT)
    return _original_tcp_connector_init(self, *args, **kwargs)


ssl.create_default_context = _create_default_context_with_certifi
ssl._create_default_https_context = _create_default_context_with_certifi
aiohttp.TCPConnector.__init__ = _tcp_connector_init_with_certifi

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vertex.simli_agent")


ELEVENLABS_PROBE_CACHE: tuple[bool, str | None] | None = None


def _tutor_name() -> str:
    """Return the tutor avatar name from the environment, never hardcoded."""
    return os.getenv("NEXT_PUBLIC_TUTOR_AVATAR_NAME", "Tutor").strip() or "Tutor"


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _build_instructions(metadata: dict[str, object]) -> str:
    tutor_name = _tutor_name()
    child_name = str(metadata.get("childName") or "friend").strip() or "friend"
    instructions = str(metadata.get("instructions") or "").strip()
    greeting = (
        f"Begin the session by immediately greeting {child_name} warmly. "
        f"Say something like: \"Hi {child_name}! I'm {tutor_name}. I'm happy to work on math with you today. "
        "What math problem would you like to start with?\""
    )
    lang_rule = "IMPORTANT: Always respond in English only, regardless of what language the student speaks."

    if instructions:
        return instructions + "\n\n" + lang_rule + "\n\n" + greeting

    return (
        f"You are {tutor_name}, a warm and encouraging live math tutor helping {child_name}. "
        "Only discuss math. If the child asks about unrelated topics, gently bring the conversation back to math help."
    )


def _build_greeting(metadata: dict[str, object]) -> str:
    tutor_name = _tutor_name()
    child_name = str(metadata.get("childName") or "friend").strip() or "friend"
    return (
        f"Hi {child_name}! I'm {tutor_name}. I'm happy to work on math with you today. "
        "What math problem would you like to start with?"
    )


def _build_realtime_model(*, audio_output: bool) -> openai.realtime.RealtimeModel:
    modalities: list[str] = ["text", "audio"] if audio_output else ["text"]
    return openai.realtime.RealtimeModel(
        model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
        voice=os.getenv("OPENAI_REALTIME_VOICE", "alloy"),
        modalities=modalities,
        api_key=_required_env("OPENAI_API_KEY"),
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
        temperature=float(os.getenv("OPENAI_REALTIME_TEMPERATURE", "0.6")),
    )


def _elevenlabs_api_key() -> str:
    return (
        os.getenv("ELEVENLABS_API_KEY", "").strip()
        or os.getenv("ELEVEN_API_KEY", "").strip()
    )


def _build_elevenlabs_request_body() -> dict[str, Any]:
    return {
        "text": "Hi there.",
        "model_id": os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5"),
        "voice_settings": {
            "stability": float(os.getenv("ELEVENLABS_STABILITY", "0.45")),
            "similarity_boost": float(os.getenv("ELEVENLABS_SIMILARITY_BOOST", "0.88")),
            "style": float(os.getenv("ELEVENLABS_STYLE", "0.20")),
            "speed": float(os.getenv("ELEVENLABS_SPEED", "1.0")),
            "use_speaker_boost": os.getenv("ELEVENLABS_SPEAKER_BOOST", "true").lower() != "false",
        },
    }


async def _probe_elevenlabs_custom_voice() -> tuple[bool, str | None]:
    global ELEVENLABS_PROBE_CACHE

    if ELEVENLABS_PROBE_CACHE is not None:
        return ELEVENLABS_PROBE_CACHE

    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
    if not voice_id:
        ELEVENLABS_PROBE_CACHE = (False, "Missing ELEVENLABS_VOICE_ID")
        return ELEVENLABS_PROBE_CACHE

    api_key = _elevenlabs_api_key()
    if not api_key:
        ELEVENLABS_PROBE_CACHE = (
            False,
            "Missing ELEVENLABS_API_KEY or ELEVEN_API_KEY",
        )
        return ELEVENLABS_PROBE_CACHE

    probe_url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        "?output_format=mp3_22050_32&optimize_streaming_latency=0"
    )

    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=SSL_CONTEXT)) as session:
            async with session.post(
                probe_url,
                headers={
                    "xi-api-key": api_key,
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                },
                json=_build_elevenlabs_request_body(),
            ) as response:
                if response.status >= 400:
                    detail = (await response.text()).strip()
                    message = f"ElevenLabs custom voice unavailable ({response.status}): {detail[:240]}"
                    ELEVENLABS_PROBE_CACHE = (False, message)
                    return ELEVENLABS_PROBE_CACHE

                first_chunk = await response.content.read(32)
                if not first_chunk:
                    ELEVENLABS_PROBE_CACHE = (
                        False,
                        "ElevenLabs custom voice returned no audio data",
                    )
                    return ELEVENLABS_PROBE_CACHE

                ELEVENLABS_PROBE_CACHE = (True, None)
                return ELEVENLABS_PROBE_CACHE
    except Exception as exc:
        ELEVENLABS_PROBE_CACHE = (
            False,
            f"ElevenLabs custom voice probe failed: {exc}",
        )
        return ELEVENLABS_PROBE_CACHE


def _build_tts() -> elevenlabs.TTS:
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
    if not voice_id:
        raise RuntimeError("Missing required environment variable: ELEVENLABS_VOICE_ID")

    api_key = _elevenlabs_api_key()
    if not api_key:
        raise RuntimeError(
            "Missing required environment variable: ELEVENLABS_API_KEY or ELEVEN_API_KEY"
        )

    voice_settings = elevenlabs.VoiceSettings(
        stability=float(os.getenv("ELEVENLABS_STABILITY", "0.45")),
        similarity_boost=float(os.getenv("ELEVENLABS_SIMILARITY_BOOST", "0.88")),
        style=float(os.getenv("ELEVENLABS_STYLE", "0.20")),
        speed=float(os.getenv("ELEVENLABS_SPEED", "1.0")),
        use_speaker_boost=os.getenv("ELEVENLABS_SPEAKER_BOOST", "true").lower() != "false",
    )

    return elevenlabs.TTS(
        voice_id=voice_id,
        api_key=api_key,
        model=os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5"),
        voice_settings=voice_settings,
        sync_alignment=True,
        enable_logging=False,
    )


async def entrypoint(ctx: JobContext):
    await ctx.connect()
    metadata = json.loads(ctx.job.metadata or "{}")
    logger.info("Starting live tutor", extra={"metadata": metadata})

    tutor_name = _tutor_name()

    # --- Build session: ElevenLabs TTS (preferred) or OpenAI Realtime voice (fallback) ---
    elevenlabs_ready, elevenlabs_reason = await _probe_elevenlabs_custom_voice()
    uses_external_tts = elevenlabs_ready

    if uses_external_tts:
        logger.info("Using ElevenLabs custom voice for %s", tutor_name)
        session = AgentSession(
            llm=_build_realtime_model(audio_output=False),
            tts=_build_tts(),
            use_tts_aligned_transcript=True,
        )
    else:
        logger.warning(
            "Falling back to OpenAI Realtime voice for %s because ElevenLabs custom voice is unavailable",
            tutor_name,
            extra={"reason": elevenlabs_reason},
        )
        session = AgentSession(
            llm=_build_realtime_model(audio_output=True),
            use_tts_aligned_transcript=True,
        )

    # --- Start Simli avatar with retries ---
    simli_config = simli.SimliConfig(
        api_key=_required_env("SIMLI_API_KEY"),
        face_id=os.getenv("SIMLI_FACE_ID", "cace3ef7-a4c4-425d-a8cf-a5358eb0c427"),
        max_session_length=int(os.getenv("SIMLI_MAX_SESSION_LENGTH", "1800")),
        max_idle_time=int(os.getenv("SIMLI_MAX_IDLE_TIME", "120")),
    )
    avatar_identity = f"simli-avatar-{ctx.room.name[:12]}"

    previous_output_audio = session.output.audio
    simli_avatar = None
    last_avatar_error = None
    for attempt in range(1, 4):
        try:
            simli_avatar = simli.AvatarSession(
                simli_config=simli_config,
                avatar_participant_identity=avatar_identity,
                avatar_participant_name=tutor_name,
            )
            await simli_avatar.start(session, room=ctx.room)
            break
        except Exception as error:
            last_avatar_error = error
            logger.warning(
                "Simli avatar start attempt failed",
                extra={"attempt": attempt, "room": ctx.room.name, "error": str(error)},
            )
            if attempt < 3:
                await asyncio.sleep(attempt)

    if simli_avatar is None:
        raise RuntimeError(
            f"Simli avatar failed to start after retries: {last_avatar_error}"
        )

    if session.output.audio is None or session.output.audio is previous_output_audio:
        raise RuntimeError(
            "Simli avatar did not attach an audio output. Check SIMLI_API_KEY, SIMLI_FACE_ID, "
            "and LiveKit credentials."
        )

    logger.info("Simli avatar is configured for realtime session", extra={"room": ctx.room.name})

    # --- Start the agent ---
    await session.start(
        room=ctx.room,
        agent=Agent(
            instructions=_build_instructions(metadata),
        ),
    )

    # --- Initial greeting ---
    if uses_external_tts:
        await session.say(_build_greeting(metadata), add_to_chat_ctx=False)
    else:
        await session.generate_reply(
            instructions=(
                f"Start the session now. Greet {metadata.get('childName', 'the child')} warmly by name, "
                f"introduce yourself as {tutor_name}, and ask what math problem they want to work on first. "
                "Mention that if they ask for a graph or visual, you will show it in chat."
            ),
            input_modality="text",
        )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            agent_name=os.getenv("LIVEKIT_AGENT_NAME", "vertex-tutor"),
        )
    )
