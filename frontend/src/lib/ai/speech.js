// Voice input via the browser's Web Speech API (Chrome, Edge, Safari). No extra library.
// Note: Chrome performs recognition on Google's servers; this is disclosed in the Legal page.
import { useEffect, useRef, useState } from "react";
import { getLang } from "../i18n";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export function useSpeech(onText) {
  const [listening, setListening] = useState(false);
  const rec = useRef(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => () => rec.current?.abort?.(), []);

  function toggle() {
    if (!Recognition) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Recognition();
    r.lang = getLang() === "en" ? "en-US" : "ru-RU";
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .slice(e.resultIndex)
        .filter((x) => x.isFinal)
        .map((x) => x[0].transcript)
        .join(" ")
        .trim();
      if (text) cb.current(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  return { supported: Boolean(Recognition), listening, toggle };
}
