import { useCallback, useEffect, useRef, useState } from "react";
import { createVoiceConnection } from "../services/voiceService";

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const PLAYBACK_LEAD_SECONDS = 0.025;

function downsampleTo16k(input, inputSampleRate) {
    if (inputSampleRate === INPUT_SAMPLE_RATE) {
        return input;
    }

    if (inputSampleRate < INPUT_SAMPLE_RATE) {
        throw new Error("Microphone sample rate is below 16 kHz.");
    }

    const ratio = inputSampleRate / INPUT_SAMPLE_RATE;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(
            Math.floor((i + 1) * ratio),
            input.length,
        );

        let sum = 0;

        for (let j = start; j < end; j++) {
            sum += input[j];
        }

        output[i] = sum / Math.max(1, end - start);
    }

    return output;
}

function floatTo16BitPCM(input) {
    const pcm = new Int16Array(input.length);

    for (let i = 0; i < input.length; i++) {
        const sample = Math.max(-1, Math.min(1, input[i]));

        pcm[i] = sample < 0
            ? Math.round(sample * 32768)
            : Math.round(sample * 32767);
    }

    return pcm;
}

function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize),
        );
    }

    return btoa(binary);
}

function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function decodePcm16(base64, audioContext) {
    const bytes = fromBase64(base64);

    if (bytes.byteLength % 2 !== 0) {
        throw new Error("Invalid PCM audio payload.");
    }

    const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
    );

    const samples = new Float32Array(bytes.byteLength / 2);

    for (let i = 0; i < samples.length; i++) {
        samples[i] = view.getInt16(i * 2, true) / 32768;
    }

    const audioBuffer = audioContext.createBuffer(
        1,
        samples.length,
        OUTPUT_SAMPLE_RATE,
    );

    audioBuffer.copyToChannel(samples, 0);

    return audioBuffer;
}

