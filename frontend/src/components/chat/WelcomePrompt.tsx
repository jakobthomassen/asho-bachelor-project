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

const ROTATE_INTERVAL_MS = 6000;
const FADE_DURATION_MS = 400;

export default function WelcomePrompt() {
  const [idx, setIdx] = useState(() =>
    Math.floor(Math.random() * PROMPTS.length),
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => {
          let next = i;
          while (next === i) next = Math.floor(Math.random() * PROMPTS.length);
          return next;
        });
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
