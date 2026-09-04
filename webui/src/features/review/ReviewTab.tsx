/**
 * The Review tab — the extractor's own doubts, with the ink beside them.
 *
 * ### Why this screen exists
 *
 * `geometry.json` has carried a `review_queue` since the sheet was indexed on 2026-08-03: **278
 * items the extraction was not sure of**, each with a box round it and a confidence. Nothing had
 * ever read it. The file even says why there are so many, in its own `text_source` field — *"this
 * PDF has no embedded font text, so every label must be verified with the vision pass"* — so a
 * quarter of the strings on this drawing are OCR of stroked glyph outlines, and 30 of the 70 printed
 * net names came back at confidence 0.4.
 *
 * That is not a cosmetic problem. It is the thing that limits the whole wires-and-nets project:
 * Phase E ranks candidate conductors by comparing a run's printed net name against a wire's net id,
 * and only 17 of 26 nets match a printed conductor group today. Nine of the nine misses are
 * misreads — `LI-A` for `L1-A`, capital I for the digit 1; `TINSP1` for `IINSP1`; `130.` and `OV.`
 * where trailing ink was taken for a full stop. Correcting them is not repairing the index. **It is
 * unlocking the matcher.**
 *
 * ### Its own tab, and not a panel on the Locate tab
 *
 * The Locate tab is already the densest screen in the application — a list, a target panel with
 * sites and pins and two compasses, an advance, a save badge — and this is a different job with a
 * different file behind it. It is also the same decision as the file: two screens writing one
 * document through a whole-file save is how two runs of work discard each other (`H1`).
 *
 * ### The ink is on screen, and that is the point
 *
 * The queue is on the left and the **sheet** is on the right, framed and ringed on the reading you
 * are working on. Correcting a transcription by reading the transcription is how a misread becomes
 * a *confirmed* misread; the only thing worth reading is the paper. Focusing a row's box is what
 * flies the sheet, so looking at a row and looking at its ink are one act rather than two.
 *
 * ### What this screen may not do
 *
 * It does not touch the netlist. `author_circuit_logic.py` does not read `label_corrections.json`
 * and a server test asserts its output is byte-identical with and without one — because the netlist
 * is already right (26 nets, 131 terminals, no twins; `L1-A` and `L1-A1` are two real nets with a
 * breaker between them) and what is wrong is a layer below it, in strings that never became
 * entities.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Ban,
  Check,
  Lock,
  Map,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Save,
  ScanText,
} from 'lucide-react'

import type { ReviewItem, StoredCorrection } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useReviewStore } from '@/stores/reviewStore'
import { REVIEW_TAB_ID } from '@/tabIds'
import { pointToCss, polylineToDevice } from '@/features/drawing/paint'
import { TileSheet } from '@/features/drawing/TileSheet'
import { useTileViewport } from '@/features/drawing/useTileViewport'
import {
  ROW_LABEL,
  SCOPES,
  correctionOf,
  filterItems,
  labelKind,
  orderItems,
  progress,
  rowState,
  setCorrection,
  setNote,
  type Scope,
} from './model'

export { REVIEW_TAB_ID }

/** The tone each row state is drawn in. Corrected and confirmed are both *somebody looked*, which
 * is what the queue is counting, so they share the colour and differ in the word. */
const TONE: Record<ReturnType<typeof rowState>, string> = {
  corrected: 'text-[var(--color-success)]',
  confirmed: 'text-[var(--color-success)]',
  rejected: 'text-muted-foreground',
  blank: 'text-[var(--color-warning)]',
  doubted: 'text-[var(--color-warning)]',
  read: 'text-muted-foreground',
}

