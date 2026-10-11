from google import genai
from google.genai import types

from app.config import (
    GEMINI_API_KEY,
    GEMINI_LIVE_MODEL,
    SYSTEM_INSTRUCTION,
)


def create_gemini_client():
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is missing. "
            "Add it to backend/.env."
        )

    return genai.Client(api_key=GEMINI_API_KEY)


def create_live_config():
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=types.Content(
            parts=[
                types.Part(text=SYSTEM_INSTRUCTION)
            ]
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Kore"
                )
            )
        ),
    )


def get_model_name():
    return GEMINI_LIVE_MODEL