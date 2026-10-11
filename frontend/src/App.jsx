
import { useState } from "react";
import {
  Activity,
  ArrowUp,
  AudioLines,
  BrainCircuit,
  Command,
  Headphones,
  Mic2,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";

import VoiceOrb from "./components/VoiceOrb";
import Waveform from "./components/Waveform";
import ConversationPanel from "./components/ConversationPanel";
import StatusBar from "./components/StatusBar";
import { useVoiceAgent } from "./hooks/useVoiceAgent";

function App() {
  const [prompt, setPrompt] = useState("");

  const {
    status,
    voiceState,
    messages,
    error,
    toggle,
    sendText,
    clearConversation,
  } = useVoiceAgent();

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  function handleSubmit(event) {
    event.preventDefault();

    const text = prompt.trim();

    if (!text || !isConnected) return;

    sendText(text);
    setPrompt("");
  }

  return (
    <main className="nexora-app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <div className="background-grid" />

      <header className="topbar">
        <a className="brand" href="#home">
          <div className="brand-mark">
            <BrainCircuit size={23} strokeWidth={1.7} />
          </div>

          <div className="brand-copy">
            <span className="brand-name">
              nexora<span>ai</span>
            </span>
            <span className="brand-caption">
              PERSONAL INTELLIGENCE
            </span>
          </div>
        </a>

        <div className="topbar-center">
          <span className="topbar-dot" />
          YOUR PERSONAL AI COMPANION
        </div>

        <div className="topbar-right">
          <div className="privacy-chip">
            <ShieldCheck size={14} />
            <span>Private session</span>
          </div>

          <div className="version-chip">BETA</div>
        </div>
      </header>

      <div className="dashboard-shell">
        <section className="hero-section" id="home">
          <div className="hero-eyebrow">
            <span className="eyebrow-icon">
              <Sparkles size={13} />
            </span>
            INTELLIGENCE THAT LISTENS
          </div>

          <h1>
            A more natural way
            <br />
            to <span className="gradient-text">think out loud.</span>
          </h1>

          <p className="hero-description">
            Your ideas, questions, and curiosity.
            One intelligent conversation at a time.
          </p>

          <div className="hero-meta">
            <div className="meta-item">
              <span className="meta-indicator" />
              <span>Gemini Live</span>
            </div>

            <span className="meta-divider" />

            <div className="meta-item">
              <AudioLines size={14} />
              <span>Real-time voice</span>
            </div>

            <span className="meta-divider" />

            <div className="meta-item">
              <Zap size={13} />
              <span>AI-powered</span>
            </div>
          </div>
        </section>

        <section className="workspace">
          <div className="voice-card glass-card">
            <div className="card-topline">
              <div className="section-label">
                <span className="label-orb" />
                VOICE INTERFACE
              </div>

              <div className={`connection-pill ${status}`}>
                <span className="connection-dot" />
                <StatusBar status={status} />
              </div>
            </div>

            <div className="orb-stage">
              <div className="orb-backdrop orb-backdrop-one" />
              <div className="orb-backdrop orb-backdrop-two" />

              <div className="orb-caption orb-caption-left">
                <span className="caption-line" />
                <span>NEURAL CORE</span>
              </div>

              <div className="orb-caption orb-caption-right">
                <span>LIVE AUDIO</span>
                <span className="caption-line" />
              </div>

              <div className="orb-wrapper">
                <VoiceOrb
                  state={voiceState}
                  onToggle={toggle}
                />
              </div>

              <div className="orb-bottom-glow" />
            </div>

            <div className="voice-state">
              <div className={`state-indicator ${voiceState}`}>
                {isConnecting ? (
                  <span className="state-spinner" />
                ) : (
                  <span className="state-pulse" />
                )}
              </div>

              <h2>
                {voiceState === "speaking"
                  ? "I'm speaking"
                  : voiceState === "listening"
                    ? "I'm listening"
                    : voiceState === "connecting"
                      ? "Connecting to Nexora"
                      : "Ready when you are"}
              </h2>

              <p>
                {voiceState === "speaking"
                  ? "Listen closely. Your response is on its way."
                  : voiceState === "listening"
                    ? "Go ahead. I'm paying attention."
                    : voiceState === "connecting"
                      ? "Establishing your live AI session..."
                      : "Start a voice session and let's talk."}
              </p>
            </div>

            <div className="waveform-panel">
              <div className="waveform-label">
                <span>VOICE ACTIVITY</span>
                <span className="waveform-live">
                  {isConnected ? "LIVE" : "STANDBY"}
                </span>
              </div>

              <div className={`waveform-container ${voiceState}`}>
                <Waveform />
              </div>
            </div>

            <button
              type="button"
              className={`voice-action ${isConnected ? "is-active" : ""}`}
              onClick={toggle}
              disabled={isConnecting}
            >
              <span className="voice-action-icon">
                <Mic2 size={17} />
              </span>

              <span>
                {isConnecting
                  ? "Connecting..."
                  : isConnected
                    ? "End conversation"
                    : "Start conversation"}
              </span>

              <span className="voice-action-arrow">
                <ArrowUp
                  size={16}
                  className={isConnected ? "rotate-arrow" : ""}
                />
              </span>
            </button>

            <div className="voice-card-footer">
              <span>
                <Headphones size={13} />
                Headphones recommended
              </span>

              <span className="footer-shortcut">
                <Command size={12} />
                LIVE MODE
              </span>
            </div>
          </div>

          <div className="conversation-column">
            <div className="conversation-heading">
              <div>
                <div className="section-label">
                  <span className="label-orb violet" />
                  YOUR SPACE
                </div>

                <h2>Conversation</h2>

                <p>
                  Your thoughts meet intelligent responses.
                </p>
              </div>

              <div className="conversation-icon">
                <WandSparkles size={19} />
              </div>
            </div>

            <div className="conversation-card glass-card">
              <div className="conversation-card-top">
                <div className="conversation-live-indicator">
                  <span />
                  SESSION TRANSCRIPT
                </div>

                <div className="transcript-count">
                  {messages.length.toString().padStart(2, "0")}
                  <span> messages</span>
                </div>
              </div>

              <div className="conversation-content">
                <ConversationPanel
                  messages={messages}
                  onClear={clearConversation}
                />
              </div>

              {error && (
                <div className="error-banner" role="alert">
                  <Activity size={15} />
                  <span>{error}</span>
                </div>
              )}

              <div className="composer-area">
                <div className="composer-hint">
                  <Sparkles size={13} />
                  ASK NEXORA ANYTHING
                </div>

                <form
                  className="message-composer"
                  onSubmit={handleSubmit}
                >
                  <input
                    type="text"
                    value={prompt}
                    onChange={(event) =>
                      setPrompt(event.target.value)
                    }
                    placeholder={
                      isConnected
                        ? "Type a message..."
                        : "Start a voice session to chat..."
                    }
                    aria-label="Message Nexora AI"
                    disabled={!isConnected}
                  />

                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={!isConnected || !prompt.trim()}
                  >
                    <ArrowUp size={18} />
                  </button>
                </form>

                <div className="composer-footer">
                  <span>
                    <span className="keyboard-key">↵</span>
                    Send message
                  </span>

                  <span>POWERED BY GEMINI LIVE</span>
                </div>
              </div>
            </div>

            <div className="capability-grid">
              <div className="capability-card">
                <div className="capability-icon cyan">
                  <AudioLines size={17} />
                </div>
                <div>
                  <h3>Natural voice</h3>
                  <p>Speak without typing</p>
                </div>
                <span className="capability-status" />
              </div>

              <div className="capability-card">
                <div className="capability-icon violet">
                  <BrainCircuit size={17} />
                </div>
                <div>
                  <h3>Smart responses</h3>
                  <p>Built for conversation</p>
                </div>
                <span className="capability-status" />
              </div>
            </div>
          </div>
        </section>

        <footer className="app-footer">
          <div className="footer-brand">
            <div className="footer-brand-icon">
              <BrainCircuit size={15} />
            </div>
            <span>NEXORA AI</span>
            <span className="footer-copyright">
              © {new Date().getFullYear()}
            </span>
          </div>

          <p>
            Designed for curiosity. Built for conversation.
          </p>

          <div className="footer-system-status">
            <span className="system-status-dot" />
            SYSTEM {isConnected ? "ONLINE" : "STANDBY"}
          </div>
        </footer>
      </div>
    </main>
  );
}

export default App;
