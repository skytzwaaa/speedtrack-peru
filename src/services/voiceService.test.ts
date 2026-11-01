import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type VoiceProvider,
  VoiceQueue,
  announceVoice,
  setVoiceFallback,
  setVoiceLanguage,
  stopSpeaking,
} from "./voiceService";
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
afterEach(() => {
  stopSpeaking();
  setVoiceFallback("off");
  setVoiceLanguage("es");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("voice queue", () => {
  it("serializes announcements, prioritizes alerts and survives rejection", async () => {
    const finish: (() => void)[] = [];
    const speak = vi.fn<VoiceProvider["speak"]>(
      () => new Promise<void>((resolve) => finish.push(resolve)),
    );
    const q = new VoiceQueue({ speak, cancel: vi.fn() });
    q.enqueue("start", "es", 1);
    q.enqueue("progress", "es", 1);
    q.enqueue("alert", "es", 1, 10);
    expect(speak).toHaveBeenCalledTimes(1);
    finish.shift()!();
    await flush();
    expect(speak.mock.calls.at(-1)?.[0]).toBe("alert");
    finish.shift()!();
    await flush();
    expect(speak.mock.calls.at(-1)?.[0]).toBe("progress");
    finish.shift()!();
    await flush();
  });
  it("cancellation drops pending speech and late completions cannot consume a new queue", async () => {
    const finish: (() => void)[] = [];
    const speak = vi.fn<VoiceProvider["speak"]>(
      () => new Promise<void>((resolve) => finish.push(resolve)),
    );
    const cancel = vi.fn();
    const q = new VoiceQueue({ speak, cancel });
    q.enqueue("old", "es", 1);
    q.enqueue("discard", "es", 1);
    q.cancel();
    q.enqueue("new", "en", 1);
    q.enqueue("next", "en", 1);
    finish.shift()!();
    await flush();
    expect(speak).toHaveBeenCalledTimes(2);
    finish.shift()!();
    await flush();
    expect(speak.mock.calls.at(-1)?.[0]).toBe("next");
    expect(cancel).toHaveBeenCalledOnce();
    finish.shift()!();
  });
  it("provider failure does not block the next announcement", async () => {
    const speak = vi
      .fn()
      .mockRejectedValueOnce(new Error("device"))
      .mockResolvedValue(undefined);
    const q = new VoiceQueue({ speak, cancel: vi.fn() });
    q.enqueue("failed", "es", 1);
    q.enqueue("next", "es", 1);
    await flush();
    expect(speak).toHaveBeenCalledTimes(2);
  });
  it("fallback translates the message, retains app language and clears cancelled watchdogs", async () => {
    vi.useFakeTimers();
    const speech = {
      getVoices: () => [{ lang: "es-PE" }],
      speak: vi.fn(),
      cancel: vi.fn(),
    };
    vi.stubGlobal("window", { speechSynthesis: speech });
    vi.stubGlobal("speechSynthesis", speech);
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    setVoiceLanguage("qu");
    setVoiceFallback("off");
    announceVoice("startVoice");
    expect(speech.speak).not.toHaveBeenCalled();
    setVoiceFallback("es");
    announceVoice("startVoice");
    expect(speech.speak.mock.calls[0][0]).toMatchObject({
      text: "Actividad iniciada.",
      lang: "es-PE",
    });
    stopSpeaking();
    const cancellations = speech.cancel.mock.calls.length;
    await vi.advanceTimersByTimeAsync(31000);
    expect(speech.cancel).toHaveBeenCalledTimes(cancellations);
  });
});
