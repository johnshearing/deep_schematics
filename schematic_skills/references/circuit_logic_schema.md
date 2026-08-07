# `circuit_logic.json` — Master Schema

The human-auditable master artifact the extraction skill produces. It is a **superset** of
LightRAG's custom-KG format; `scripts/build_kg.py` flattens it into
`{chunks, entities, relationships}`.

Keep this file as the master and **generate** the custom KG from it. Do not hand-maintain
both.

---

## Top-level structure

```jsonc
{
  "drawing":       { /* metadata — one object */ },
  "components":    [ /* physical devices */ ],
  "terminals":     [ /* connection points */ ],
  "nets":          [ /* electrically-common nodes */ ],
  "wires":         [ /* physical conductors */ ],
  "cables":        [ /* harnesses grouping wires */ ],
  "subsystems":    [ /* functional groups */ ],
  "relationships": [ /* typed edges beyond the raw netlist */ ]
}
```

---

## `drawing` (object)

| Field | Type | Notes |
|---|---|---|
| `drawing_number` | string | e.g. `PS20115MLM4-2` |
| `revision` | string | e.g. `D` |
| `title` | string | full title-block text |
| `date` | string | ISO if parseable |
| `assembly` | string | what it documents |
| `proprietary_notice` | string | e.g. "Confidential property of Convex Corp." |
| `references` | string[] | other drawings (`MXCS-P9`, `MXCS-P11`) |
| `notes` | string[] | free-text drawing notes |

## `components[]`

| Field | Type | Notes |
|---|---|---|
| `id` | string | **canonical** designator exactly as printed (`CR-BP`) |
| `class` | enum | `relay`, `circuit_breaker`, `fuse`, `terminal_block`, `push_button`, `power_supply`, `speed_controller`, `connector_receptacle`, `ground`, `drive_card`, `motor`, `cable_plug`, `switch` |
| `description` | string | human-readable |
| `ratings` | object | `{voltage, current, poles, ...}` as available |
| `function` | string | role in the circuit |
| `power_domain` | enum | `115VAC`, `24VDC`, `0V_common`, `control_signal` |
| `normal_state` | string | energized/de-energized; NO/NC — deviation is the fault |
| `location` | object | `{x, y, zone}` on the drawing (citation + "where is it") |
| `part_number` | string\|null | if present |
| `manufacturer` | string\|null | if present |
| `aliases` | string[] | plain-language names so the manual's prose links to this node |

## `terminals[]`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `COMPONENT:TERMINAL`, e.g. `CR-BP:A1` |
| `parent_component` | string | component `id` |
| `function` | enum | `coil`, `NO_contact`, `NC_contact`, `common`, `line`, `neutral`, `ground`, `input`, `output` |
| `net` | string\|null | net `id` this terminal is tied to |

## `nets[]`

The troubleshooting backbone. This drawing labels its nets: `24V`, `0V`, `110`, `120`,
`121`, `125`, `130`, `N-1`, `L1-A`, `SPD`, `RUN`, `DIR`, `24E-1`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | net label |
| `signal_type` | enum | `power`, `ground`, `control` |
| `nominal_voltage` | string\|null | `24VDC`, `115VAC`, `0V` |
| `member_terminals` | string[] | **every** terminal on the net |

## `wires[]`

| Field | Type | Notes |
|---|---|---|
| `id` | string | wire id |
| `color` | string | e.g. `BLUE`, `WHITE/BLUE` |
| `gauge` | string | e.g. `18AWG` |
| `from_terminal` | string | terminal `id` |
| `to_terminal` | string | terminal `id` |
| `cable` | string\|null | parent cable `id` |
| `net` | string\|null | net `id` |

## `cables[]`

`{ "id": string, "description": string, "member_wires": string[] }`

## `subsystems[]`

`{ "id": string, "description": string, "member_components": string[] }`

## `relationships[]`

| Field | Type | Notes |
|---|---|---|
| `type` | enum | see below |
| `src` | string | source entity id |
| `tgt` | string | target entity id |
| `description` | string | prose — becomes a retrieval chunk |
| `properties` | object | e.g. `{wire_color, wire_gauge, net}` for `CONNECTS_TO` |

### Relationship types

| Type | Meaning |
|---|---|
| `HAS_TERMINAL` | component → its terminal |
| `CONNECTS_TO` | terminal → terminal, via a specific wire |
| `ON_NET` | terminal → net |
| `POWERS` | source → what it energises |
| `PROTECTS` | over-current device → what it protects |
| `ACTUATES` | operator/control device → what it drives |
| `COIL_CONTROLS_CONTACT` | relay coil → the contacts it operates |
| `PART_OF` | component → subsystem |
| `GROUNDED_TO` | terminal → ground |
| `REFERENCES` | drawing → external drawing |

**Two of these do the heavy lifting for troubleshooting:**

- **`ON_NET`** — a fault propagates across *every* point on a net, not just one wire's two
  ends. Without it, "what is wire 110 connected to" returns two terminals instead of five.
