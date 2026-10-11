function Waveform({ active = false }) {
    return (
        <div
            className={`waveform ${active ? "waveform-active" : ""}`}
            aria-label={active ? "Audio activity" : "Audio inactive"}
        >
            {Array.from({ length: 31 }, (_, index) => (
                <span
                    key={index}
                    className="waveform-bar"
                    style={{
                        "--bar-index": index,
                    }}
                />
            ))}
        </div>
    );
}

export default Waveform;