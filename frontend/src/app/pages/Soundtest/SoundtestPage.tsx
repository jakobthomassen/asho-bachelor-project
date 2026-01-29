import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type Theme = "light" | "dark";

export default function SoundTestPage() {
  const navigate = useNavigate();

  const [theme, setTheme] = useState<Theme>("light");
  const [nextTheme, setNextTheme] = useState<Theme | null>(null);
  const [nextOpacity, setNextOpacity] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const endTimerRef = useRef<number | null>(null);

  const transitionMs = 1300;
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

  const themeToUrl = (t: Theme) =>
    t === "light" ? "/src/assets/sound-light.png" : "/src/assets/sound-dark.png";

  const currentBgUrl = useMemo(() => themeToUrl(theme), [theme]);
  const nextBgUrl = useMemo(() => (nextTheme ? themeToUrl(nextTheme) : null), [nextTheme]);

  const pageText = theme === "light" ? "#0f172a" : "#e2e8f0";
  const mutedText = theme === "light" ? "#475569" : "#94a3b8";
  const cardBg = theme === "light" ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.75)";
  const cardBorder = theme === "light" ? "#e5e7eb" : "rgba(148,163,184,0.25)";
  const chipBg = theme === "light" ? "rgba(255,255,255,0.8)" : "rgba(15,23,42,0.6)";
  const chipBorder = theme === "light" ? "#d1d5db" : "rgba(148,163,184,0.25)";

  const switchTheme = (t: Theme) => {
    if (t === theme) return;
    if (isTransitioning) return;

    setIsTransitioning(true);
    setNextTheme(t);
    setNextOpacity(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setNextOpacity(1);
      });
    });

    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = window.setTimeout(() => {
      setTheme(t);
      setNextTheme(null);
      setNextOpacity(0);
      setIsTransitioning(false);
      endTimerRef.current = null;
    }, transitionMs);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        color: pageText,
        padding: "2rem",
        display: "flex",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        transition: `color ${transitionMs}ms ${easing}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${currentBgUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
          filter: "blur(20px)",
          transform: "scale(1.12)",
          zIndex: 0,
        }}
      />

      {nextBgUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${nextBgUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "cover",
            filter: "blur(20px)",
            transform: "scale(1.12)",
            zIndex: 0,
            opacity: nextOpacity,
            transition: `opacity ${transitionMs}ms ${easing}`,
            pointerEvents: "none",
            willChange: "opacity",
          }}
        />
      )}

      <div style={{ width: "min(760px, 100%)", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              marginBottom: 16,
              padding: "0.45rem 0.85rem",
              borderRadius: 999,
              border: `1px solid ${chipBorder}`,
              background: chipBg,
              color: pageText,
              fontWeight: 800,
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              transition: `all ${transitionMs}ms ${easing}`,
            }}
          >
            ← Tilbake til chat
          </button>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => switchTheme("light")}
              disabled={isTransitioning}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 999,
                border: `1px solid ${chipBorder}`,
                background: theme === "light" ? "#0f766e" : chipBg,
                color: theme === "light" ? "#ffffff" : pageText,
                fontWeight: 800,
                cursor: isTransitioning ? "not-allowed" : "pointer",
                opacity: isTransitioning ? 0.85 : 1,
                backdropFilter: "blur(6px)",
                transition: `all ${transitionMs}ms ${easing}`,
              }}
            >
              Lyst
            </button>

            <button
              onClick={() => switchTheme("dark")}
              disabled={isTransitioning}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 999,
                border: `1px solid ${chipBorder}`,
                background: theme === "dark" ? "#0f766e" : chipBg,
                color: theme === "dark" ? "#ffffff" : pageText,
                fontWeight: 800,
                cursor: isTransitioning ? "not-allowed" : "pointer",
                opacity: isTransitioning ? 0.85 : 1,
                backdropFilter: "blur(6px)",
                transition: `all ${transitionMs}ms ${easing}`,
              }}
            >
              Mørk
            </button>
          </div>
        </div>

        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: 16,
            padding: 20,
            boxShadow:
              theme === "light"
                ? "0 18px 40px rgba(15,23,42,0.08)"
                : "0 18px 50px rgba(0,0,0,0.35)",
            transition: `all ${transitionMs}ms ${easing}`,
          }}
        >
          <h1 style={{ fontWeight: 900, fontSize: "1.8rem" }}>Lydøvelser</h1>

          <p style={{ marginTop: 10, color: mutedText, lineHeight: 1.5, transition: `color ${transitionMs}ms ${easing}` }}>
            Her kan du etter hvert finne guidede pusteøvelser, beroligende lyder og korte lydøkter for å roe ned.
          </p>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <Card title="5-minutters pusteøvelse" subtitle="Kommer" theme={theme} transitionMs={transitionMs} easing={easing} />
            <Card title="Regn & hav-lyder" subtitle="Kommer" theme={theme} transitionMs={transitionMs} easing={easing} />
            <Card title="Test av lydavspilling" subtitle="Kommer" theme={theme} transitionMs={transitionMs} easing={easing} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  theme,
  transitionMs,
  easing,
}: {
  title: string;
  subtitle: string;
  theme: "light" | "dark";
  transitionMs: number;
  easing: string;
}) {
  const surfaceBg = theme === "light" ? "rgba(248,250,252,0.85)" : "rgba(2,6,23,0.6)";
  const surfaceBorder = theme === "light" ? "#e5e7eb" : "rgba(148,163,184,0.22)";
  const titleColor = theme === "light" ? "#0f172a" : "#e2e8f0";
  const subColor = theme === "light" ? "#64748b" : "#94a3b8";

  return (
    <div
      style={{
        padding: 14,
        border: `1px solid ${surfaceBorder}`,
        borderRadius: 14,
        background: surfaceBg,
        display: "flex",
        justifyContent: "space-between",
        fontWeight: 800,
        transition: `all ${transitionMs}ms ${easing}`,
      }}
    >
      <span style={{ color: titleColor, transition: `color ${transitionMs}ms ${easing}` }}>{title}</span>
      <span style={{ color: subColor, transition: `color ${transitionMs}ms ${easing}` }}>{subtitle}</span>
    </div>
  );
}
