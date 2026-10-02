/**
 * One voice for anything in this app that talks. `talkthrough_01.md` §5.1.
 *
 * 100% client-side: the browser's own `speechSynthesis`, no server, no API key, nothing leaves
 * the browser. Ported from the voice code the user already runs in `Multi_CIP_Simulator.html`
 * — the same support guard, the same voice preferences, the same cache reset when the voice
 * list arrives late.
 *
 * Two rules the callers rely on:
 *
 * - **`cancel()` settles the pending `speak` as `'cancelled'`, at once.** A caller never waits on
 *   a browser that may or may not fire `end` after a cancel.
 * - **There is no pause.** `speechSynthesis.pause()`/`resume()` are unreliable on Linux Chrome
 *   and Android, so a caller pauses by cancelling and later re-speaks what it was saying. Keep
 *   utterances short enough that repeating one is harmless (some Chrome builds also cut an
 *   utterance off at about fifteen seconds).
 * - **`onBoundary` is optional and additive.** It reports the character offset of each word as the
 *   voice reaches it, so a caller can light what is being said mid-utterance. Not every voice
 *   sends boundaries, so a caller must not depend on them arriving. A cancelled utterance reports
 *   nothing.
 */

export interface Speaker {
  readonly supported: boolean
  /** `pitch` is 0 to 2 and defaults to 1; a timed speaker ignores it. */
  speak(
    text: string, rate: number, pitch?: number, onBoundary?: (charIndex: number) => void,
  ): Promise<'end' | 'cancelled'>
  cancel(): void
}

const speechSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

let voiceCache: SpeechSynthesisVoice | null = null
/** A voice the user chose, by name. Names are what survive a reload; the objects do not. */
let preferred: string | null = null

/** Choose a voice by name, or null to go back to the automatic choice. An absent name falls
 * back silently: voices differ per machine and per browser. */
export function setPreferredVoice(name: string | null) {
  if (name === preferred) return
  preferred = name
  voiceCache = null
}

const english = (v: SpeechSynthesisVoice) => /^en[-_]/i.test(v.lang)

/** Every voice the browser offers, English first. Empty until the list has loaded. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  const voices = window.speechSynthesis.getVoices()
  return [...voices.filter(english), ...voices.filter((v) => !english(v))]
}

/** Called whenever the voice list changes — it arrives asynchronously in most browsers. */
export function onVoicesChanged(listener: () => void): () => void {
  if (!('speechSynthesis' in window)) return () => {}
  window.speechSynthesis.addEventListener?.('voiceschanged', listener)
  return () => window.speechSynthesis.removeEventListener?.('voiceschanged', listener)
}

/** Prefer the natural-sounding English voices common browsers ship, then any `en-*`, then any. */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  if (voiceCache && voices.includes(voiceCache)) return voiceCache
  const chosen = preferred ? voices.find((v) => v.name === preferred) : undefined
  if (chosen) return (voiceCache = chosen)
  const prefer = [
    /Google US English/i,
    /Microsoft (Aria|Jenny|Guy|Michelle|Zira|David)/i,
    /Samantha/i,
    /English \(United States\)/i,
  ]
  for (const re of prefer) {
    const match = voices.find((v) => re.test(v.name) || re.test(v.voiceURI || ''))
    if (match) return (voiceCache = match)
  }
  return (voiceCache = voices.find(english) ?? voices[0])
}

if (speechSupported) {
  // Voice lists load asynchronously in most browsers; reset the cache when they arrive.
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    voiceCache = null
    pickVoice()
  })
  pickVoice()
}

type Start = (
  text: string, rate: number, pitch: number, finish: () => void, boundary: (charIndex: number) => void,
) => () => void

function speaker(start: Start, supported: boolean): Speaker {
  let pending: { settle: (how: 'end' | 'cancelled') => void; stop: () => void } | null = null
  const cancel = () => {
    const current = pending
    pending = null
    current?.stop()
    current?.settle('cancelled')
  }
  return {
    supported,
    cancel,
    speak(text, rate, pitch = 1, onBoundary) {
      cancel()
      // Nothing to say (a link the user made silent): done at once, with no utterance to hang on.
      if (!text.trim()) return Promise.resolve('end')
      return new Promise((resolve) => {
        const mine = {
          settle: resolve,
          stop: () => {},
        }
        pending = mine
        mine.stop = start(text, rate, pitch, () => {
          if (pending !== mine) return // superseded, and already settled as cancelled
          pending = null
          resolve('end')
        }, (charIndex) => {
          if (pending === mine) onBoundary?.(charIndex)
        })
      })
    },
  }
}

/** The browser's voice. `supported` is false where there is none (jsdom, some kiosks). */
export const webSpeaker: Speaker = speaker((text, rate, pitch, finish, boundary) => {
  if (!speechSupported) {
    finish()
    return () => {}
  }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) {
    u.voice = voice
    u.lang = voice.lang
  }
  u.rate = rate
  u.pitch = pitch
  u.onend = finish
  u.onboundary = (event) => {
    if (event.name === 'word') boundary(event.charIndex)
  }
  u.onerror = finish // an interrupted utterance must not hang the caller
  window.speechSynthesis.speak(u)
  return () => window.speechSynthesis.cancel()
}, speechSupported)

/**
 * No audio at all: resolves after the time it would take to read `text` at `wpm` words a minute
 * (scaled by `rate`), so captions advance at reading pace when muted or voiceless. Each word's
 * boundary is reported at its share of that time, as a voice would.
 */
export function timedSpeaker(wpm = 170): Speaker {
  return speaker((text, rate, _pitch, finish, boundary) => {
    const starts = [...text.matchAll(/\S+/g)].map((m) => m.index)
    const duration = Math.max(600, (starts.length / (wpm * rate)) * 60_000)
    const timers = starts.map((at, k) => setTimeout(() => boundary(at), (k / starts.length) * duration))
    timers.push(setTimeout(finish, duration))
    return () => timers.forEach(clearTimeout)
  }, true)
}

/**
 * Speak `text` with a breath at each comma: one utterance per phrase, `gap` ms apart. The user,
 * 2026-10-01: *"it does not seem to give a slight pause at a comma"* — some voices barely do, so
 * the pause is made here rather than hoped for. Only a comma followed by a space ends a phrase,
 * so `1,000` stays whole. Boundaries are reported against the whole `text`, as one utterance
 * would. `live` is asked after every phrase and gap, so a cancel during the gap says nothing more.
 * A `gap` of 0 is exactly `speaker.speak`.
 */
export async function speakPhrases(
  speaker: Speaker, text: string, rate: number, pitch: number, gap: number,
  live: () => boolean, onBoundary?: (charIndex: number) => void,
): Promise<'end' | 'cancelled'> {
  if (gap <= 0) return speaker.speak(text, rate, pitch, onBoundary)
  const starts = [0, ...[...text.matchAll(/,\s+(?=\S)/g)].map((m) => m.index + m[0].length)]
  for (let k = 0; k < starts.length; k++) {
    if (k > 0) {
      await new Promise((resolve) => setTimeout(resolve, gap))
      if (!live()) return 'cancelled'
    }
    const from = starts[k]
    const piece = text.slice(from, starts[k + 1] ?? text.length).trimEnd()
    const how = await speaker.speak(piece, rate, pitch, (at) => onBoundary?.(from + at))
    if (how === 'cancelled' || !live()) return 'cancelled'
  }
  return 'end'
}
