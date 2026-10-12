import { motion } from "framer-motion";
import {
    AudioLines,
    Mic,
    MicOff,
    LoaderCircle,
} from "lucide-react";

function VoiceOrb({ state, onToggle }) {
    const listening = state === "listening";
    const speaking = state === "speaking";
    const connecting = state === "connecting";
    const active = listening || speaking;

    const statusText = connecting
        ? "CONNECTING TO NEXORA"
        : speaking
            ? "NEXORA IS SPEAKING"
            : listening
                ? "LISTENING TO YOU"
                : "TAP TO START";

    return (
        <div className={`voice-orb-container ${state}`}>
            <motion.div
                className="orb-ring orb-ring-one"
                animate={{ rotate: 360 }}
                transition={{
                    duration: 22,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            <motion.div
                className="orb-ring orb-ring-two"
                animate={{ rotate: -360 }}
                transition={{
                    duration: 30,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            <motion.div
                className="avatar-halo"
                animate={{
                    scale: speaking
                        ? [1, 1.08, 1]
                        : listening
                            ? [1, 1.035, 1]
                            : [1, 1.015, 1],
                    opacity: speaking
                        ? [0.65, 1, 0.65]
                        : [0.5, 0.8, 0.5],
                }}
                transition={{
                    duration: speaking ? 1.1 : 2.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            <motion.button
                type="button"
                className={`voice-orb ${state}`}
                onClick={onToggle}
                whileHover={!connecting ? { scale: 1.035 } : {}}
                whileTap={!connecting ? { scale: 0.97 } : {}}
                aria-label={
                    connecting
                        ? "Connecting to Nexora"
                        : active
                            ? "Stop voice conversation"
                            : "Start voice conversation"
                }
                aria-pressed={active}
                disabled={connecting}
            >
                <motion.img
                    src="/images/nexora-ai-avatar.png"
                    alt="Nexora AI female assistant"
                    className="ai-avatar-image"
                    draggable="false"
                    animate={{
                        scale: speaking
                            ? [1, 1.035, 1]
                            : listening
                                ? [1, 1.015, 1]
                                : 1,
                    }}
                    transition={{
                        duration: speaking ? 1.2 : 2.5,
                        repeat: active ? Infinity : 0,
                        ease: "easeInOut",
                    }}
                />

                <div className="avatar-image-shade" />

                <div className="avatar-scanline" />

                <span className="avatar-status-badge">
                    {connecting ? (
                        <LoaderCircle
                            size={19}
                            className="orb-loading-icon"
                        />
                    ) : speaking ? (
                        <AudioLines size={19} />
                    ) : listening ? (
                        <Mic size={19} />
                    ) : (
                        <MicOff size={19} />
                    )}
                </span>
            </motion.button>

            <motion.div
                className="avatar-sound-wave"
                animate={{
                    opacity: active ? 1 : 0.45,
                    scale: speaking ? [1, 1.08, 1] : 1,
                }}
                transition={{
                    duration: 0.9,
                    repeat: speaking ? Infinity : 0,
                }}
            >
                {Array.from({ length: 9 }, (_, index) => (
                    <motion.span
                        key={index}
                        /*animate={
                            speaking
                                ? {
                                    scaleY: [
                                        0.25,
                                        0.45 + ((index * 7) % 10) / 10,
                                        0.25,
                                    ],
                                }
                                : listening
                                    ? {
                                        scaleY: [
                                            0.2,
                                            0.3 + ((index * 3) % 5) / 10,
                                            0.2,
                                        ],
                                    }
                                    : { scaleY: 0.2 }
                        }
                        
                        transition={{
                            duration: 0.55 + (index % 5) * 0.12,
                            repeat: active ? Infinity : 0,
                            delay: index * 0.035,
                            ease: "easeInOut",
                        }}*/
                        animate={{
                            scale: speaking
                                ? [1, 1.015, 1]
                                : listening
                                    ? [1, 1.008, 1]
                                    : 1,
                        }}
                        transition={{
                            duration: speaking ? 1.6 : 2.8,
                            repeat: active ? Infinity : 0,
                            ease: "easeInOut",
                        }}
                    />
                ))}
            </motion.div>

            <p className="orb-caption">{statusText}</p>
        </div>
    );
}

export default VoiceOrb;