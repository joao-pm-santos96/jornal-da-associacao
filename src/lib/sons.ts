const MUTE_KEY = "jornal:som";

export const SOUND_EVENT = "jornal:som";

type Note = { freq: number; at: number; dur: number; wave?: OscillatorType; gain?: number; slide?: number; vibrato?: number };

const NOTE = { C4: 262, E4: 330, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, D6: 1175, E6: 1319, G6: 1568, C7: 2093 };

class Speaker {
  static ctx: AudioContext | null = null;
  static master: GainNode | null = null;

  static get(): { ctx: AudioContext; out: GainNode } | null {
    if (typeof window === "undefined" || !("AudioContext" in window)) return null;
    if (!Speaker.ctx || !Speaker.master) {
      Speaker.ctx = new AudioContext();
      const comp = Speaker.ctx.createDynamicsCompressor();
      Speaker.master = Speaker.ctx.createGain();
      Speaker.master.gain.value = 0.6;
      Speaker.master.connect(comp).connect(Speaker.ctx.destination);
    }
    if (Speaker.ctx.state === "suspended") void Speaker.ctx.resume();
    return { ctx: Speaker.ctx, out: Speaker.master };
  }

  static clear(): void {
    void Speaker.ctx?.close();
    Speaker.ctx = null;
    Speaker.master = null;
  }
}

export function soundOn(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(MUTE_KEY);
    else localStorage.setItem(MUTE_KEY, "off");
  } catch {}
  if (!on) Speaker.clear();
  window.dispatchEvent(new Event(SOUND_EVENT));
}

function play(notes: Note[]): void {
  if (!soundOn()) return;
  const speaker = Speaker.get();
  if (!speaker) return;
  const { ctx, out } = speaker;
  const t0 = ctx.currentTime + 0.01;
  for (const n of notes) {
    const start = t0 + n.at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = n.wave ?? "square";
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.slide) osc.frequency.exponentialRampToValueAtTime(n.slide, start + n.dur);
    if (n.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 9;
      depth.gain.value = n.vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + n.dur + 0.02);
    }
    const peak = n.gain ?? 0.12;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(peak, start + 0.005);
    amp.gain.setValueAtTime(peak, start + Math.max(0.006, n.dur * 0.6));
    amp.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(amp).connect(out);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  }
}

function noise(dur: number, freq: number, gain: number, opts: { at?: number; sweepTo?: number; type?: BiquadFilterType } = {}): void {
  if (!soundOn()) return;
  const speaker = Speaker.get();
  if (!speaker) return;
  const { ctx, out } = speaker;
  const t0 = ctx.currentTime + 0.01 + (opts.at ?? 0);
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let held = 0;
  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 0) held = Math.random() * 2 - 1;
    data[i] = held;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.type ?? "bandpass";
  filter.frequency.setValueAtTime(freq, t0);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(amp).connect(out);
  src.start(t0);
}

const run = (freqs: number[], step: number, dur: number, opts: Partial<Note> = {}, from = 0): Note[] =>
  freqs.map((freq, i) => ({ freq, at: from + i * step, dur, ...opts }));

function coinNotes(count: number, from: number): Note[] {
  return Array.from({ length: count }, (_, i) => [
    { freq: NOTE.G5 + (i % 3) * 40, at: from + i * 0.07, dur: 0.05, gain: 0.08 },
    { freq: NOTE.C6 + (i % 3) * 50, at: from + i * 0.07 + 0.04, dur: 0.12, gain: 0.08 },
  ]).flat();
}

export const sons = {
  unlock: () => {
    if (soundOn()) Speaker.get();
  },
  lever: () => {
    play([
      { freq: 160, at: 0, dur: 0.09, gain: 0.1, slide: 70 },
      { freq: NOTE.C5, at: 0.08, dur: 0.05, gain: 0.05 },
    ]);
    noise(0.05, 2000, 0.15, { at: 0.07 });
  },
  reelTick: (spinning: number) =>
    play([{ freq: 1500 + spinning * 220 + Math.random() * 120, at: 0, dur: 0.018, gain: 0.035, wave: "square" }]),
  reelStop: (reel: number) => {
    play([{ freq: 330 - reel * 40, at: 0, dur: 0.1, gain: 0.14, slide: 110, wave: "square" }]);
    noise(0.04, 1200, 0.2);
  },
  coin: () => play([{ freq: NOTE.G5, at: 0, dur: 0.07 }, { freq: NOTE.C6, at: 0.07, dur: 0.3, vibrato: 6 }]),
  win: (multiple = 2) =>
    play([
      ...run([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.07, 0.09),
      { freq: NOTE.E6, at: 0.28, dur: 0.3, vibrato: 8 },
      ...run([NOTE.C4, NOTE.G4, NOTE.C5], 0.14, 0.12, { wave: "triangle", gain: 0.18 }),
      ...coinNotes(Math.min(Math.max(multiple, 2), 12), 0.5),
    ]),
  jackpot: () =>
    play([
      ...run([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6], 0.06, 0.08),
      ...run([NOTE.C6, NOTE.E6, NOTE.C6, NOTE.E6, NOTE.C6, NOTE.E6, NOTE.C6, NOTE.E6], 0.05, 0.05, { gain: 0.08 }, 0.4),
      ...run([NOTE.G5, NOTE.A5, NOTE.B5], 0.12, 0.11, {}, 0.85),
      { freq: NOTE.C7, at: 1.21, dur: 0.7, vibrato: 14 },
      ...run([NOTE.C4, NOTE.G4, NOTE.C5, NOTE.G4, NOTE.C5], 0.24, 0.2, { wave: "triangle", gain: 0.2 }),
      ...coinNotes(20, 1.9),
    ]),
  lose: () =>
    play([
      { freq: NOTE.B4, at: 0, dur: 0.16 },
      { freq: 466, at: 0.18, dur: 0.16 },
      { freq: 440, at: 0.36, dur: 0.16 },
      { freq: 415, at: 0.54, dur: 0.55, slide: 300, vibrato: 10 },
    ].map((n) => ({ ...n, gain: 0.08 }))),
  tie: () => play([{ freq: NOTE.A4, at: 0, dur: 0.12 }, { freq: NOTE.A4, at: 0.16, dur: 0.12 }, { freq: NOTE.E5, at: 0.32, dur: 0.25 }]),
  scratch: () => noise(0.05, 2500 + Math.random() * 1500, 0.1, { type: "highpass" }),
  buy: () => {
    play(run([NOTE.E5, NOTE.G5, NOTE.E6], 0.05, 0.06, { gain: 0.07 }));
    noise(0.06, 3000, 0.12, { at: 0.12 });
  },
  swoosh: () => {
    noise(0.22, 500, 0.3, { sweepTo: 5000 });
    play([{ freq: 1200, at: 0.18, dur: 0.15, slide: 2400, gain: 0.05 }]);
  },
  countdown: () =>
    play([
      { freq: NOTE.A4, at: 0, dur: 0.15 },
      { freq: NOTE.A4, at: 0.45, dur: 0.15 },
      { freq: NOTE.A4, at: 0.9, dur: 0.15 },
      { freq: NOTE.A5, at: 1.35, dur: 0.4 },
    ]),
  paddle: () => noise(0.04, 700 + Math.random() * 300, 0.07),
  quack: () => {
    for (const at of [0, 0.15]) {
      play([
        { freq: 640, at, dur: 0.12, wave: "sawtooth", gain: 0.08, slide: 360 },
        { freq: 1280, at, dur: 0.1, wave: "square", gain: 0.02, slide: 720 },
      ]);
    }
  },
};

export const COUNTDOWN_MS = 1350;
