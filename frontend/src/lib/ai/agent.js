// The Strategist agent loop. The server is a stateless gateway to the model; the loop,
// the tools and the approvals live here, next to the user's data.
//
//   user message -> model turn (streamed) -> tool calls?
//        read/assist tools run immediately, action tools wait for the user's approval
//        -> tool results appended -> next model turn ... until the model answers.
import { streamChat } from "./client";
import { ToolError } from "./tools";

export const MAX_STEPS = 8;
const MAX_MESSAGES = 70;

/** Keep the conversation within the server limits without splitting a tool call from its result. */
export function trimHistory(messages, max = MAX_MESSAGES) {
  if (messages.length <= max) return messages;
  for (let i = messages.length - max; i < messages.length; i++) {
    if (messages[i].role === "user") return messages.slice(i);
  }
  return messages.slice(-1);
}

/** Strip UI-only fields before sending. */
export function wireMessages(messages) {
  return trimHistory(messages).map((m) =>
    m.role === "user"
      ? { role: "user", text: m.text }
      : m.role === "assistant"
        ? { role: "assistant", text: m.text || "", toolCalls: (m.toolCalls || []).map(({ id, name, args }) => ({ id, name, args })), raw: m.raw || null }
        : { role: "tool", results: m.results.map(({ id, name, content, isError }) => ({ id, name, content, isError: Boolean(isError) })) }
  );
}

/**
 * Run the agent until the model answers without tools.
 * @param {object} o
 * @param {object[]} o.messages     conversation so far (ends with the new user message)
 * @param {(messages: object[]) => void} o.onMessages  called with the updated conversation (live)
 * @param {(e: object) => void} [o.onStatus]  {phase: thinking|tool|confirm|done, tool?, provider?, model?}
 * @param {(call: object) => Promise<boolean>} o.confirm  ask the user to approve an action tool
 * @param {{kind: Function, run: Function}} o.toolbox
 * @param {object} o.request         {context, memory, lang}
 * @param {AbortSignal} [o.signal]
 */
export async function runAgent({ messages, onMessages, onStatus, confirm, toolbox, request, signal, maxSteps = MAX_STEPS }) {
  let convo = [...messages];
  const usage = { input: 0, output: 0 };
  const push = (m) => {
    convo = [...convo, m];
    onMessages(convo);
  };
  const replaceLast = (m) => {
    convo = [...convo.slice(0, -1), m];
    onMessages(convo);
  };

  for (let step = 0; step < maxSteps; step++) {
    onStatus?.({ phase: "thinking", step });
    let assistant = { role: "assistant", text: "", toolCalls: [], raw: null, streaming: true, ts: Date.now() };
    push(assistant);
    let failure = null;
    let stop = "end";
    await streamChat(
      { messages: wireMessages(convo.slice(0, -1)), context: request.context, memory: request.memory, lang: request.lang },
      {
        signal,
        onEvent(e) {
          if (e.type === "start") {
            // provider (re)started — e.g. after a fallback: discard any partial output
            assistant = { ...assistant, text: "", toolCalls: [], provider: e.label || e.provider, model: e.model };
            onStatus?.({ phase: "thinking", step, provider: e.label || e.provider, model: e.model });
          } else if (e.type === "text") assistant = { ...assistant, text: assistant.text + e.delta };
          else if (e.type === "tool_call") assistant = { ...assistant, toolCalls: [...assistant.toolCalls, { id: e.id, name: e.name, args: e.args || {} }] };
          else if (e.type === "done") {
            stop = e.stop;
            usage.input += e.usage?.input || 0;
            usage.output += e.usage?.output || 0;
            assistant = { ...assistant, raw: e.raw || null };
          } else if (e.type === "error") failure = e;
          replaceLast(assistant);
        },
      }
    );
    assistant = { ...assistant, streaming: false, stop };
    replaceLast(assistant);
    if (failure) {
      const err = new Error(failure.message || "AI error");
      err.retryable = failure.retryable;
      throw err;
    }
    if (stop === "refusal") return { messages: convo, usage, stop };
    if (!assistant.toolCalls.length) return { messages: convo, usage, stop };

    const results = [];
    push({ role: "tool", results: [], ts: Date.now() }); // filled live, one tool at a time
    for (const call of assistant.toolCalls) {
      const kind = toolbox.kind(call.name);
      let content;
      let isError = false;
      let status = "done";
      try {
        if (!kind) throw new ToolError(`Unknown tool ${call.name}`);
        if (kind === "action") {
          onStatus?.({ phase: "confirm", tool: call.name, step });
          const ok = await confirm(call);
          if (!ok) {
            status = "declined";
            content = JSON.stringify({ declined: true, message: "The user declined this action. Do not retry it; continue without it." });
          }
        }
        if (status !== "declined") {
          onStatus?.({ phase: "tool", tool: call.name, step });
          content = toolbox.run(call.name, call.args);
        }
      } catch (err) {
        isError = true;
        status = "error";
        content = JSON.stringify({ error: err instanceof ToolError ? err.message : "The tool failed." });
      }
      results.push({ id: call.id, name: call.name, content, isError, status, kind });
      replaceLast({ role: "tool", results: [...results], ts: Date.now() });
    }
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  }
  push({ role: "assistant", text: "", toolCalls: [], raw: null, note: "step-limit", ts: Date.now() });
  return { messages: convo, usage, stop: "step-limit" };
}
