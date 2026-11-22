import { Component } from "react";
import { Button } from "./ui";
import { tr } from "../lib/i18n";

// One broken screen (or a chunk that failed to download after a deploy) must not blank the app:
// scouting data is safe in storage, the user can reload or switch sections.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("VITE screen error:", error, info?.componentStack);
    // After a deploy, an old tab asks for chunk files that no longer exist: reload once by itself.
    if (/dynamically imported module|Loading chunk|Failed to fetch/i.test(String(error?.message))) {
      const last = Number(sessionStorage.getItem("vite-chunk-reload") || 0);
      if (Date.now() - last > 30000) {
        sessionStorage.setItem("vite-chunk-reload", String(Date.now()));
        location.reload();
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /dynamically imported module|Loading chunk|Failed to fetch/i.test(String(this.state.error?.message));
    return (
      <div className="rounded-xl border border-zinc-700 p-6" role="alert">
        <h1 className="text-lg font-semibold text-white">{chunk ? tr("Нужно обновить страницу") : tr("Этот раздел не открылся")}</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          {chunk
            ? tr("Вышла новая версия VITE или пропал интернет. Данные скаутинга сохранены на устройстве.")
            : tr("Ошибка в интерфейсе. Данные скаутинга не затронуты — они сохранены на устройстве.")}
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-600">{String(this.state.error?.message || this.state.error).slice(0, 200)}</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => location.reload()}>{tr("Обновить страницу")}</Button>
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            {tr("Попробовать снова")}
          </Button>
        </div>
      </div>
    );
  }
}
