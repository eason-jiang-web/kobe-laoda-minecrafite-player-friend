/**
 * Voice outbox — lines the brain (jabby) wants spoken OUT LOUD in the Discord
 * call. jabby pushes via the `speak` MCP tool; the voice bridge drains them over
 * MCP (`drain_speech`) and feeds them to ElevenLabs to voice. Capped so it can't
 * grow unbounded if no voice bridge is connected.
 */
const queue: string[] = [];
const MAX = 20;

export function pushSpeech(text: string): void {
  const t = text.trim();
  if (!t) return;
  queue.push(t);
  while (queue.length > MAX) queue.shift();
}

/** Return all queued lines and clear the queue. */
export function drainSpeech(): string[] {
  return queue.splice(0, queue.length);
}
