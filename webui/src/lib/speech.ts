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
 */

export interface Speaker {
  readonly supported: boolean
  speak(text: string, rate: number): Promise<'end' | 'cancelled'>
  cancel(): void
}

const speechSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

let voiceCache: SpeechSynthesisVoice | null = null

/** Prefer the natural-sounding English voices common browsers ship, then any `en-*`, then any. */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  if (voiceCache && voices.includes(voiceCache)) return voiceCache
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
  return (voiceCache = voices.find((v) => /^en[-_]/i.test(v.lang)) ?? voices[0])
}

if (speechSupported) {
  // Voice lists load asynchronously in most browsers; reset the cache when they arrive.
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    voiceCache = null
    pickVoice()
  })
  pickVoice()
}

function speaker(start: (text: string, rate: number, finish: () => void) => () => void, supported: boolean): Speaker {
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
    speak(text, rate) {
      cancel()
      return new Promise((resolve) => {
        const mine = {
          settle: resolve,
          stop: () => {},
        }
        pending = mine
        mine.stop = start(text, rate, () => {
          if (pending !== mine) return // superseded, and already settled as cancelled
          pending = null
          resolve('end')
        })
      })
    },
  }
}

/** The browser's voice. `supported` is false where there is none (jsdom, some kiosks). */
export const webSpeaker: Speaker = speaker((text, rate, finish) => {
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
  u.onend = finish
  u.onerror = finish // an interrupted utterance must not hang the caller
  window.speechSynthesis.speak(u)
  return () => window.speechSynthesis.cancel()
}, speechSupported)

/**
 * No audio at all: resolves after the time it would take to read `text` at `wpm` words a minute
 * (scaled by `rate`), so captions advance at reading pace when muted or voiceless.
 */
export function timedSpeaker(wpm = 170): Speaker {
  return speaker((text, rate, finish) => {
    const words = text.split(/\s+/).filter(Boolean).length
    const timer = setTimeout(finish, Math.max(600, (words / (wpm * rate)) * 60_000))
    return () => clearTimeout(timer)
  }, true)
}