export function useVoiceAgent() {
    const [status, setStatus] = useState("disconnected");
    const [voiceState, setVoiceState] = useState("idle");
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState("");

    const socketRef = useRef(null);
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);

    const sourceRef = useRef(null);
    const processorRef = useRef(null);
    const filterRef = useRef(null);
    const silentGainRef = useRef(null);

    const playbackSourcesRef = useRef(new Set());
    const nextPlaybackTimeRef = useRef(0);
    const speakingRef = useRef(false);
    const audioQueueRef = useRef([]);
    const playbackGenerationRef = useRef(0);

    const currentAssistantMessageRef = useRef(null);
    const currentUserMessageRef = useRef(null);
    const statusRef = useRef("disconnected");

    const updateStatus = useCallback((value) => {
        statusRef.current = value;
        setStatus(value);
    }, []);

    const updateVoiceState = useCallback((value) => {
        setVoiceState(value);
    }, []);

    const addMessage = useCallback((role, text) => {
        const id = `${Date.now()}-${Math.random()}`;

        setMessages((previous) => [
            ...previous,
            { id, role, text },
        ]);

        return id;
    }, []);

    const updateMessage = useCallback((id, text) => {
        if (!id) return;

        setMessages((previous) =>
            previous.map((message) =>
                message.id === id
                    ? { ...message, text }
                    : message,
            ),
        );
    }, []);

    const stopPlayback = useCallback(() => {
        playbackGenerationRef.current += 1;

        for (const source of playbackSourcesRef.current) {
            try {
                source.onended = null;
                source.stop();
            } catch {
                // The source may already have stopped.
            }
        }

        playbackSourcesRef.current.clear();
        audioQueueRef.current = [];
        nextPlaybackTimeRef.current = 0;
        speakingRef.current = false;
    }, []);

    const scheduleAudioBuffer = useCallback((audioBuffer) => {
        const audioContext = audioContextRef.current;

        if (
            !audioContext ||
            audioContext.state === "closed"
        ) {
            return;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        const startAt = Math.max(
            audioContext.currentTime + PLAYBACK_LEAD_SECONDS,
            nextPlaybackTimeRef.current,
        );

        const generation = playbackGenerationRef.current;

        playbackSourcesRef.current.add(source);
        speakingRef.current = true;
        updateVoiceState("speaking");

        nextPlaybackTimeRef.current =
            startAt + audioBuffer.duration;

        source.onended = () => {
            playbackSourcesRef.current.delete(source);

            if (generation !== playbackGenerationRef.current) {
                return;
            }

            if (
                playbackSourcesRef.current.size === 0 &&
                audioQueueRef.current.length === 0
            ) {
                speakingRef.current = false;
                nextPlaybackTimeRef.current = 0;

                if (statusRef.current === "connected") {
                    updateVoiceState("listening");
                }
            }
        };

        source.start(startAt);
    }, [updateVoiceState]);

    const playAudioChunk = useCallback((message) => {
        if (!message?.data) return;

        // This playback path expects raw PCM, not MP3 or another codec.
        const mimeType = (message.mime_type || "").toLowerCase();

        if (mimeType && !mimeType.includes("audio/pcm")) {
            console.warn(
                "Ignoring unsupported audio format:",
                message.mime_type,
            );
            return;
        }

        const audioContext = audioContextRef.current;

        if (
            !audioContext ||
            audioContext.state === "closed"
        ) {
            return;
        }

        audioQueueRef.current.push(message.data);

        if (audioQueueRef.current.length > 200) {
            audioQueueRef.current = [];
            stopPlayback();
            setError("Audio playback fell behind. Please reconnect.");
            return;
        }

        if (audioQueueRef.current.length === 1) {
            try {
                while (audioQueueRef.current.length > 0) {
                    const base64 = audioQueueRef.current.shift();
                    const buffer = decodePcm16(base64, audioContext);

                    scheduleAudioBuffer(buffer);
                }
            } catch (err) {
                console.error("Audio playback failed:", err);
                stopPlayback();
                setError("Audio playback failed. Check the browser console.");
            }
        }
    }, [scheduleAudioBuffer, stopPlayback]);

    const handleServerMessage = useCallback((event) => {
        let message;

        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }

        switch (message.type) {
            case "status": {
                if (message.message?.startsWith("Connected")) {
                    setError("");
                    updateStatus("connected");
                    updateVoiceState("listening");
                }
                break;
            }

            case "input_transcription": {
                const text = message.text || "";
                if (!text) break;

                const existingId = currentUserMessageRef.current;

                if (existingId) {
                    setMessages((previous) =>
                        previous.map((item) =>
                            item.id === existingId
                                ? { ...item, text: item.text + text }
                                : item,
                        ),
                    );
                } else {
                    currentUserMessageRef.current =
                        addMessage("user", text);
                }
                break;
            }

            case "output_transcription": {
                const text = message.text || "";
                if (!text) break;

                const existingId = currentAssistantMessageRef.current;

                if (existingId) {
                    setMessages((previous) =>
                        previous.map((item) =>
                            item.id === existingId
                                ? { ...item, text: item.text + text }
                                : item,
                        ),
                    );
                } else {
                    currentAssistantMessageRef.current =
                        addMessage("assistant", text);
                }
                break;
            }

            case "audio": {
                playAudioChunk(message);
                break;
            }

            case "turn_complete": {
                currentUserMessageRef.current = null;
                currentAssistantMessageRef.current = null;

                // Do not force listening here: final audio may still play.
                if (
                    playbackSourcesRef.current.size === 0 &&
                    audioQueueRef.current.length === 0 &&
                    statusRef.current === "connected"
                ) {
                    speakingRef.current = false;
                    updateVoiceState("listening");
                }
                break;
            }

            case "interrupted": {
                stopPlayback();

                if (statusRef.current === "connected") {
                    updateVoiceState("listening");
                }
                break;
            }

            case "error": {
                setError(
                    message.message || "An unexpected error occurred.",
                );
                break;
            }

            default:
                break;
        }
    }, [
        addMessage,
        playAudioChunk,
        stopPlayback,
        updateStatus,
        updateVoiceState,
    ]);

    const start = useCallback(async () => {
        if (
            statusRef.current === "connecting" ||
            statusRef.current === "connected"
        ) {
            return;
        }

        setError("");
        updateStatus("connecting");
        updateVoiceState("connecting");

        let socket = null;

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(
                    "Microphone access requires HTTPS or localhost.",
                );
            }

            const audioContext = new AudioContext({
                latencyHint: "interactive",
            });

            audioContextRef.current = audioContext;
            await audioContext.resume();

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            streamRef.current = stream;

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Reduce low-frequency rumble from fans, desks, and handling noise.
            const highPass = audioContext.createBiquadFilter();
            highPass.type = "highpass";
            highPass.frequency.value = 80;
            highPass.Q.value = 0.707;
            filterRef.current = highPass;

            const processor = audioContext.createScriptProcessor(
                2048,
                1,
                1,
            );

            processorRef.current = processor;

            const silentGain = audioContext.createGain();
            silentGain.gain.value = 0;
            silentGainRef.current = silentGain;

            processor.onaudioprocess = (event) => {
                const activeSocket = socketRef.current;

                if (
                    !activeSocket ||
                    activeSocket.readyState !== WebSocket.OPEN ||
                    statusRef.current !== "connected"
                ) {
                    return;
                }

                // Avoid sending speaker playback back into the model.
                // The state is reset when scheduled audio finishes.
                if (speakingRef.current) {
                    return;
                }

                try {
                    const input = event.inputBuffer.getChannelData(0);

                    const downsampled = downsampleTo16k(
                        input,
                        audioContext.sampleRate,
                    );

                    const pcm = floatTo16BitPCM(downsampled);

                    activeSocket.send(JSON.stringify({
                        type: "audio",
                        data: toBase64(pcm.buffer),
                    }));
                } catch (err) {
                    console.error("Microphone processing failed:", err);
                }
            };

            source.connect(highPass);
            highPass.connect(processor);
            processor.connect(silentGain);
            silentGain.connect(audioContext.destination);

            socket = createVoiceConnection();
            socketRef.current = socket;

            socket.onmessage = handleServerMessage;

            socket.onerror = () => {
                setError("Unable to connect to Nexora's voice server.");
            };

            socket.onclose = () => {
                if (
                    socketRef.current === socket &&
                    statusRef.current !== "disconnected"
                ) {
                    updateStatus("disconnected");
                    updateVoiceState("idle");
                    stopPlayback();

                    setError(
                        "Voice connection closed. Start a new session to reconnect.",
                    );
                }
            };

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Connection timed out."));
                }, 20000);

                socket.addEventListener("open", () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });

                socket.addEventListener("error", () => {
                    clearTimeout(timeout);
                    reject(new Error("Could not open the voice connection."));
                }, { once: true });

                socket.addEventListener("close", () => {
                    clearTimeout(timeout);
                    reject(new Error("Voice connection closed."));
                }, { once: true });
            });
        } catch (err) {
            setError(err.message || "Unable to start voice conversation.");

            if (socket) {
                socket.onclose = null;
                socket.close();
            }

            streamRef.current?.getTracks().forEach((track) => {
                track.stop();
            });

            const context = audioContextRef.current;

            if (context && context.state !== "closed") {
                await context.close();
            }

            socketRef.current = null;
            streamRef.current = null;
            audioContextRef.current = null;
            sourceRef.current = null;
            processorRef.current = null;
            filterRef.current = null;
            silentGainRef.current = null;

            stopPlayback();
            updateStatus("disconnected");
            updateVoiceState("idle");
        }
    }, [
        handleServerMessage,
        stopPlayback,
        updateStatus,
        updateVoiceState,
    ]);

    const stop = useCallback(async () => {
        const socket = socketRef.current;

        // Update state first so a normal close is not treated as an error.
        updateStatus("disconnected");
        updateVoiceState("idle");
        stopPlayback();

        if (socket) {
            socket.onclose = null;

            if (socket.readyState === WebSocket.OPEN) {
                try {
                    socket.send(JSON.stringify({ type: "end" }));
                } catch {
                    // The connection may already be closing.
                }
            }

            socket.close();
        }

        streamRef.current?.getTracks().forEach((track) => {
            track.stop();
        });

        const context = audioContextRef.current;

        if (context && context.state !== "closed") {
            await context.close();
        }

        socketRef.current = null;
        streamRef.current = null;
        audioContextRef.current = null;
        sourceRef.current = null;
        processorRef.current = null;
        filterRef.current = null;
        silentGainRef.current = null;

        currentUserMessageRef.current = null;
        currentAssistantMessageRef.current = null;
    }, [stopPlayback, updateStatus, updateVoiceState]);

    const toggle = useCallback(() => {
        if (
            statusRef.current === "connected" ||
            statusRef.current === "connecting"
        ) {
            void stop();
        } else {
            void start();
        }
    }, [start, stop]);

    const sendText = useCallback((text) => {
        const trimmed = text.trim();
        const socket = socketRef.current;

        if (
            !trimmed ||
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        addMessage("user", trimmed);

        socket.send(JSON.stringify({
            type: "text",
            text: trimmed,
        }));
    }, [addMessage]);

    const clearConversation = useCallback(() => {
        setMessages([]);
        currentUserMessageRef.current = null;
        currentAssistantMessageRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            socketRef.current?.close();

            streamRef.current?.getTracks().forEach((track) => {
                track.stop();
            });

            for (const source of playbackSourcesRef.current) {
                try {
                    source.onended = null;
                    source.stop();
                } catch {
                    // Already stopped.
                }
            }

            playbackSourcesRef.current.clear();

            const context = audioContextRef.current;

            if (context && context.state !== "closed") {
                void context.close();
            }
        };
    }, []);

    return {
        status,
        voiceState,
        messages,
        error,
        start,
        stop,
        toggle,
        sendText,
        clearConversation,
    };
}