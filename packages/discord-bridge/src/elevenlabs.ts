import { sampleRateFromFormat } from "./audio.js";
import { logger } from "./log.js";

const log = logger("eleven");

export interface ElevenHandlers {
  /** Agent speech to play into the VC. `rate` = sample rate of the mono PCM. */
  onAudio(pcmMono: Buffer, rate: number): void;
  /** Agent wants to run a client tool (proxy to itto-mc). */
  onToolCall(name: string, id: string, params: Record<string, unknown>): void;
  /** Agent got interrupted (stop playback, flush). */
  onInterruption(): void;
  /** A user's speech was transcribed (forward to the brain for context + memory). */
  onUserTranscript?(text: string): void;
  onReady?(): void;
  onClose?(): void;
}

/**
 * One live conversation with an ElevenLabs Conversational AI agent over its
 * realtime WebSocket. ElevenLabs does STT + LLM + TTS + turn-taking; we just
 * pump audio in/out and proxy tool calls.
 *
 * Protocol: wss://api.elevenlabs.io/v1/convai/conversation (signed URL for
 * private agents). Audio is base64 PCM inside JSON text frames, both ways.
 */
export class ElevenConversation {
  private ws: WebSocket | null = null;
  private outputRate = 16000; // agent -> us (from init metadata)
  private inputRate = 16000; // us -> agent

  constructor(
    private readonly apiKey: string,
    private readonly agentId: string,
    private readonly handlers: ElevenHandlers,
  ) {}

  /** Sample rate the agent expects our mic audio in (resample to this). */
  get userInputRate(): number {
    return this.inputRate;
  }

  async start(): Promise<void> {
    const signed = await this.getSignedUrl();
    const ws = new WebSocket(signed);
    this.ws = ws;

    ws.addEventListener("open", () => {
      log.info("conversation open");
      this.send({ type: "conversation_initiation_client_data" });
    });
    ws.addEventListener("message", (ev) => this.onMessage(ev.data as string));
    ws.addEventListener("close", () => {
      log.info("conversation closed");
      this.handlers.onClose?.();
    });
    ws.addEventListener("error", (e) => log.error("ws error", (e as ErrorEvent).message ?? e));
  }

  private sentAudioOnce = false;

  /** Send a chunk of user mic audio (mono 16-bit PCM at userInputRate). */
  sendAudio(pcm: Buffer): void {
    if (!this.sentAudioOnce) {
      log.info("→ forwarding mic audio to ElevenLabs");
      this.sentAudioOnce = true;
    }
    this.send({ user_audio_chunk: pcm.toString("base64") });
  }

  /** Push non-interrupting context (live MC events) into the conversation. */
  sendContext(text: string): void {
    this.send({ type: "contextual_update", text });
  }

  /** Return a client tool's result to the agent. */
  sendToolResult(toolCallId: string, result: string, isError = false): void {
    this.send({ type: "client_tool_result", tool_call_id: toolCallId, result, is_error: isError });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  // ── internals ──

  private async getSignedUrl(): Promise<string> {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${this.agentId}`,
      { headers: { "xi-api-key": this.apiKey } },
    );
    if (!res.ok) throw new Error(`get-signed-url ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { signed_url: string };
    return data.signed_url;
  }

  private send(obj: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private onMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "conversation_initiation_metadata": {
        const m = msg.conversation_initiation_metadata_event ?? {};
        this.outputRate = sampleRateFromFormat(m.agent_output_audio_format);
        this.inputRate = sampleRateFromFormat(m.user_input_audio_format);
        log.info(`audio formats: in=${this.inputRate} out=${this.outputRate}`);
        this.handlers.onReady?.();
        break;
      }
      case "audio": {
        const b64 = msg.audio_event?.audio_base_64;
        if (b64) this.handlers.onAudio(Buffer.from(b64, "base64"), this.outputRate);
        break;
      }
      case "client_tool_call": {
        const c = msg.client_tool_call ?? {};
        this.handlers.onToolCall(c.tool_name, c.tool_call_id, c.parameters ?? {});
        break;
      }
      case "interruption":
        this.handlers.onInterruption();
        break;
      case "ping":
        this.send({ type: "pong", event_id: msg.ping_event?.event_id });
        break;
      case "user_transcript": {
        const t = msg.user_transcription_event?.user_transcript;
        log.info("🗣️  user:", t);
        if (t) this.handlers.onUserTranscript?.(String(t));
        break;
      }
      case "agent_response":
        log.info("🤖 itto:", msg.agent_response_event?.agent_response);
        break;
      default:
        break;
    }
  }
}
