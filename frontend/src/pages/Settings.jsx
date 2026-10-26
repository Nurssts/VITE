import { Button, Field, inputClass, Panel } from "../components/ui";
import { wipeAll } from "../lib/store";

export default function Settings({ prefs, setPrefs, toast, setDb, lang = "en" }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white">Settings & Data</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">Age, storage, right to be forgotten. No dark patterns: decline and delete are visible.</p>

      {/* Event Settings */}
      <Panel className="mb-4 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">Tournament Event</h2>
        <p className="text-sm text-zinc-400">Current: {prefs.event?.eventName || "Not set"} ({prefs.event?.eventCode || "No code"}) - Season {prefs.event?.year || "2027"}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setPrefs({ ...prefs, event: { set: false, year: "", eventCode: "", eventName: "" } });
            toast("Event selection screen will appear on next reload.");
          }}
        >
          Change Event
        </Button>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="text-sm font-semibold">Age Verification</h2>
        <p className="text-sm text-zinc-400">FTC is a youth program. Local profile requires no email. Confirm age or guardian consent.</p>
        <Field label="Display name (optional, no last name)">
          <input className={inputClass()} value={prefs.displayName} onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })} />
        </Field>
        <label className="flex gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" checked={prefs.age.over13} onChange={(e) => setPrefs({ ...prefs, age: { ...prefs.age, over13: e.target.checked } })} />
          I am 13 years of age or older.
        </label>
        <label className="flex gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            checked={prefs.age.guardian}
            onChange={(e) => setPrefs({ ...prefs, age: { ...prefs.age, guardian: e.target.checked } })}
          />
          I am a mentor/parent and consent to use on this device.
        </label>
        <Button
          onClick={() => {
            if (!prefs.age.over13 && !prefs.age.guardian) {
              toast("Age or guardian consent required.", true);
              return;
            }
            setPrefs({ ...prefs, age: { ...prefs.age, confirmed: true, over13: prefs.age.over13, guardian: prefs.age.guardian } });
            toast("Age consent saved locally.");
          }}
        >
          Save Consent
        </Button>
      </Panel>
      <Panel className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold">Storage</h2>
        <p className="text-sm text-zinc-400">Current: {prefs.cookie.storage ? "local storage allowed" : "session only / demo in memory"}.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPrefs({ ...prefs, cookie: { decided: true, storage: false, shownAt: new Date().toISOString() } })}>
            Essential only
          </Button>
          <Button onClick={() => setPrefs({ ...prefs, cookie: { decided: true, storage: true, shownAt: new Date().toISOString() } })}>Allow storage</Button>
        </div>
      </Panel>
      <Panel className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold">Right to be Forgotten</h2>
        <p className="text-sm text-zinc-400">Deletes scouting, demo, age settings, and IndexedDB on this device. No cloud copy — recovery is impossible.</p>
        <Button
          variant="danger"
          onClick={() => {
            if (!confirm("Completely delete profile and scouting data from this device?")) return;
            wipeAll();
            setDb({ version: 2, meta: { demo: false, eventName: "", eventCode: "", season: "2026-2027", updatedAt: new Date().toISOString() }, teams: [], records: [], draft: { captain: "", picked: [], removed: [] } });
            setPrefs({ cookie: { decided: true, storage: false, shownAt: new Date().toISOString() }, age: { confirmed: false, over13: false, guardian: false }, displayName: "", lang: "en", event: { set: false, year: "", eventCode: "", eventName: "" } });
            toast("Data deleted.");
          }}
        >
          Delete profile and all scouting data
        </Button>
      </Panel>
      <Panel className="mt-4 text-sm text-zinc-400">
        Keyboard shortcuts: <kbd className="rounded border border-zinc-700 px-1">1</kbd>–<kbd className="rounded border border-zinc-700 px-1">9</kbd> switch sections,{" "}
        <kbd className="rounded border border-zinc-700 px-1">Esc</kbd> closes dialogs.
      </Panel>
    </div>
  );
}
