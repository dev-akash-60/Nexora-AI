import { motion } from "framer-motion";
import { AudioLines, Mic, MicOff, LoaderCircle } from "lucide-react";

function VoiceOrb({ state, onToggle }) {
    const listening = state === "listening";
    const speaking = state === "speaking";
    const connecting = state === "connecting";
    const active = listening || speaking;

    const label = connecting
        ? "Connecting to Nexora"
        : speaking
            ? "Stop conversation"
            : listening
                ? "Stop conversation"
                : "Start voice conversation";

    return (
        <div className={`voice-orb-container ${state}`}>
            <motion.div
                className="orb-ring orb-ring-one"
                animate={{ rotate: 360 }}
                transition={{
                    duration: 18,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            <motion.div
                className="orb-ring orb-ring-two"
                animate={{ rotate: -360 }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            <motion.button
                type="button"
                className={`voice-orb ${state}`}
                onClick={onToggle}
                whileHover={connecting ? undefined : { scale: 1.04 }}
                whileTap={connecting ? undefined : { scale: 0.96 }}
                aria-label={label}
                aria-pressed={active}
                title={label}
                disabled={connecting}
            >
                <div className="orb-inner-glow" />

                <motion.div
                    className="orb-core"
                    animate={{
                        scale: speaking
                            ? [1, 1.12, 1]
                            : listening
                                ? [1, 1.06, 1]
                                : 1,
                    }}
                    transition={{
                        duration: speaking ? 0.8 : 1.6,
                        repeat: active ? Infinity : 0,
                        ease: "easeInOut",
                    }}
                >
                    {connecting ? (
                        <LoaderCircle
                            size={35}
                            strokeWidth={1.5}
                            className="orb-loading-icon"
                        />
                    ) : speaking ? (
                        <AudioLines size={35} strokeWidth={1.5} />
                    ) : listening ? (
                        <Mic size={35} strokeWidth={1.5} />
                    ) : (
                        <MicOff size={35} strokeWidth={1.5} />
                    )}
                </motion.div>
            </motion.button>

            <p className="orb-caption" aria-live="polite">
                {connecting
                    ? "ESTABLISHING CONNECTION"
                    : listening
                        ? "LISTENING TO YOU"
                        : speaking
                            ? "NEXORA IS SPEAKING"
                            : "TAP TO START"}
            </p>
        </div>
    );
}

export default VoiceOrb;