- **`COIL_CONTROLS_CONTACT`** — makes control logic explicit ("PB1 pressed → CR1 coil
  energises → contacts 11-14 close → RUN signal to cards") rather than leaving it to be
  inferred. It does not exist in the raw netlist and must be synthesised during extraction.

---

## Worked example (partial, Mod-Linx `PS20115MLM4-2`)

Wire IDs and some terminal numbers below are illustrative; the extraction produces the real
values. The *shape* is the target.

```jsonc
{
  "drawing": {
    "drawing_number": "PS20115MLM4-2",
    "revision": "D",
    "title": "MOD-LINX POWER SUPPLY ASSY. 24VDC 20AMP OUTPUT, 115VAC 1 PHASE INPUT, MASTER 4 DRIVE CARDS, SCHEMATIC",
    "date": "2017-09-19",
    "assembly": "Mod-Linx Power Supply Assembly, Master 4 Drive Cards",
    "proprietary_notice": "Confidential property of Convex Corp.",
    "references": ["MXCS-M9", "MXCS-M11", "MXCS-P9", "MXCS-P11"],
    "notes": [
      "Keep all DC wires 4\" minimum clearance from 115VAC wires.",
      "Individual wires to all points of termination; do not double place.",
      "Label all wires and cables 1\" from end."
    ]
  },

  "components": [
    {
      "id": "CR-BP", "class": "relay",
      "description": "Run bypass relay, 1 N.O.",
      "ratings": {"coil_voltage": "24VDC"},
      "function": "Bypasses the start/stop control path when energized.",
      "power_domain": "24VDC", "normal_state": "de-energized",
      "location": {"x": 1180, "y": 690, "zone": "bottom-right"},
      "part_number": null, "manufacturer": null,
      "aliases": ["bypass relay", "run bypass relay"]
    }
  ],

  "terminals": [
    {"id": "CR-BP:A1", "parent_component": "CR-BP", "function": "coil", "net": "125"},
    {"id": "CR-BP:A2", "parent_component": "CR-BP", "function": "coil", "net": "0V"},
    {"id": "CR-BP:11", "parent_component": "CR-BP", "function": "common",     "net": "111"},
    {"id": "CR-BP:12", "parent_component": "CR-BP", "function": "NC_contact", "net": "110"}
  ],

  "nets": [
    {"id": "110", "signal_type": "control", "nominal_voltage": "24VDC",
     "member_terminals": ["CR-SW:14", "CR-ON:A2", "CR-BP:12", "TB110:1", "TB110:2"]}
  ],

  "wires": [
    {"id": "W042", "color": "BLUE", "gauge": "18AWG",
     "from_terminal": "CR-BP:12", "to_terminal": "TB110:4", "cable": null, "net": "110"}
  ],

  "cables": [
    {"id": "24E-1", "description": "24VDC control cable bundle", "member_wires": ["W042"]}
  ],

  "subsystems": [
    {"id": "SUB-BYPASS", "description": "Bypass-relay control circuit",
     "member_components": ["CR-BP", "CB-BYPASS"]}
  ],

  "relationships": [
    {"type": "HAS_TERMINAL", "src": "CR-BP", "tgt": "CR-BP:A1",
     "description": "Relay CR-BP has coil terminal A1.", "properties": {}},
    {"type": "ON_NET", "src": "CR-BP:12", "tgt": "110",
     "description": "CR-BP contact terminal 12 is on control net 110 (24VDC).", "properties": {}},
    {"type": "CONNECTS_TO", "src": "CR-BP:12", "tgt": "TB110:4",
     "description": "CR-BP contact terminal 12 connects to terminal block point 110 via a BLUE 18AWG wire on net 110.",
     "properties": {"wire_color": "BLUE", "wire_gauge": "18AWG", "net": "110"}},
    {"type": "COIL_CONTROLS_CONTACT", "src": "CR-BP", "tgt": "CR-BP:11",
     "description": "Energizing the CR-BP coil (A1-A2) operates its contacts 11-12, which places net 110 on the run circuit and starts the machine.",
     "properties": {}},
    {"type": "REFERENCES", "src": "PS20115MLM4-2", "tgt": "MXCS-P9",
     "description": "This drawing references external device connection drawing MXCS-P9.", "properties": {}}
  ]
}
```

---

## Completeness checklist before building the KG

- [ ] Every component visible on the sheet appears in `components[]`.
- [ ] Every component has at least one `HAS_TERMINAL` edge.
- [ ] Every terminal has a `net` or is explicitly recorded as unconnected.
- [ ] Every net lists **all** its member terminals — not just two.
- [ ] Every terminal on a net has a matching `ON_NET` edge.
- [ ] Every relay with both a coil and contacts has a `COIL_CONTROLS_CONTACT` edge.
- [ ] Every off-page designator has a boundary entity and a `REFERENCES` edge.
- [ ] Entity names are the drawing's exact designators; plain-language names live in
      `aliases`, so a troubleshooting manual indexed into the same working_dir merges here.
