
import { useCallback, useEffect, useRef, useState } from "react";
import { createVoiceConnection } from "../services/voiceService";

const TARGET_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const PLAYBACK_LEAD_SECONDS = 0.08;

function downsampleTo16k(input, inputSampleRate) {
    if (inputSampleRate === TARGET_SAMPLE_RATE) {
        return input;
    }

    if (inputSampleRate < TARGET_SAMPLE_RATE) {
        throw new Error("Microphone sample rate is below 16 kHz.");
    }

    const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
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

        pcm[i] =
            sample < 0
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
    const workletRef = useRef(null);
    const silentGainRef = useRef(null);

    const playbackSourcesRef = useRef(new Set());
    const nextPlaybackTimeRef = useRef(0);
    const speakingRef = useRef(false);
    const currentAssistantMessageRef = useRef(null);
    const currentUserMessageRef = useRef(null);
    const statusRef = useRef("disconnected");
    const audioQueueRef = useRef([]);
    const isProcessingAudioRef = useRef(false);
    const playbackGenerationRef = useRef(0);

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
        // Invalidate any pending playback work.
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
        isProcessingAudioRef.current = false;
        nextPlaybackTimeRef.current = 0;
        speakingRef.current = false;
    }, []);

    const scheduleAudioBuffer = useCallback(
        (audioBuffer) => {
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

            // Schedule this chunk directly after the previous chunk.
            // A short lead time helps avoid starting too close to "now".
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

                // Ignore callbacks from playback that was cancelled.
                if (generation !== playbackGenerationRef.current) {
                    return;
                }

                // Do not switch to listening while future chunks
                // are still queued or scheduled.
                if (
                    playbackSourcesRef.current.size === 0 &&
                    audioQueueRef.current.length === 0 &&
                    !isProcessingAudioRef.current
                ) {
                    speakingRef.current = false;
                    nextPlaybackTimeRef.current = 0;

                    if (statusRef.current === "connected") {
                        updateVoiceState("listening");
                    }
                }
            };

            source.start(startAt);
        },
        [updateVoiceState],
    );

    const processAudioQueue = useCallback(() => {
        if (isProcessingAudioRef.current) {
            return;
        }

        const audioContext = audioContextRef.current;

        if (
            !audioContext ||
            audioContext.state === "closed"
        ) {
            audioQueueRef.current = [];
            return;
        }

        isProcessingAudioRef.current = true;

        try {
            while (audioQueueRef.current.length > 0) {
                const base64 = audioQueueRef.current.shift();

                const currentContext = audioContextRef.current;

                if (
                    !currentContext ||
                    currentContext.state === "closed"
                ) {
                    audioQueueRef.current = [];
                    break;
                }

                const audioBuffer = decodePcm16(
                    base64,
                    currentContext,
                );

                scheduleAudioBuffer(audioBuffer);
            }
        } catch (err) {
            console.error("Audio playback failed:", err);
            setError("Audio playback failed. Check the browser console.");
        } finally {
            isProcessingAudioRef.current = false;

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
        }
    }, [scheduleAudioBuffer, updateVoiceState]);

    const playAudioChunk = useCallback(
        (base64) => {
            if (!base64) return;

            const audioContext = audioContextRef.current;

            if (
                !audioContext ||
                audioContext.state === "closed"
            ) {
                return;
            }

            audioQueueRef.current.push(base64);
            processAudioQueue();
        },
        [processAudioQueue],
    );

    const handleServerMessage = useCallback(
        async (event) => {
            let message;

            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }

            switch (message.type) {
                case "status": {
                    if (message.message?.startsWith("Connected")) {
                        updateStatus("connected");
                        updateVoiceState("listening");
                    }
                    break;
                }

                case "input_transcription": {
                    if (!message.text) break;

                    const existingId = currentUserMessageRef.current;

                    if (existingId) {
                        setMessages((previous) =>
                            previous.map((item) =>
                                item.id === existingId
                                    ? {
                                        ...item,
                                        text: item.text + message.text,
                                    }
                                    : item,
                            ),
                        );
                    } else {
                        currentUserMessageRef.current = addMessage(
                            "user",
                            message.text,
                        );
                    }

                    break;
                }

                case "output_transcription": {
                    if (!message.text) break;

                    if (currentAssistantMessageRef.current) {
                        setMessages((previous) =>
                            previous.map((item) =>
                                item.id === currentAssistantMessageRef.current
                                    ? {
                                        ...item,
                                        text: item.text + message.text,
                                    }
                                    : item,
                            ),
                        );
                    } else {
                        currentAssistantMessageRef.current = addMessage(
                            "assistant",
                            message.text,
                        );
                    }

                    break;
                }

                case "audio": {
                    if (message.data) {
                        playAudioChunk(message.data);
                    }
                    break;
                }

                case "turn_complete": {
                    currentUserMessageRef.current = null;
                    currentAssistantMessageRef.current = null;
                    break;
                }

                case "interrupted": {
                    stopPlayback();
                    updateVoiceState("listening");
                    break;
                }

                case "error": {
                    setError(
                        message.message ||
                        "An unexpected error occurred.",
                    );
                    break;
                }

                default:
                    break;
            }
        },
        [
            addMessage,
            playAudioChunk,
            stopPlayback,
            updateStatus,
            updateVoiceState,
        ],
    );

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

        let socket;

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(
                    "Microphone access requires localhost or HTTPS.",
                );
            }

            const audioContext = new AudioContext();

            audioContextRef.current = audioContext;

            await audioContext.resume();

            if (audioContext.state !== "running") {
                throw new Error(
                    "Audio playback is not available. Check browser audio permissions.",
                );
            }

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

            const processor = audioContext.createScriptProcessor(
                2048,
                1,
                1,
            );

            workletRef.current = processor;

            const silentGain = audioContext.createGain();
            silentGain.gain.value = 0;
            silentGainRef.current = silentGain;

            processor.onaudioprocess = (event) => {
                const activeSocket = socketRef.current;

                if (
                    !activeSocket ||
                    activeSocket.readyState !== WebSocket.OPEN
                ) {
                    return;
                }

                if (
                    statusRef.current !== "connected" ||
                    speakingRef.current
                ) {
                    return;
                }

                const input = event.inputBuffer.getChannelData(0);

                const downsampled = downsampleTo16k(
                    input,
                    audioContext.sampleRate,
                );

                const pcm = floatTo16BitPCM(downsampled);

                activeSocket.send(
                    JSON.stringify({
                        type: "audio",
                        data: toBase64(pcm.buffer),
                    }),
                );
            };

            source.connect(processor);
            processor.connect(silentGain);
            silentGain.connect(audioContext.destination);

            socket = createVoiceConnection();
            socketRef.current = socket;

            socket.onmessage = (event) => {
                void handleServerMessage(event);
            };

            socket.onerror = () => {
                setError(
                    "Unable to connect to Nexora's voice server.",
                );
            };

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Connection timed out."));
                }, 20000);

                socket.onopen = () => {
                    clearTimeout(timeout);
                    resolve();
                };

                socket.onclose = () => {
                    clearTimeout(timeout);
                    reject(new Error("Voice connection closed."));
                };
            });
        } catch (err) {
            setError(
                err.message ||
                "Unable to start voice conversation.",
            );

            socket?.close();

            streamRef.current?.getTracks().forEach((track) => {
                track.stop();
            });

            const activeContext = audioContextRef.current;

            if (activeContext && activeContext.state !== "closed") {
                await activeContext.close();
            }

            streamRef.current = null;
            audioContextRef.current = null;
            sourceRef.current = null;
            workletRef.current = null;
            silentGainRef.current = null;
            socketRef.current = null;

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

        updateStatus("disconnected");
        updateVoiceState("idle");

        stopPlayback();

        if (socket) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "end" }));
            }

            socket.close();
        }

        streamRef.current?.getTracks().forEach((track) => {
            track.stop();
        });

        const audioContext = audioContextRef.current;

        if (audioContext && audioContext.state !== "closed") {
            await audioContext.close();
        }

        socketRef.current = null;
        streamRef.current = null;
        audioContextRef.current = null;
        sourceRef.current = null;
        workletRef.current = null;
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

    const sendText = useCallback(
        (text) => {
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

            socket.send(
                JSON.stringify({
                    type: "text",
                    text: trimmed,
                }),
            );
        },
        [addMessage],
    );

    const clearConversation = useCallback(() => {
        setMessages([]);
        currentUserMessageRef.current = null;
        currentAssistantMessageRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            playbackGenerationRef.current += 1;

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

            if (audioContextRef.current?.state !== "closed") {
                void audioContextRef.current?.close();
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
