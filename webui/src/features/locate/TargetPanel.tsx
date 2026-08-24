/**
 * What the click will do, and everything about the thing being placed that a click cannot say.
 *
 * Three jobs, and the first is the one that stops mistakes: it names the target out loud. The
 * next click on the sheet writes a coordinate into an authored file, and there must never be any
 * doubt about which id it lands on.
 *
 * The other two are the parts of the model a drawing forces. A component has **N sites**, because
 * `CR-BP` is drawn three times on this sheet — coil, the `11`/`12` NC contact, the `21`/`24` NO
 * contact — and any schema shaped like "a coil point and a contact point" is wrong on arrival.
 * And a pin belongs to a site **explicitly**: `CR-BP` has two terminals whose function is
 * `common` (`11` and `21`) in different circuits, so no heuristic over `function` can place them
 * and this panel is where a person says which is which.
 */

import { useRef, useState } from 'react'
import { Crosshair, Plus, Trash2, X } from 'lucide-react'

import type { Compass, Designator, LocationsDocument, StoredSite } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  assignTerminal,
  canRenameSite,
  LABELLABLE,
  nextSiteId,
  renameSite,
  siteClaiming,
  sitesOf,
  splitTerminal,
  storedLabel,
  type Target,
} from './model'

/** The eight sides plus "let the viewer decide", laid out the way they sit on the sheet. */
const COMPASS: (Compass | null)[] = ['nw', 'n', 'ne', 'w', null, 'e', 'sw', 's', 'se']

interface Props {
  entry: Designator
  document: LocationsDocument
  target: Target
  /** Every pin the netlist gives this component, so a site's membership is a checklist rather
   * than something to type. */
  pinsOf: (componentId: string) => string[]
  /**
   * Arm something else. `fly` asks the sheet to come too, and only the site buttons set it: a
   * rename has not moved anything, and a site that does not exist yet has nowhere to go.
   */
  onTarget: (target: Target, fly?: boolean) => void
  /** `note` is what the save badge will say if this edit is undone, in a person's words. Every
   * call site passes one: *"undid: an edit"* is a message that tells you nothing at the moment
   * you most need to be told something. */
  onEdit: (
    change: (document: LocationsDocument) => LocationsDocument,
    note?: string,
  ) => void
  onLabelDir: (target: Target, dir: Compass | null) => void
  onClear: (target: Target) => void
  /** Disarm: nothing selected, nothing red, the hand back on the sheet. The panel owns the
   * visible half of that because the panel *is* the evidence something is armed — the same
   * relationship the Drawing tab's selection card has with its red marker. */
  onClose: () => void
}

export function TargetPanel({
  entry,
  document,
  target,
  pinsOf,
  onTarget,
  onEdit,
  onLabelDir,
  onClear,
  onClose,
}: Props) {
  if (LABELLABLE.has(entry.kind)) {
    return <LabelPanel {...{ entry, document, target, onLabelDir, onClear, onClose }} />
  }
  return entry.kind === 'component' ? (
    <ComponentPanel
      {...{ entry, document, target, pinsOf, onTarget, onEdit, onLabelDir, onClear, onClose }}
    />
  ) : (
    <TerminalPanel {...{ entry, document, target, onLabelDir, onClear, onClose }} />
  )
}

/**
 * A wire or a net: where its **name** is written, and nothing else.
 *
 * There is no route to place here, and the panel says so rather than leaving a gap someone tries
 * to fill. A wire's path is its two endpoint terminals; a line drawn between them because no
 * conductor joined them would be an invented route, and the netlist's authority rests on never
 * having invented one. Placing the 131 terminals is what gives all 71 wires their paths.
 */
