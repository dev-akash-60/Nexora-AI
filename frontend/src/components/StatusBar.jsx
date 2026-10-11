import { Wifi, WifiOff, LoaderCircle } from "lucide-react";

function StatusBar({ status }) {
    const connected = status === "connected";
    const connecting = status === "connecting";

    return (
        <div className={`status-bar ${status}`}>
            {connecting ? (
                <LoaderCircle className="status-icon spinning" size={15} />
            ) : connected ? (
                <Wifi className="status-icon" size={15} />
            ) : (
                <WifiOff className="status-icon" size={15} />
            )}

            <span>
                {connecting
                    ? "Connecting to Nexora..."
                    : connected
                        ? "Nexora is connected"
                        : "Nexora is offline"}
            </span>

            <span className="status-dot" />
        </div>
    );
}

export default StatusBar;