const API_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const WS_URL = API_URL.replace(/^http/, "ws");

export function createVoiceConnection() {
    return new WebSocket(`${WS_URL}/ws/voice`);
}