function LabelPanel({
  entry,
  document,
  target,
  onLabelDir,
  onClear,
  onClose,
}: Pick<Props, 'entry' | 'document' | 'target' | 'onLabelDir' | 'onClear' | 'onClose'>) {
  const stored = storedLabel(document, entry.id)
  const point = stored?.label_point ?? entry.label_point ?? null

  return (
    <div className="space-y-2">
      <Header entry={entry} note={point ? 'label placed' : 'label not placed'} onClose={onClose} />
      <p className="text-[11px] text-muted-foreground">
        {point ? (
          <>
            Its name is written at{' '}
            <span className="font-mono tabular-nums">
              {point[0]}, {point[1]}
            </span>
            . Click the sheet to move it, or drag the dot.
          </>
        ) : (
          <>
            Click the sheet where <span className="font-mono">{entry.id}</span> is written, so a
            citation of it lands on the text instead of the middle of the run.
          </>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Its <span className="text-foreground">route</span> is not placed here and never will be:
        that is its two endpoint terminals, and drawing a line between them where no conductor
        runs would be inventing one.
      </p>
      <LabelSide dir={stored?.label?.dir ?? null} onPick={(dir) => onLabelDir(target, dir)} />
      {stored && (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => onClear(target)}>
          <Trash2 />
          Remove the label point
        </Button>
      )}
    </div>
  )
}

function ComponentPanel({
  entry,
  document,
  target,
  pinsOf,
  onTarget,
  onEdit,
  onLabelDir,
  onClear,
  onClose,
}: Props) {
  const sites = sitesOf(document, entry.id)
  const pins = pinsOf(entry.id)
  const armed = target.site

  return (
    <div className="space-y-2">
      <Header entry={entry} note={`site ${armed ?? '—'}`} onClose={onClose} />

      {sites.map((site) => {
        const active = site.id === armed
        return (
          <div
            key={site.id}
            className={cn('rounded-md border px-2 py-1.5', active && 'border-[var(--color-ring)]')}
          >
            <div className="flex items-center gap-1.5">
              <SiteName
                componentId={entry.id}
                site={site}
                document={document}
                armed={active}
                onEdit={onEdit}
                onTarget={onTarget}
              />
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {site.point ? `${site.point[0]}, ${site.point[1]}` : 'unplaced'}
              </span>
              <Button
                variant={active ? 'default' : 'ghost'}
                size="sm"
                className="ml-auto h-6"
                /* Also the way to *find* a site. A component drawn three times has three of
                   these, and the button is the only thing on screen that names one of them, so
                   pressing it takes the sheet to that dot — including the one already armed,
                   which is how you get back to it after panning away. */
                onClick={() => onTarget({ id: entry.id, site: site.id }, true)}
                title={
                  active
                    ? 'The next click on the sheet lands here. Press to go back to this site.'
                    : 'Aim the next click on the sheet at this site, and show it'
                }
              >
                <Crosshair />
                {active ? 'placing' : 'place'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`Remove site ${site.id}`}
                onClick={() => onClear({ id: entry.id, site: site.id })}
              >
                <Trash2 />
              </Button>
            </div>

            {pins.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {pins.map((pin) => {
                  const owner = siteClaiming(document, entry.id, pin)
                  const mine = owner?.id === site.id
                  return (
                    <label
                      key={pin}
                      title={
                        owner && !mine
                          ? `${pin} is on site ${owner.id}. Ticking it here moves it.`
                          : `Is pin ${pin} drawn at this site?`
                      }
                      className={cn(
                        'cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[10px]',
                        mine
                          ? 'border-transparent bg-[var(--color-primary)]/15 text-foreground'
                          : owner
                            ? 'text-muted-foreground line-through'
                            : 'text-muted-foreground',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={mine}
                        aria-label={`Pin ${pin} at site ${site.id}`}
                        onChange={(event) =>
                          onEdit(
                            (d) =>
                              assignTerminal(d, entry.id, site.id, pin, event.target.checked),
                            `${event.target.checked ? 'put' : 'took'} pin ${pin} ` +
                              `${event.target.checked ? 'on' : 'off'} ${entry.id} site ${site.id}`,
                          )
                        }
                      />
                      {pin}
                    </label>
                  )
                })}
              </div>
            )}

            {active && (
              <LabelSide dir={site.label?.dir ?? null} onPick={(dir) => onLabelDir(target, dir)} />
            )}
          </div>
        )
      })}

      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full"
        onClick={() => onTarget({ id: entry.id, site: nextSiteId(document, entry.id) })}
        title="A component drawn in more than one place needs a site for each. CR-BP has three."
      >
        <Plus />
        {sites.length ? 'Another site' : 'Place this component'}
      </Button>
      {!sites.length && (
        <p className="text-[11px] text-muted-foreground">
          Nothing placed yet, so the dot on the sheet is the estimate the indexing pass made.
          Click the sheet to replace it.
        </p>
      )}
    </div>
  )
}

/**
 * The site's name — typed a **word** at a time.
 *
 * It used to be a box whose `value` was the document's and whose every keystroke called
 * `renameSite`, and that arrangement had two separate faults that together let a person enter
 * exactly one character before having to reach for the mouse:
 *
 * 1. `renameSite` refuses an empty or colliding name by returning the document **unchanged**, so
 *    the first backspace — which necessarily passes through a shorter, and eventually an empty,
 *    name — was rejected and the box snapped back to what it had said before. It looked frozen.
 * 2. A rename that *was* accepted changed `site.id`, which is this row's React key, so the input
 *    was unmounted and a new one mounted in its place between one keystroke and the next. The
 *    focus went with the old element.
 *
 * So the box holds its own text and the document is written **once**, on Enter or when focus
 * leaves. Renaming becomes a thing you finish rather than a thing you do per character, the
 * intermediate states nothing would accept are never offered to anything, and the remount happens
 * at a moment when nobody is typing. (index K3, code map H4.)
 *
 * A refused name is **kept on screen with its reason**, not reverted: the same rule as the
 * `problems` strip — a value a person typed and the editor discarded silently is the worst
 * outcome available here. `Esc` is the way to abandon it, and gives back the stored name.
 */
function SiteName({
  componentId,
  site,
  document,
  armed,
  onEdit,
  onTarget,
}: {
  componentId: string
  site: StoredSite
  document: LocationsDocument
  /** Whether this is the site the next click on the sheet is aimed at. */
  armed: boolean
} & Pick<Props, 'onEdit' | 'onTarget'>) {
  const [text, setText] = useState(site.id)
  const [refused, setRefused] = useState<string | null>(null)
  /**
   * `text` again, in a ref, and not redundant: `commit` runs from a blur, and the blur that
   * follows `Esc` is dispatched by the `keydown` handler on `window` — inside the same event, and
   * so possibly before React has re-rendered with the reverted text. The commit has to read what
   * the box means *now*, or Escape would save the keystrokes it was pressed to abandon.
   */
  const typed = useRef(site.id)

  const type = (value: string) => {
    typed.current = value
    setText(value)
    setRefused(null)
  }

  const commit = () => {
    const next = typed.current.trim()
    if (next === site.id) {
      type(site.id)
      return
    }
    if (!canRenameSite(document, componentId, site.id, next)) {
      setRefused(next ? `${componentId} already has a site called ${next}` : 'A site needs a name')
      return
    }
    setRefused(null)
    onEdit(
      (d) => renameSite(d, componentId, site.id, next),
      `renamed ${componentId}'s site ${site.id} to ${next}`,
    )
    // The target names its site by id, so a rename the target did not follow would leave the next
    // click on the sheet writing a *second* site under the old name.
    if (armed) onTarget({ id: componentId, site: next })
  }

  return (
    <span className="flex min-w-0 flex-col">
      <input
        value={text}
        aria-label={`Name of site ${site.id}`}
        aria-invalid={refused ? true : undefined}
        title={
          refused ??
          'A name you will recognise on the sheet — coil, NC, NO. Press Enter or click away to ' +
            'apply it; Esc puts it back.'
        }
        onChange={(event) => type(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          // Enter only takes the focus off; the blur is what commits, so there is one write path
          // and not two that could disagree.
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') type(site.id)
        }}
        className={cn(
          'w-24 rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          refused && 'border-[var(--color-danger)]',
        )}
      />
      {refused && (
        <span className="mt-0.5 text-[10px] text-[var(--color-danger)]">{refused}</span>
      )}
    </span>
  )
}

function TerminalPanel({
  entry,
  document,
  target,
  onLabelDir,
  onClear,
  onClose,
}: Pick<Props, 'entry' | 'document' | 'target' | 'onLabelDir' | 'onClear' | 'onClose'>) {
  const own = document.terminals?.[entry.id]
  const [componentId, pin] = splitTerminal(entry.id)
  const site = pin ? siteClaiming(document, componentId, pin) : null

  return (
    <div className="space-y-2">
      <Header
        entry={entry}
        note={own ? 'its own point' : site ? `site ${site.id}` : 'unplaced'}
        onClose={onClose}
      />
      <p className="text-[11px] text-muted-foreground">
        {own ? (
          <>
            Placed by hand at{' '}
            <span className="font-mono tabular-nums">
              {own.point[0]}, {own.point[1]}
            </span>
            .
          </>
        ) : site ? (
          <>
            Drawn at <span className="font-mono">{componentId}</span>&apos;s{' '}
            <span className="font-mono">{site.id}</span> site. Click the sheet to give this pin a
            point of its own — <span className="font-mono">A1</span> and{' '}
            <span className="font-mono">A2</span> are 20 pt apart as printed.
          </>
        ) : (
          <>
            Nowhere yet. Until it is placed the viewer shows{' '}
            <span className="font-mono">{componentId}</span>&apos;s point and says so, which is a
            different claim from knowing where this pin is.
          </>
        )}
      </p>
      <LabelSide dir={own?.label?.dir ?? null} onPick={(dir) => onLabelDir(target, dir)} />
      {own && (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => onClear(target)}>
          <Trash2 />
          Unplace
        </Button>
      )}
    </div>
  )
}

function Header({
  entry,
  note,
  onClose,
}: {
  entry: Designator
  note: string
  onClose: () => void
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-sm text-foreground">{entry.id}</span>
      <Badge tone="info">{note}</Badge>
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
        {entry.label}
      </span>
      {/* The way back to nothing-selected. Armed is a *mode* — the next click on the sheet
          writes a coordinate into an authored file — and a mode with no visible way out is a
          trap, however well Escape works for the people who know about it. */}
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 self-center"
        aria-label="Clear selection"
        title="Nothing selected: the pointer goes back to panning the sheet (Esc)"
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  )
}

/** Which side of the dot the id is written on. Eight sides and an explicit "auto", because the
 * emptiest side is a property of the drawing and the default is only usually right. */
function LabelSide({
  dir,
  onPick,
}: {
  dir: Compass | null
  onPick: (dir: Compass | null) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground">label</span>
      <div className="grid grid-cols-3 gap-px">
        {COMPASS.map((side, index) => (
          <button
            key={side ?? 'auto'}
            type="button"
            aria-label={side ? `Label to the ${side}` : 'Label wherever the viewer puts it'}
            aria-pressed={dir === side}
            title={side ? `Write the id to the ${side}` : 'Default (east)'}
            onClick={() => onPick(side)}
            className={cn(
              'size-4 rounded-[2px] border text-[8px] leading-none',
              dir === side
                ? 'border-transparent bg-[var(--color-primary)] text-white'
                : 'text-muted-foreground hover:bg-accent',
              index === 4 && 'font-bold',
            )}
          >
            {side ? '' : '·'}
          </button>
        ))}
      </div>
    </div>
  )
}
