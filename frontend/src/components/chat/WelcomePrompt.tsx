import { useState, useEffect } from "react";
import "./WelcomePrompt.css";

const PROMPTS = [
  "Hva kan jeg hjelpe deg med?",
  "Hva er på hjertet ditt i dag?",
  "Hva ønsker du å snakke om?",
  "Hva tenker du på?",
  "Hvordan kan jeg støtte deg i dag?",
  "Hva har du på hjertet?",
  "Hva ønsker du å utforske?",
];

const ROTATE_INTERVAL_MS = 8000;
const FADE_DURATION_MS = 400;

export default function WelcomePrompt() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % PROMPTS.length);
        setVisible(true);
      }, FADE_DURATION_MS);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <p className={`welcomePrompt ${visible ? "is-visible" : "is-hidden"}`}>
      {PROMPTS[idx]}
    </p>
  );
}
