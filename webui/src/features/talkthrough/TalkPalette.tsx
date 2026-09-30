/**
 * The talkthrough's controls. `talkthrough_01.md` §6.1.
 *
 * Mounted once in `App`, beside the tabs rather than inside one, so it survives `F2` — the Ask
 * tab is not kept mounted, and a palette that lived there would vanish the moment it had done
 * its job of switching to the drawing. It floats top-right by default, because both bottom
 * corners of the sheet already hold cards, and it can be dragged anywhere by its title bar.
 *
 * **The caption is plain text, never `Markdown`.** Its identifiers must not be buttons: a click
 * on one would start a second selection competing with the one the talk is making.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  ChevronLeft, ChevronRight, GripVertical, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2,
  VolumeX, X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isTextField } from '@/lib/keys'
import { listVoices, onVoicesChanged } from '@/lib/speech'
import { useDraggable } from '@/lib/useDraggable'
import { cn } from '@/lib/utils'
import { isPlaying, useTalkStore, voiceSupported, type Dwell } from './talkStore'

const DWELLS: { value: Dwell; label: string }[] = [
  { value: 0, label: 'off' },
  { value: 2000, label: '2 s' },
  { value: 4000, label: '4 s' },
  { value: 'press', label: 'until I press ▶' },
]

export function TalkPalette() {
  const phase = useTalkStore((s) => s.phase)
  if (phase === 'idle') return null
  return <Palette />
}

function Palette() {
  const state = useTalkStore()
  const { talk, pos, phase, dwell, rate, muted, palette, shown, voice, pitch, questionFirst, showSay, flow } = state
  const voices = useVoices()
  const { ref, style, handleProps, dragging } = useDraggable<HTMLDivElement>(palette, state.setPalette)
  const opened = useRef(false)

  // Focus lands in the palette when it opens, so its keys work without a first click.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    ref.current?.focus()
  }, [ref])

  // **Escape ends the talk from anywhere**, and only the talk: capture phase plus
  // `preventDefault`, so the Drawing tab's own Escape — which honours `defaultPrevented` — does
  // not also clear the selection the talk has just left the reader on.
  const exit = state.exit
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const inside = ref.current?.contains(event.target as Node)
      if (isTextField(event.target) && !inside) return // the composer's Escape is its own
      event.preventDefault()
      exit()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [exit, ref])

  if (!talk) return null
  const sentence = talk.sentences[pos.s]
  const playing = isPlaying(phase)
  const itemAt = talk.items.filter((i) => i.s < pos.s || (i.s === pos.s && i.g <= pos.g)).length
  const held = phase === 'paused' && dwell === 'press' && shown

  const toggle = () => (playing ? state.pause() : state.play())

  // Keys belong to the palette only while focus is in it, and never reach the sheet (trap T6).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A slider, a checkbox or the voice menu keeps its own keys.
    const tag = (event.target as HTMLElement).tagName
    const action =
      tag === 'INPUT' || tag === 'SELECT' ? undefined
      : event.key === ' ' ? toggle
      : event.key === 'ArrowLeft' ? (event.shiftKey ? state.prevItem : state.prevSentence)
      : event.key === 'ArrowRight' ? (event.shiftKey ? state.nextItem : state.nextSentence)
      : undefined
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    action()
  }
  // A focused button would otherwise also click on the Space that was just handled.
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ') event.preventDefault()
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Talkthrough"
      tabIndex={-1}
      style={style}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className="fixed z-50 w-[340px] rounded-lg border bg-card text-sm shadow-lg outline-none"
    >
      <div
        {...handleProps}
        data-testid="talk-handle"
        title="Drag to move · double-click to put it back"
        className={cn(
          'flex items-center gap-1 border-b px-2 py-1 select-none touch-none',
          dragging ? 'cursor-grabbing' : 'cursor-move',
        )}
      >
        <GripVertical className="size-3.5 text-muted-foreground" />
        <span className="flex-1 text-xs font-semibold">Talk me through it</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Speak aloud' : 'Captions only'}
          onClick={() => state.setMuted(!muted)}
        >
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="size-6" aria-label="End the talkthrough"
          title="End (Esc) — the last item stays selected" onClick={state.exit}>
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="space-y-2 px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          {sentence.block === 'q' && 'Question · '}
          Sentence {pos.s + 1} of {talk.sentences.length}
          {state.partial && ' (selection)'}
          {talk.items.length > 0 && ` · item ${itemAt} of ${talk.items.length}`}
        </p>
        <p className="min-h-10 leading-snug" data-testid="talk-caption">
          {sentence.segments.map((segment, g) =>
            g === pos.g && segment.link ? (
              <span key={g}>
                <strong>{segment.link}</strong>
                {segment.show.slice(segment.link.length)}
              </span>
            ) : (
              <span key={g}>{segment.show}</span>
            ),
          )}
        </p>
        {showSay && (
          <p className="text-[11px] leading-snug text-muted-foreground italic" data-testid="talk-say">
            {sentence.segments.map((segment, g) =>
              g === pos.g ? <strong key={g}>{segment.say} </strong> : <span key={g}>{segment.say} </span>,
            )}
          </p>
        )}
        {phase === 'dwelling' && typeof dwell === 'number' && dwell > 0 && (
          <DwellBar key={`${pos.s}:${pos.g}`} ms={dwell} />
        )}
        {held && (
          <Button size="sm" className="h-7 w-full" onClick={state.play}>
            <Play className="size-3" /> Continue
          </Button>
        )}
        {phase === 'done' && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>End of the answer</span>
            <Button variant="outline" size="sm" className="h-6 px-2" onClick={state.play}>
              <RotateCcw className="size-3" /> From the start
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Control label="Previous item (Shift+←)" onClick={state.prevItem} disabled={!talk.items.length}>
            <SkipBack className="size-3.5" />
          </Control>
          <Control label="Previous sentence (←)" onClick={state.prevSentence}>
            <ChevronLeft className="size-3.5" />
          </Control>
          <Control label={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={toggle}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Control>
          <Control label="Next sentence (→)" onClick={state.nextSentence}>
            <ChevronRight className="size-3.5" />
          </Control>
          <Control label="Next item (Shift+→)" onClick={state.nextItem} disabled={!talk.items.length}>
            <SkipForward className="size-3.5" />
          </Control>
        </div>

        <div className="text-xs">
          <span className="text-muted-foreground">Pause at each item:</span>
          <div className="mt-1 flex overflow-hidden rounded-md border" role="radiogroup" aria-label="Pause at each item">
            {DWELLS.map(({ value, label }) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={dwell === value}
                onClick={() => state.setDwell(value)}
                className={cn(
                  'flex-1 border-r px-1.5 py-0.5 last:border-r-0',
                  dwell === value ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Speed:</span>
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.1}
            value={rate}
            aria-label="Speed"
            onChange={(event) => state.setRate(Number(event.target.value))}
            className="flex-1"
          />
          <span className="w-8 tabular-nums">{rate.toFixed(1)}×</span>
        </label>

        {voiceSupported() && (
          <>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Pitch:</span>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.1}
                value={pitch}
                aria-label="Pitch"
                onChange={(event) => state.setPitch(Number(event.target.value))}
                className="flex-1"
              />
              <span className="w-8 tabular-nums">{pitch.toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Voice:</span>
              <select
                aria-label="Voice"
                value={voice ?? ''}
                onChange={(event) => state.setVoice(event.target.value || null)}
                className="min-w-0 flex-1 rounded border bg-card px-1 py-0.5"
              >
                <option value="">Automatic</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={questionFirst}
              onChange={(event) => state.setQuestionFirst(event.target.checked)}
            />
            Read the question first
          </label>
          <label className="flex items-center gap-1" title="Show how each identifier is pronounced">
            <input type="checkbox" checked={showSay} onChange={(event) => state.setShowSay(event.target.checked)} />
            Show spoken text
          </label>
        </div>
        <label
          className="flex items-center gap-1 text-xs"
          title="Speak each sentence in one breath, lighting each item as it is named. Untick for the item-by-item way. Pausing at each item always goes item by item."
        >
          <input type="checkbox" checked={flow} onChange={(event) => state.setFlow(event.target.checked)} />
          Natural flow
        </label>

        {!voiceSupported() && (
          <p className="text-[11px] text-muted-foreground">
            Voice not available in this browser — captions only.
          </p>
        )}
      </div>
    </div>
  )
}

/** The browser's voices, re-read whenever the list changes (it arrives late in most browsers). */
function useVoices() {
  const [voices, setVoices] = useState(listVoices)
  useEffect(() => onVoicesChanged(() => setVoices(listVoices())), [])
  return voices
}

function Control({ label, onClick, disabled, children }: {
  label: string; onClick: () => void; disabled?: boolean; children: ReactNode
}) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  )
}

/** Why it has stopped: a thin bar that fills over the dwell. */
function DwellBar({ ms }: { ms: number }) {
  const [full, setFull] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFull(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div className="h-0.5 overflow-hidden rounded bg-muted" role="progressbar" aria-label="Pausing at this item">
      <div
        className="h-full bg-primary"
        style={{ width: full ? '100%' : '0%', transition: `width ${ms}ms linear` }}
      />
    </div>
  )
}
