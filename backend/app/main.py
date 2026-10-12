import asyncio
import base64
import logging
from contextlib import suppress

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google.genai import types

from app.config import FRONTEND_ORIGIN
from app.voice_agent import (
    create_gemini_client,
    create_live_config,
    get_model_name,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexora")

app = FastAPI(
    title="Nexora AI",
    description="Real-time AI voice assistant",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"service": "Nexora AI", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "Nexora AI"}


@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()

    receiver_task = None
    receive_task = None

    try:
        client = create_gemini_client()
        config = create_live_config()
        model = get_model_name()

        await websocket.send_json({
            "type": "status",
            "message": "Connecting to Gemini Live...",
        })

        logger.info("Opening Gemini Live session using model: %s", model)

        async with client.aio.live.connect(
            model=model,
            config=config,
        ) as session:

            await websocket.send_json({
                "type": "status",
                "message": "Connected. Start speaking.",
            })

            async def receive_gemini():
                """Forward Gemini responses while keeping the session alive."""
                try:
                    while True:
                        # Re-enter receive() if the iterator ends after a turn.
                        async for response in session.receive():
                            server_content = response.server_content

                            if not server_content:
                                continue

                            input_transcription = (
                                server_content.input_transcription
                            )
                            output_transcription = (
                                server_content.output_transcription
                            )

                            if input_transcription:
                                text = input_transcription.text or ""
                                if text:
                                    await websocket.send_json({
                                        "type": "input_transcription",
                                        "text": text,
                                    })

                            if output_transcription:
                                text = output_transcription.text or ""
                                if text:
                                    await websocket.send_json({
                                        "type": "output_transcription",
                                        "text": text,
                                    })

                            model_turn = server_content.model_turn

                            if model_turn:
                                for part in model_turn.parts or []:
                                    inline_data = part.inline_data

                                    if (
                                        inline_data
                                        and inline_data.data
                                    ):
                                        audio_bytes = inline_data.data

                                        await websocket.send_json({
                                            "type": "audio",
                                            "data": base64.b64encode(
                                                audio_bytes
                                            ).decode("ascii"),
                                            "mime_type": (
                                                inline_data.mime_type
                                                or "audio/pcm;rate=24000"
                                            ),
                                        })

                            if server_content.interrupted:
                                await websocket.send_json({
                                    "type": "interrupted",
                                })

                            if server_content.turn_complete:
                                logger.info(
                                    "Gemini turn completed; "
                                    "waiting for the next user turn."
                                )
                                await websocket.send_json({
                                    "type": "turn_complete",
                                })

                except asyncio.CancelledError:
                    raise
                except WebSocketDisconnect:
                    raise
                except Exception:
                    logger.exception(
                        "Gemini response receiver failed"
                    )

                    with suppress(Exception):
                        await websocket.send_json({
                            "type": "error",
                            "message": (
                                "Gemini's response stream stopped. "
                                "Check the backend logs and reconnect."
                            ),
                        })

                    raise

            receiver_task = asyncio.create_task(receive_gemini())

            while True:
                if receiver_task.done():
                    # Propagate receiver errors instead of silently continuing
                    # with a dead response stream.
                    receiver_task.result()
                    raise RuntimeError(
                        "Gemini response receiver stopped unexpectedly."
                    )

                receive_task = asyncio.create_task(
                    websocket.receive_json()
                )

                done, _ = await asyncio.wait(
                    {receive_task, receiver_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if receiver_task in done:
                    receive_task.cancel()

                    with suppress(asyncio.CancelledError, Exception):
                        await receive_task

                    receive_task = None
                    receiver_task.result()

                    raise RuntimeError(
                        "Gemini response receiver stopped."
                    )

                message = receive_task.result()
                receive_task = None

                message_type = message.get("type")

                if message_type == "audio":
                    encoded_audio = message.get("data", "")

                    if not encoded_audio:
                        continue

                    try:
                        audio_bytes = base64.b64decode(
                            encoded_audio,
                            validate=True,
                        )
                    except (ValueError, TypeError):
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid microphone audio data.",
                        })
                        continue

                    if len(audio_bytes) % 2 != 0:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid PCM audio length.",
                        })
                        continue

                    await session.send_realtime_input(
                        audio=types.Blob(
                            data=audio_bytes,
                            mime_type="audio/pcm;rate=16000",
                        )
                    )

                elif message_type == "text":
                    text = message.get("text", "").strip()

                    if text:
                        await session.send_realtime_input(text=text)

                elif message_type == "end":
                    logger.info("Client requested session shutdown.")
                    break

    except WebSocketDisconnect:
        logger.info("Voice client disconnected.")

    except asyncio.CancelledError:
        raise

    except Exception:
        logger.exception("Voice session failed.")

        with suppress(Exception):
            await websocket.send_json({
                "type": "error",
                "message": (
                    "The voice session ended unexpectedly. "
                    "Check the backend logs for the cause."
                ),
            })

    finally:
        for task in (receive_task, receiver_task):
            if task and not task.done():
                task.cancel()

                with suppress(asyncio.CancelledError, Exception):
                    await task

        with suppress(Exception):
            await websocket.close()