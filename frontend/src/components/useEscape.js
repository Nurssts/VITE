import { useEffect } from "react";

/** Close full-screen views (reports) with Escape, unless a dialog is open on top. */
export function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !document.querySelector("[aria-modal='true']")) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}
