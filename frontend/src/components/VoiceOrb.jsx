import { motion } from "framer-motion";
import { AudioLines, Mic, MicOff } from "lucide-react";

function VoiceOrb({ state, onToggle }) {
    const listening = state === "listening";
    const speaking = state === "speaking";
    const connecting = state === "connecting";

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
                className={`voice-orb ${state}`}
                onClick={onToggle}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                aria-label={
                    listening ? "Stop listening" : "Start voice conversation"
                }
                disabled={connecting}
            >
                <div className="orb-inner-glow" />

                <motion.div
                    className="orb-core"
                    animate={{
                        scale: speaking ? [1, 1.12, 1] : listening ? [1, 1.06, 1] : 1,
                    }}
                    transition={{
                        duration: speaking ? 0.8 : 1.6,
                        repeat: speaking || listening ? Infinity : 0,
                    }}
                >
                    {listening ? (
                        <Mic size={35} strokeWidth={1.5} />
                    ) : speaking ? (
                        <AudioLines size={35} strokeWidth={1.5} />
                    ) : (
                        <MicOff size={35} strokeWidth={1.5} />
                    )}
                </motion.div>
            </motion.button>

            <p className="orb-caption">
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