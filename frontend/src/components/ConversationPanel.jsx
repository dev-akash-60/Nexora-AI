import { MessageCircle, Trash2 } from "lucide-react";

function ConversationPanel({ messages, onClear }) {
    return (
        <section className="conversation-panel">
            <div className="panel-heading">
                <div>
                    <span className="section-eyebrow">CONVERSATION</span>
                    <h2>Your conversation</h2>
                </div>

                <button
                    className="icon-button"
                    onClick={onClear}
                    aria-label="Clear conversation"
                    title="Clear conversation"
                >
                    <Trash2 size={17} />
                </button>
            </div>

            <div className="conversation-messages">
                {messages.length === 0 ? (
                    <div className="empty-conversation">
                        <MessageCircle size={27} strokeWidth={1.4} />

                        <p>Your conversation starts here.</p>

                        <span>
                            Start a voice session to talk with Nexora.
                        </span>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`message message-${message.role}`}
                        >
                            <span className="message-role">
                                {message.role === "user" ? "YOU" : "NEXORA"}
                            </span>

                            <p>{message.text}</p>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

export default ConversationPanel;