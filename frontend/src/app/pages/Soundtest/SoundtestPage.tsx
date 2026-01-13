import { useNavigate } from "react-router-dom";

export default function SoundTestPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f9ff",
        color: "#0f172a",
        padding: "2rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "min(760px, 100%)" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            marginBottom: 16,
            padding: "0.45rem 0.85rem",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#0f172a",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ← Tilbake til chat
        </button>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
          }}
        >
          <h1 style={{ fontWeight: 900, fontSize: "1.8rem" }}>
            Lydøvelser
          </h1>

          <p style={{ marginTop: 10, color: "#475569", lineHeight: 1.5 }}>
            Her kan du etter hvert finne guidede pusteøvelser, beroligende lyder og korte
            lydøkter for å roe ned.
          </p>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <Card title="5-minutters pusteøvelse" subtitle="Kommer" />
            <Card title="Regn & hav-lyder" subtitle="Kommer" />
            <Card title="Test av lydavspilling" subtitle="Kommer" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        background: "#f8fafc",
        display: "flex",
        justifyContent: "space-between",
        fontWeight: 800,
      }}
    >
      <span>{title}</span>
      <span style={{ color: "#64748b" }}>{subtitle}</span>
    </div>
  );
}
