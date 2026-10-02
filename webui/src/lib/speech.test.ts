import { describe, expect, it } from 'vitest'

import { speakPhrases, type Speaker } from './speech'

/** Says everything at once, reporting a boundary at each word of each utterance. */
function recorder() {
  const said: string[] = []
  const boundaries: number[] = []
  const speaker: Speaker = {
    supported: true,
    cancel: () => {},
    async speak(text, _rate, _pitch, onBoundary) {
      said.push(text)
      for (const m of text.matchAll(/\S+/g)) onBoundary?.(m.index)
      return 'end'
    },
  }
  return { speaker, said, boundaries }
}

describe('speakPhrases', () => {
  it('breaks at a comma and a space, never inside a number, and counts boundaries whole', async () => {
    const { speaker, said, boundaries } = recorder()
    const text = 'About 1,000 volts, then more.'
    const how = await speakPhrases(speaker, text, 1, 1, 1, () => true, (at) => boundaries.push(at))
    expect(how).toBe('end')
    expect(said).toEqual(['About 1,000 volts,', 'then more.'])
    expect(boundaries.map((at) => text.slice(at).split(' ')[0])).toEqual(['About', '1,000', 'volts,', 'then', 'more.'])
  })

  it('is one utterance with no gap, and stops when no longer live', async () => {
    const one = recorder()
    await speakPhrases(one.speaker, 'a, b', 1, 1, 0, () => true)
    expect(one.said).toEqual(['a, b'])
    const gone = recorder()
    expect(await speakPhrases(gone.speaker, 'a, b', 1, 1, 1, () => gone.said.length === 0)).toBe('cancelled')
    expect(gone.said).toEqual(['a,'])
  })
})