export function ReviewTab() {
  const drawing = useAppStore((s) => s.drawing)
  const health = useAppStore((s) => s.health)
  const activeTabId = useAppStore((s) => s.activeTabId)

  const {
    document,
    items,
    counts,
    report,
    unlocked,
    loading,
    error,
    currentId,
    saveState,
    saveError,
    load,
    setCurrent,
    edit,
    save,
  } = useReviewStore()

  const tiles = drawing?.tiles ?? null
  const [width, height] = tiles?.page_size_pt ?? [1, 1]
  const viewer = useTileViewport({ width, height, dpi: tiles?.dpi ?? 400 })

  const [scope, setScope] = useState<Scope>('flagged')
  const [netNames, setNetNames] = useState(false)

  const needsPassword = health?.editing?.password_required ?? false
  const ready = Boolean(document)

  /** Load once, and only once the door is open — the same rule as the Locate tab. */
  useEffect(() => {
    if (ready || loading) return
    if (needsPassword && !unlocked) return
    void load(drawing?.drawing_number ?? null)
  }, [ready, loading, needsPassword, unlocked, load, drawing?.drawing_number])

  /**
   * Nothing is fetched until the tab has been opened once.
   *
   * `keepMounted` for the same reason the other two are — a half-finished review must survive a trip
   * to Ask to read something — which means this component exists from the first paint and would
   * otherwise pull 2.2 MB of rasters for somebody who never opens it.
   */
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (activeTabId === REVIEW_TAB_ID) setArmed(true)
  }, [activeTabId])

  const [settled, setSettled] = useState<Record<string, boolean>>({})
  const onTileSettled = useCallback(
    (file: string, ok: boolean) => setSettled((current) => ({ ...current, [file]: ok })),
    [],
  )

  const ordered = useMemo(() => orderItems(items), [items])
  const visible = useMemo(() => filterItems(ordered, scope, netNames), [ordered, scope, netNames])
  const done = useMemo(() => progress(visible), [visible])
  const current = useMemo(
    () => visible.find((item) => item.id === currentId) ?? null,
    [visible, currentId],
  )

  /**
   * Fly to the ink of the reading being worked on.
   *
   * Keyed on the id rather than on a nonce, because unlike a citation this is never *asked for
   * twice*: focusing a row that is already current is what happens when you click back into a box
   * you were already typing in, and moving the sheet then would be moving it under somebody's hand.
   * `ready` is in the deps for the same reason as on the Drawing tab — the container has no size
   * until this tab has been shown once, and the flight has to wait for one.
   */
  const panTo = useRef(viewer.panTo)
  panTo.current = viewer.panTo
  const rect = current?.rect ?? null
  const rectRef = useRef(rect)
  rectRef.current = rect
  const measured = armed && viewer.viewport.scale > 0

  useEffect(() => {
    const target = rectRef.current
    if (!measured || !target) return
    panTo.current(target)
  }, [measured, currentId])

  const stamp = useCallback(
    () => ({ by: health?.editing?.by ?? undefined, at: new Date().toISOString() }),
    [health?.editing?.by],
  )

  /** One reading decided: a string, `null` for *not a label*, or `undefined` for *Reset*. */
  const decide = useCallback(
    (item: ReviewItem, text: string | null | undefined) =>
      edit((d) => setCorrection(d, item, text, stamp())),
    [edit, stamp],
  )

  /** A note *beside* a decision. Never a decision of its own — `setNote` refuses a row nobody has
   * decided about rather than inventing the `text` the file requires. */
  const annotate = useCallback(
    (item: ReviewItem, note: string) => edit((d) => setNote(d, item, note)),
    [edit],
  )

  if (!tiles) return null

  /**
   * The gate goes over a laid-out screen rather than instead of one.
   *
   * `useTileViewport` attaches its `ResizeObserver` in an effect that runs once, so a container
   * rendered later than the hook is a container that is never measured — the sheet would sit at
   * `scale: 0` with no error anywhere. The Locate tab learned this the same way.
   */
  const blocked = needsPassword && !unlocked ? 'locked' : document ? null : 'loading'

  const total = tiles.tiles.length
  const loaded = Object.keys(settled).length

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <ScanText className="size-3.5 text-muted-foreground" />
          Review
        </span>
        {counts && (
          <span
            className="tabular-nums text-muted-foreground"
            title={
              `The extraction flagged ${counts.flagged} of these itself and has been carrying the ` +
              `list since the sheet was indexed. ${counts.labels} strings were read off the paper ` +
              `and ${counts.conductors} runs of ink were traced out of it; ${counts.blank_labels} ` +
              `strings came back blank and ${counts.conductors_without_a_net_name} runs have no ` +
              `net name bound at all. Those need a decision rather than a correction, so they are ` +
              `grouped at the end.`
            }
          >
            {`${done.decided} of ${done.total} decided · ${counts.flagged} flagged · `}
            {`${counts.labels} strings · ${counts.conductors} runs`}
          </span>
        )}
        {armed && loaded < total && (
          <span className="text-muted-foreground">
            loading {loaded}/{total}…
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <SaveStatus state={saveState} error={saveError} onSave={() => void save()} />
          <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={viewer.zoomOut}>
            <Minus />
          </Button>
          <span className="w-12 text-center tabular-nums text-muted-foreground">
            {viewer.percent}%
          </span>
          <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={viewer.zoomIn}>
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={viewer.fit}
            className={cn('h-8', viewer.isFit && 'text-foreground')}
          >
            <Maximize2 />
            Fit
          </Button>
        </div>
      </div>

      {report?.problems.map((problem) => (
        <p
          key={problem}
          className="border-b border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-1 text-[11px]"
        >
          {problem}
        </p>
      ))}

      <div className="flex min-h-0 flex-1">
        <div className="flex w-96 shrink-0 flex-col border-r">
          {/* Labelled as a group for the same reason the Drawing tab's two rows of buttons are
              (`H16`): anything that finds a button by its name — a screen reader, a test — has to be
              able to say which row it means. These words are this screen's own and collide with
              nothing today, and the label is here so that stays true when they do. */}
          <div
            role="group"
            aria-label="What to review"
            className="flex flex-wrap gap-1 border-b px-2 py-1.5"
          >
            {SCOPES.map(({ id, label, title }) => (
              <Button
                key={id}
                variant={scope === id ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[11px]"
                aria-pressed={scope === id}
                title={title}
                onClick={() => setScope(id)}
              >
                {label}
              </Button>
            ))}
            <Button
              variant={netNames ? 'default' : 'ghost'}
              size="sm"
              className="ml-auto h-6 px-2 text-[11px]"
              aria-pressed={netNames}
              title={
                'Only the readings a run of ink takes its net name from — every conductor, plus ' +
                'the labels their names are lifted from. These are the ones that decide whether a ' +
                'wire can be matched to a printed conductor at all, and finishing them first is ' +
                'worth doing: the other several hundred do not move that.'
              }
              onClick={() => setNetNames((on) => !on)}
            >
              Net names
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {items.length === 0
                  ? 'This drawing has no extracted ink to review — there is no geometry.json ' +
                    'beside it.'
                  : 'Nothing matches these filters.'}
              </p>
            ) : (
              <ul className="divide-y" aria-label="Readings to review">
                {visible.map((item) => (
                  <ReadingRow
                    key={item.id}
                    item={item}
                    stored={document ? correctionOf(document, item.id) : undefined}
                    current={item.id === currentId}
                    onFocus={() => setCurrent(item.id)}
                    onDecide={(text) => decide(item, text)}
                    onNote={(note) => annotate(item, note)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          ref={viewer.containerRef}
          tabIndex={0}
          role="application"
          aria-label="Schematic sheet. The reading being reviewed is ringed. Drag to pan, scroll to zoom."
          className={cn(
            'relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden bg-muted select-none',
            'cursor-grab active:cursor-grabbing',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
          )}
          {...viewer.handlers}
        >
          {measured && (
            <TileSheet
              tiles={tiles.tiles}
              width={width}
              height={height}
              viewport={viewer.viewport}
              size={viewer.size}
              dpr={viewer.dpr}
              onTileSettled={onTileSettled}
            />
          )}

          {measured && current?.rect && (
            <InkRing item={current} viewport={viewer.viewport} dpr={viewer.dpr} />
          )}
        </div>
      </div>

      <p className="border-t px-4 py-1 text-[11px] text-muted-foreground">
        Type what the ink actually says and press <Key>Enter</Key> ·{' '}
        <span className="font-medium text-foreground">not a label</span> for the strings that were
        never names · <span className="font-medium text-foreground">Reset</span> deletes the
        decision rather than writing the machine&apos;s reading back in, so the file keeps telling
        you what a person chose · the ring on the sheet is the ink of the row your caret is in.
        Saved to <span className="font-mono">label_corrections.json</span>, which is authored and
        belongs in git — and which{' '}
        <span className="font-mono">author_circuit_logic.py</span> deliberately does not read: this
        corrects a reading of the sheet, never the netlist.
      </p>

      {blocked && (
        <div className="absolute inset-0 z-20 bg-background">
          {blocked === 'locked' ? (
            <PasswordGate />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              {error ?? (loading ? 'Reading the sheet…' : 'The review screen is not available.')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One reading, with its box.
 *
 * **The box holds its own text and writes the document once**, on `Enter` or blur — hazard `H4`,
 * learned on the site-name field. Any input whose `value` comes from a document a pure function may
 * refuse or normalise needs local state, or the caret leaves after every keystroke and a trimmed or
 * refused value snaps back looking like a frozen field.
 *
 * The row shows three things a correction is judged against and they are deliberately all visible at
 * once: what the machine read, how sure it was, and — once corrected — what it read *before*, which
 * is the only durable record of it. `geometry.json` is regenerated by a re-extraction.
 */
function ReadingRow({
  item,
  stored,
  current,
  onFocus,
  onDecide,
  onNote,
}: {
  item: ReviewItem
  stored: StoredCorrection | undefined
  current: boolean
  onFocus: () => void
  onDecide: (text: string | null | undefined) => void
  onNote: (note: string) => void
}) {
  /**
   * What the box starts from: the draft's own answer if there is one, otherwise **the server's
   * resolved reading** — which for a run is not always what was bound to it. Correcting the label a
   * run takes its net name from changes what that run reads, and a box still showing the old string
   * would invite somebody to "fix" it a second time on the run itself.
   */
  const settled = stored ? (stored.text ?? '') : (item.text ?? '')
  const [text, setText] = useState(settled)
  const typed = useRef(settled)
  typed.current = text

  /** Re-seed when the row's own answer changes underneath — a save's refresh, or `Reset`. Keyed on
   * the settled value rather than on the item, so it does not fight the caret while typing. */
  useEffect(() => {
    setText(settled)
  }, [settled])

  const state = rowState(item)
  /**
   * What sort of string the row now says it is — recomputed where a person changed the text.
   *
   * The row used to print the *extraction-time* `kind`, so after `125,` → `125` the badge went on
   * saying `text` where the classifier would say `net_number`, and a badge disagreeing with the box
   * beside it reads as a field you are not allowed to correct. It was asked about three times in
   * those words. There is nothing to author: `kind` is a pure function of the text.
   */
  const badge = labelKind(item, stored)
  const commit = () => {
    /**
     * **Unchanged from what the box already showed is not a decision.**
     *
     * The baseline is the *settled* value — the correction if there is one, otherwise the machine's
     * reading — and not the correction alone. Get that wrong and tabbing through the queue signs
     * every reading you pass: a blur on an untouched box would write `{text: 'LI-A', was: 'LI-A'}`
     * and the queue would finish itself while somebody scrolled it.
     *
     * Saying *the machine was right* is still available, and is the tick: an explicit press on an
     * unchanged string. That is the one thing this screen stores which agrees with the machine, and
     * it is worth storing precisely because a person had to press it — see `label_corrections.py`.
     */
    if (typed.current.trim() === settled) return
    onDecide(typed.current)
  }

  return (
    <li className={cn('px-2 py-1.5', current && 'bg-accent')} data-reading={item.id}>
      <div className="flex items-baseline gap-2 text-[11px]">
        <span className="font-mono text-foreground">{item.id}</span>
        <Badge
          tone="default"
          title={
            item.kind !== 'label'
              ? 'A run of ink; its reading is the net name printed beside it'
              : badge.recomputed
                ? `What sort of string this is, worked out from the text you typed. The ` +
                  `extraction called it ${item.label_kind ?? 'text'} before the correction. It is ` +
                  `a hint for you and nothing here filters on it, so there is nothing to set.`
                : 'What sort of string the extraction thinks this is. A hint for you; nothing ' +
                  'here filters on it.'
          }
        >
          {badge.kind}
          {badge.recomputed && <span className="ml-0.5 opacity-60">·</span>}
        </Badge>
        {item.net_name && (
          <Badge
            tone="info"
            title="A run's net name depends on this reading, so correcting it is what lets a wire be matched to a printed conductor."
          >
            net name
          </Badge>
        )}
        {item.confidence !== null && (
          <span
            className="tabular-nums text-muted-foreground"
            title="How sure the OCR pass was. This PDF has no embedded text, so every string here was read off stroked glyph outlines."
          >
            {Math.round(item.confidence * 100)}%
          </span>
        )}
        {stored?.note && (
          /* So a note can be found again. The `Not a label` scope is the other way back, and
             between them they are what stops the ✖ being used as a bookmark. */
          <span
            className="shrink-0 text-[var(--color-ring)]"
            title={`Noted: ${stored.note}`}
            aria-label={`${item.id} has a note`}
          >
            ✎
          </span>
        )}
        <span className={cn('ml-auto shrink-0', TONE[state])}>{ROW_LABEL[state]}</span>
      </div>

      <div className="mt-1 flex items-center gap-1">
        <input
          value={text}
          aria-label={`What ${item.id} says`}
          placeholder={item.kind === 'conductor' ? 'no net name bound' : 'nothing read'}
          onFocus={onFocus}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              setText(settled)
              event.currentTarget.blur()
            }
          }}
          className={cn(
            'h-7 min-w-0 flex-1 rounded border bg-background px-2 font-mono text-xs',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
            stored?.text === null && 'text-muted-foreground line-through',
          )}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Confirm ${item.id}`}
          /* Disabled on an empty box, because an empty box is *Reset* and there would be nothing
             for this to accept — a button that silently does nothing reads as broken. The decision
             for a row with nothing in it is the one beside this: **not a label**, meaning there is
             no text here / no net name printed on this run. */
          disabled={!text.trim()}
          title="Accept what is in the box. On an unchanged string this records that you looked and the machine was right, which is the one thing worth storing that agrees with it."
          onClick={() => onDecide(text)}
        >
          <Check />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            item.kind === 'conductor'
              ? `No net name is printed on ${item.id}`
              : `${item.id} is not a label`
          }
          /**
           * **The wording that cost 34 net names.**
           *
           * On a *label* row this button is nearly free: it says the string was never a name, and
           * seven of this sheet's printed net names are partial reads of things that never were.
           * On a **run** row it is a claim about the paper — *no net name is printed on this run* —
           * and `corrected_text()` drops a `null`, so the path matcher never sees that run again.
           * Used as a bookmark on 2026-09-01 it gave up 34 usable net names, including the only run
           * carrying net `125`. The code comment beside this button already said the right
           * sentence; the tooltip a person actually reads did not. It does now, and the note box
           * below is where a bookmark belongs.
           */
          title={
            item.kind === 'conductor'
              ? 'No net name is printed on this run. This is a claim about the paper, and the ' +
                'path matcher acts on it by never offering this run for a wire again — so it is ' +
                'not a bookmark. If the name is there but hard to read, type it; if the row is ' +
                'just odd, say so in the note below. Reset (↺) takes this back.'
              : "This is not a label at all. Seven of this sheet's printed net names are partial " +
                'reads of things that were never names, and no string can say so — this writes ' +
                'null.'
          }
          onClick={() => onDecide(null)}
        >
          <Ban />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Reset ${item.id}`}
          disabled={!stored}
          title="Take the decision back. This deletes the entry rather than writing the machine's reading in as though you had chosen it — a file that cannot tell 'nobody looked' from 'somebody decided' has stopped being a record of who said what."
          onClick={() => onDecide(undefined)}
        >
          <RotateCcw />
        </Button>
      </div>

      <NoteBox item={item} stored={stored} onNote={onNote} />

      {item.via && (
        <p className="mt-0.5 truncate text-[10px] text-[var(--color-success)]">
          <span title="This run's net name is read from that label, so correcting the label corrected the run. That is what lets a wire be matched to a printed conductor — one edit, every run that reads it.">
            reads <span className="font-mono">{item.text}</span> via{' '}
            <span className="font-mono">{item.via}</span>, bound as{' '}
            <span className="font-mono">{item.read}</span>
          </span>
        </p>
      )}

      {(stored?.was || item.raw_ocr || item.missing?.length) && (
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {stored?.was && (
            <span title="What the extraction read, kept forever: geometry.json is regenerated by a re-extraction and would take it with it.">
              was <span className="font-mono">{stored.was}</span>
            </span>
          )}
          {stored?.was && (item.raw_ocr || item.missing?.length) && ' · '}
          {item.raw_ocr && (
            <span title="The raw OCR, before the extraction's own tidying. Shown only where the two differ.">
              raw <span className="font-mono">{item.raw_ocr}</span>
            </span>
          )}
          {item.raw_ocr && item.missing?.length ? ' · ' : ''}
          {item.missing?.length ? `missing ${item.missing.join(', ')}` : ''}
        </p>
      )}
    </li>
  )
}

/**
 * Why this row is odd, in a person's own words — and **it rides on a decision.**
 *
 * `note` has been in the schema, parsed and validated, since the day this screen was built, and
 * until now the only way to write one was to stop the server and hand-edit the file. That gap had
 * a cost that shows up in the data: asked how to describe a row that is strange, the honest answer
 * was *there is nowhere*, so **not a label** got used as a bookmark — and on a run that button is
 * a claim about the paper the path matcher acts on. Thirty-four net names went that way.
 *
 * **Disabled until the row has a decision**, and the reason is on the box. The file requires a
 * `text` — an entry without one *says nothing* and is refused by name — so a note on an undecided
 * row would have to invent one, and the only value available is the machine's reading. Writing
 * that would record a *confirmation nobody made*, which is invariant 10 exactly. One press of ✓,
 * or the name typed in, and the box lights up.
 *
 * Its own text, committed on `Enter` or blur, like every other input in this application that
 * writes a document a pure function may refuse (`H4`), and with the same baseline rule as the
 * reading above it (`H19`): unchanged is not a decision, so tabbing past a row writes nothing.
 */
function NoteBox({
  item,
  stored,
  onNote,
}: {
  item: ReviewItem
  stored: StoredCorrection | undefined
  onNote: (note: string) => void
}) {
  const settled = stored?.note ?? ''
  const [text, setText] = useState(settled)
  const typed = useRef(settled)
  typed.current = text

  useEffect(() => {
    setText(settled)
  }, [settled])

  const decided = Boolean(stored)

  return (
    <input
      value={decided ? text : ''}
      disabled={!decided}
      aria-label={`Note about ${item.id}`}
      placeholder={
        decided
          ? 'note — why this row is odd (optional)'
          : 'decide first: a note rides on a decision'
      }
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (typed.current.trim() === settled) return
        onNote(typed.current)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          setText(settled)
          event.currentTarget.blur()
        }
      }}
      title={
        decided
          ? 'Free text, kept beside the decision. This is where a bookmark belongs — the text ' +
            'box above is a claim about the ink that the path matcher reads.'
          : 'A note is stored beside a decision, and this row has none yet: the file requires a ' +
            'reading, and writing the machine\u2019s one to hang a note off would record a ' +
            'confirmation you did not make. Press \u2713, type the reading, or press \u2716 first.'
      }
      className={cn(
        'mt-1 h-6 w-full rounded border bg-background px-2 text-[11px]',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
        !decided && 'cursor-not-allowed opacity-50',
      )}
    />
  )
}

/**
 * The ink of the current reading, marked — **a box for a string, the run itself for a run.**
 *
 * DOM rather than a canvas stroke, and that is a deliberate difference from the tiles being
 * canvas: there is exactly one of these, and `test-setup.ts` forces `getContext('2d')` to null, so
 * a canvas mark could not be asserted at all while this one is a node with a position a test can
 * read. Through `pointToCss` and `polylineToDevice` like everything else: **there is one
 * projection in this application**, and a mark that computed its own could disagree with the tile
 * under it — which on a screen whose whole job is *read this exact piece of ink* would be the only
 * bug that matters.
 *
 * ### Why a run is not a box
 *
 * It was one until 2026-09-03, because `ink.py` did not load the polylines. `C0002` is a
 * three-segment L — (954.4, 298.7) → (763.2, 298.7) → (763.2, 83.7) → (748.4, 83.7) — and the
 * rectangle round its two ends is **206 × 215 pt**, a quarter of the sheet, with a dozen unrelated
 * runs inside it. Asked *which of these is `C0002`*, that ring cannot answer. Worse, for 19 of the
 * 149 the box does not even contain the run: `C0057` goes out to x = 798 while its ends span
 * x 429.8–598.9, so the ink was partly *outside* its own mark.
 *
 * So a run is drawn as an SVG polyline along its own corners. A label keeps the box, because a
 * label **is** a box: the extraction's bbox is the claim, and framing it exactly is what lets a
 * person see that the box itself is wrong — which is how `T0350` and `T0343` were diagnosed.
 */
function InkRing({
  item,
  viewport,
  dpr,
}: {
  item: ReviewItem
  viewport: Parameters<typeof pointToCss>[1]
  dpr: number
}) {
  const [x0, y0, x1, y1] = item.rect as [number, number, number, number]
  const start = pointToCss([x0, y0], viewport, dpr)
  const end = pointToCss([x1, y1], viewport, dpr)
  /** A degenerate box is real: a conductor drawn along one axis has endpoints that share a
   * coordinate, and a zero-height ring is invisible. 2 pt of padding, in points, so it tracks the
   * zoom rather than growing into a blob when you zoom out. */
  const pad = 2 * viewport.scale + 2
  const left = Math.min(start.left, end.left) - pad
  const top = Math.min(start.top, end.top) - pad
  const width = Math.abs(end.left - start.left) + pad * 2
  const height = Math.abs(end.top - start.top) + pad * 2

  /**
   * The run's own shape, in this element's coordinates.
   *
   * `polylineToDevice` is the one projection and it answers in **device** pixels, so the `/ dpr`
   * here is the same conversion `pointToCss` makes — and the box's own `left`/`top` are subtracted
   * because the `<svg>` is positioned at the rectangle rather than at the sheet's origin.
   */
  const shape =
    item.points && item.points.length > 1
      ? polylineToDevice(item.points, viewport, dpr)
          .map((point) => `${point.x / dpr - left},${point.y / dpr - top}`)
          .join(' ')
      : null

  return (
    <div
      aria-hidden
      data-ink-ring={item.id}
      /* The polyline case keeps the rectangle as a faint frame and stops filling it: the fill is
         what made a 206 × 215 pt box read as *this whole area is the thing*. */
      className={cn(
        'pointer-events-none absolute rounded-[2px]',
        shape
          ? 'border border-dashed border-[var(--color-ring)]/40'
          : 'border-2 border-[var(--color-ring)] bg-[var(--color-ring)]/10',
      )}
      style={{ left, top, width, height }}
    >
      {shape && (
        <svg
          data-ink-shape={item.id}
          className="absolute inset-0 overflow-visible"
          width={width}
          height={height}
        >
          <polyline
            points={shape}
            fill="none"
            stroke="var(--color-ring)"
            /* In points, so it tracks the zoom the way the highlighter's stroke does, with the
               same 3 device-pixel floor so it survives the 11% fit. `HIGHLIGHT` is 5 pt and this
               is thinner: it marks one run of ink rather than claiming a wire's whole route. */
            strokeWidth={Math.max(3 / dpr, 3 * viewport.scale)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
          />
        </svg>
      )}
    </div>
  )
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border px-1 py-px font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}

function SaveStatus({
  state,
  error,
  onSave,
}: {
  state: string
  error: string | null
  onSave: () => void
}) {
  const text =
    state === 'saving'
      ? 'saving…'
      : state === 'pending'
        ? 'unsaved'
        : state === 'saved'
          ? 'saved'
          : state === 'error'
            ? 'not saved'
            : ''
  return (
    <span className="flex items-center gap-1.5">
      {error && (
        <span className="max-w-64 truncate text-[11px] text-[var(--color-danger)]" title={error}>
          {error}
        </span>
      )}
      <Badge tone={state === 'error' ? 'danger' : state === 'pending' ? 'warning' : 'default'}>
        {text || 'no changes'}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        disabled={state === 'clean' || state === 'saving'}
        onClick={onSave}
      >
        <Save />
        Save
      </Button>
    </span>
  )
}

/** The same second password the Locate editor uses, and the same reasoning: this screen writes an
 * authored file, and permission to spend tokens is not permission to change what the drawing is
 * recorded as saying. */
function PasswordGate() {
  const { unlock, error, loading } = useReviewStore()
  const [value, setValue] = useState('')

  return (
    <div className="mx-auto mt-16 w-80 space-y-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Lock className="size-4" />
        The Review screen is locked
      </p>
      <p className="text-xs text-muted-foreground">
        This screen writes corrections to what the extraction read off the sheet. It takes the same
        password as the Locate editor — one permission, because both change an authored file.
      </p>
      <div className="flex gap-1.5">
        <input
          autoFocus
          type="password"
          value={value}
          disabled={loading}
          aria-label="Editor password"
          placeholder="editor password"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value) void unlock(value)
          }}
          className="flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        />
        <Button size="sm" disabled={!value || loading} onClick={() => void unlock(value)}>
          {loading ? '…' : 'Unlock'}
        </Button>
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Map className="size-3.5" />
        The Drawing tab is unaffected and stays read-only.
      </p>
    </div>
  )
}
