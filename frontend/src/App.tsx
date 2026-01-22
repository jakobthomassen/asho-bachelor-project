import { useCallback, useState } from "react";
import AppRoutes from "./routes";
import { useAuth } from "./app/AuthProvider";
import { API_BASE_URL } from "./config";

export default function App() {
  const { userId } = useAuth();
  // REMOVE THIS STATE + pingBackend CALLBACK IF YOU DELETE THE PING-BACKEND UI
  const [backendStatus, setBackendStatus] = useState<
    "idle" | "checking" | "ok" | "error"
  >("idle");

  // REMOVE THIS CALLBACK IF YOU DELETE THE PING-BACKEND UI
  const pingBackend = useCallback(async () => {
    setBackendStatus("checking");
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      setBackendStatus(res.ok ? "ok" : "error");
    } catch {
      setBackendStatus("error");
    }
  }, []);

  return (
    <>
      {/* REMOVE THIS BLOCK TO DELETE THE PING-BACKEND UI */}
      {userId ? (
        <div className="authStatus">
          <span>Innlogget</span>{" "}
          <button
            type="button"
            onClick={pingBackend}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "#2563eb",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            ping backend
          </button>{" "}
          <span>
            {backendStatus === "idle" && "(ikke sjekket)"}
            {backendStatus === "checking" && "(sjekker...)"}
            {backendStatus === "ok" && "(ok)"}
            {backendStatus === "error" && "(feil)"}
          </span>
        </div>
      ) : null}
      {/* END OF PING-BACKEND UI */}
      <AppRoutes />
    </>
  );
}
