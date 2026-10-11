import asyncio
import base64
import logging

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
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Voice Agent",
    description="Real-time Gemini-powered voice assistant",
    version="1.0.0",
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
    return {
        "service": "AI Voice Agent",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "AI Voice Agent",
    }


@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()

    receiver_task = None

    try:
        client = create_gemini_client()
        config = create_live_config()
        model = get_model_name()

        await websocket.send_json({
            "type": "status",
            "message": "Connecting to Gemini Live...",
        })

        async with client.aio.live.connect(
            model=model,
            config=config,
        ) as session:

            await websocket.send_json({
                "type": "status",
                "message": "Connected. Start speaking.",
            })

            async def receive_gemini():
                try:
                    async for response in session.receive():
                        server_content = response.server_content

                        if server_content:
                            input_transcription = (
                                server_content.input_transcription
                            )
                            output_transcription = (
                                server_content.output_transcription
                            )

                            if input_transcription:
                                await websocket.send_json({
                                    "type": "input_transcription",
                                    "text": input_transcription.text or "",
                                })

                            if output_transcription:
                                await websocket.send_json({
                                    "type": "output_transcription",
                                    "text": output_transcription.text or "",
                                })

                            if server_content.turn_complete:
                                await websocket.send_json({
                                    "type": "turn_complete",
                                })

                            if server_content.interrupted:
                                await websocket.send_json({
                                    "type": "interrupted",
                                })

                            model_turn = server_content.model_turn

                            if model_turn:
                                for part in model_turn.parts:
                                    if part.inline_data:
                                        audio_data = part.inline_data.data

                                        if audio_data:
                                            await websocket.send_json({
                                                "type": "audio",
                                                "data": base64.b64encode(
                                                    audio_data
                                                ).decode("utf-8"),
                                                "mime_type": (
                                                    part.inline_data.mime_type
                                                    or "audio/pcm;rate=24000"
                                                ),
                                            })

                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("Error receiving Gemini response")
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "message": (
                                "The AI response stream encountered an error."
                            ),
                        })
                    except Exception:
                        pass

            receiver_task = asyncio.create_task(receive_gemini())

            while True:
                message = await websocket.receive_json()
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
                    except Exception:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid audio data received.",
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
                    break

    except WebSocketDisconnect:
        logger.info("Voice client disconnected")

    except Exception:
        logger.exception("Voice WebSocket error")

        try:
            await websocket.send_json({
                "type": "error",
                "message": (
                    "Unable to establish the AI session. "
                    "Check the backend logs and API configuration."
                ),
            })
        except Exception:
            pass

    finally:
        if receiver_task:
            receiver_task.cancel()

            try:
                await receiver_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        try:
            await websocket.close()
        except Exception:
            pass