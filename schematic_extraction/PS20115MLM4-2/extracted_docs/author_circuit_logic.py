#!/usr/bin/env python3
"""
Author circuit_logic.json for Mod-Linx schematic PS20115MLM4-2.

Provenance for the master artifact. The component / terminal / net / wire tables below are
the *human-read* result of the vision pass over the tiled renders in ./tiles (plus targeted
zooms), cross-checked against the deterministic geometry in ./geometry.json.

The mechanically-derivable edges - HAS_TERMINAL, ON_NET, CONNECTS_TO, PART_OF - are
generated from those tables rather than hand-written, so they cannot drift out of sync with
the netlist. The edges that are *not* derivable from a netlist - POWERS, PROTECTS, ACTUATES,
COIL_CONTROLS_CONTACT, GROUNDED_TO, REFERENCES - are authored explicitly at the bottom.

Re-run after correcting any reading:  python author_circuit_logic.py
"""

import json
from pathlib import Path

OUT = Path(__file__).parent / "circuit_logic.json"

DRAWING_NO = "PS20115MLM4-2"

# ---------------------------------------------------------------------------------------
# Title block
# ---------------------------------------------------------------------------------------
drawing = {
    "drawing_number": DRAWING_NO,
    "revision": None,
    "title": (
        "MOD-LINX POWER SUPPLY ASSY: 24VDC 20AMP OUTPUT, 115VAC-1 PHASE INPUT, "
        "MOD LINX MASTER 4 DRIVE CARDS, SCHEMATIC"
    ),
    "date": "2017-09-19",
    "assembly": "Mod-Linx Power Supply Assembly, Master, 4 Drive Cards",
    "proprietary_notice": (
        "PROPRIETARY INFORMATION. This drawing is the confidential property of CONVEYX CORP. "
        "and is transmitted in confidence. The reproduction, disclosure, or use, in whole or "
        "part, of the design or the details contained herein is prohibited without the "
        "express written permission of Conveyx Corp."
    ),
    "references": ["MXCS-M9", "MXCS-M11", "MXCS-P9", "MXCS-P11"],
    "notes": [
        "Input: 115VAC 1 phase, 60Hz. L1 = 4.16 FLA @115VAC. SCCR = 5kA.",
        "NOTE: Keep all DC wires 4\" minimum clearance from 115VAC wires.",
        "NOTE: Individual wires to all points of termination. Do not double place wires.",
        "Label all wires and cables 1\" from end.",
        "NOTE (LT1 cable): Remove white and brown wire at insulation, heat shrink exposed end.",
        "Title-block stamp: REVISED - destroy previous drawing with the same number. "
        "Date 04/08/2020.",
        "Sheet size is D. The title block has no separate revision field; the 'D' that appears "
        "in the side tab and the SIZE box is the sheet size, NOT a revision letter.",
        "Safety note: The need for safety devices varies with each application of this product. "
        "This drawing may not include all appropriate safety devices for your application. As "
        "systems integrator, please advise your customer of devices that are appropriate for "
        "his/her application, based on your safety assessment. Devices may include, but are not "
        "limited to those such as, additional guarding, safety controls, barricades, end stops, "
        "etc. Compliance with all federal, state, OSHA and local laws or codes are the "
        "responsibility of both you, as the systems integrator/distributor, and the end user.",
        "Drawing file/part reference in the side tab: CXC_MXPS-ASSY.",
    ],
}

# ---------------------------------------------------------------------------------------
# Components
# (id, class, description, ratings, function, power_domain, normal_state, zone, aliases)
# ---------------------------------------------------------------------------------------
C = []


def comp(cid, cls, desc, function, domain, state, zone, ratings=None, aliases=None,
         part_number=None, manufacturer=None, x=None, y=None):
    C.append({
        "id": cid, "class": cls, "description": desc, "ratings": ratings or {},
        "function": function, "power_domain": domain, "normal_state": state,
        "location": {"x": x, "y": y, "zone": zone},
        "part_number": part_number, "manufacturer": manufacturer,
        "aliases": aliases or [],
    })


# --- 115VAC input section ---
comp("PLG1", "cable_plug",
     "Power-in plug, Leviton LEV2611, on the POWER IN 115VAC cable. Pins B (line), W "
     "(neutral) and G (ground).",
     "Brings 115VAC single-phase supply power into the power supply assembly.",
     "115VAC", "energized when upstream supply is on", "top-left",
     ratings={"voltage": "115VAC", "phase": "1", "frequency": "60Hz", "pins": 3},
     part_number="LEV2611", aliases=["power in plug", "input plug", "LEV2611"], x=137, y=51)

comp("PLG2", "cable_plug",
     "Power-out plug, Leviton LEV2613, on the POWER OUT 115VAC cable. Pins B (line), W "
     "(neutral) and G (ground). Wired in parallel with PLG1 at the L1/N/GND terminals.",
     "Passes 115VAC supply power through to the next machine in the line (daisy chain).",
     "115VAC", "energized when upstream supply is on", "top-left",
     ratings={"voltage": "115VAC", "phase": "1", "frequency": "60Hz", "pins": 3},
     part_number="LEV2613", aliases=["power out plug", "output plug", "LEV2613"], x=137, y=118)

comp("TB-L1", "terminal_block",
     "Single-point terminal marked L1 where the 115VAC line conductors of PLG1 and PLG2 land.",
     "Common the 115VAC line between the input plug, the output plug and the disconnect.",
     "115VAC", "energized when upstream supply is on", "top-left",
     aliases=["terminal L1", "L1 terminal"], x=300, y=68)

comp("TB-N", "terminal_block",
     "Single-point terminal marked N where the 115VAC neutral conductors of PLG1 and PLG2 land.",
     "Common the 115VAC neutral between the input plug, the output plug and the disconnect.",
     "115VAC", "at neutral potential", "top-left",
     aliases=["terminal N", "neutral terminal"], x=300, y=108)

comp("TB-GND-A", "terminal_block",
     "Terminal marked GND where the green ground conductors of PLG1 and PLG2 land; bonded to "
     "the earth ground symbol.",
     "Bonds the plug ground conductors to the panel protective earth.",
     "0V_common", "bonded to earth", "top-left",
     aliases=["terminal GND", "plug ground terminal"], x=310, y=133)

comp("DISC1", "switch",
     "Panel disconnect switch. Three poles drawn L1/T1, L2/T2 and L3/T3; only L1-T1 (line) "
     "and L3-T3 (neutral) are wired on this drawing. L2-T2 is spare.",
     "Manually isolates the 115VAC supply feeding the power supply assembly.",
     "115VAC", "closed when the panel is switched on", "top-centre-left",
     ratings={"poles": 3, "poles_used": 2},
     aliases=["panel disconnect", "main disconnect", "DISC1"], x=390, y=90)

comp("CB1", "circuit_breaker",
     "8 amp circuit breaker in the 115VAC line ahead of the power supply. Terminals 1 (line "
     "from DISC1:T1) and 2 (load to PS1:L1).",
     "Over-current protection for the 115VAC feed to power supply PS1.",
     "115VAC", "closed (ON)", "top-centre",
     ratings={"current": "8A", "poles": 1, "voltage": "115VAC"},
     aliases=["8 amp breaker", "8AMP CIRCUIT BREAKER", "main breaker"], x=475, y=52)

# --- 24VDC supply section ---
comp("PS1", "power_supply",
     "20 amp power supply converting 115VAC single-phase input to 24VDC output. Input "
     "terminals L1, N and GND; output terminals + (plus) and two - (minus) terminals.",
     "Supplies 24VDC to the control circuits, the drive cards and the downstream machine "
     "interfaces.",
     "24VDC", "energized whenever CB1 and DISC1 are closed", "top-centre",
     ratings={"input": "115VAC 1 phase 60Hz", "output": "24VDC", "current": "20A"},
     aliases=["20AMP POWER SUPPLY", "24V power supply", "PSU", "power supply"], x=560, y=60)

comp("TB-GND-B", "terminal_block",
     "Two-point terminal marked GND carrying the door ground and the power-supply ground; "
     "bonded to the earth ground symbol.",
     "Bonds the enclosure door and the power supply chassis to protective earth.",
     "0V_common", "bonded to earth", "top-centre",
     aliases=["GND terminal", "door ground terminal"], x=485, y=110)

comp("DOOR-GND", "ground",
     "Door ground connection point shown at the left of the GND terminal.",
     "Bonds the enclosure door to protective earth.",
     "0V_common", "bonded to earth", "top-centre",
     aliases=["DOOR GND", "door earth"], x=420, y=110)

comp("EARTH", "ground",
     "Protective earth (ground) reference, drawn as two earth symbols - one below TB-GND-A "
     "and one below TB-GND-B.",
     "Panel protective earth reference for the whole assembly.",
     "0V_common", "at earth potential", "top",
     aliases=["earth", "ground", "PE", "protective earth"], x=310, y=145)

comp("CB2", "circuit_breaker",
     "20 amp circuit breaker on the 24VDC output of PS1. Terminals 1 (from PS1:+) and 2 "
     "(to the 24E-1 distribution terminal).",
     "Over-current protection for the whole 24VDC distribution bus (net 24E-1).",
     "24VDC", "closed (ON)", "top-centre-right",
     ratings={"current": "20A", "poles": 1, "voltage": "24VDC"},
     aliases=["20 amp breaker", "20AMP CIRCUIT BREAKER", "DC breaker"], x=640, y=52)

comp("TB-24E1-A", "terminal_block",
     "Main 24VDC distribution terminal block marked 24E-1, on the left edge of the sheet. "
     "Eight points: the feed from CB2:2 plus seven outgoing circuits.",
     "Distributes +24VDC (net 24E-1) to the secondary 24E-1 terminal block, both start/stop "
     "switches, the circuit-1 light and the CR-ON, CR-BP and CR-SW relay coils.",
     "24VDC", "energized whenever CB2 is closed", "left edge",
     ratings={"points": 8},
     aliases=["24E-1 terminal", "main 24V terminal block", "24VDC distribution terminal"],
     x=61, y=430)

comp("TB-24E1-B", "terminal_block",
     "Secondary 24VDC distribution terminal block marked 24E-1, in the centre of the sheet. "
     "Fed from TB-24E1-A; five outgoing circuits.",
     "Distributes +24VDC to the reverse breaker, the speed controller, the CR-ON and CR-BP "
     "run contacts and the 5-pin external receptacle.",
     "24VDC", "energized whenever CB2 is closed", "centre",
     ratings={"points": 6},
     aliases=["24E-1 terminal", "secondary 24V terminal block"], x=468, y=215)

comp("TB-0V", "terminal_block",
     "Tall multi-point 0V terminal strip labelled TERMINAL'S, on the right of the sheet. "
     "Every 0V (DC common) return on the drawing lands here.",
     "Commons the 24VDC return (0V) for the whole assembly.",
     "0V_common", "at 0V", "right",
     aliases=["0V terminal", "TERMINAL'S", "common terminal strip", "DC common"],
     x=960, y=450)

# --- speed / direction ---
comp("SPD1", "speed_controller",
     "Speed controller. Three terminals: 1 = +24V, 2 = 0V, 3 = SPEED.",
     "Sets the conveyor speed reference sent out on the SPD signal to the drive cards.",
     "24VDC", "energized whenever CB2 is closed", "top-right",
     ratings={"supply": "24VDC", "terminals": 3},
     aliases=["SPEED CONTROLER", "speed controller", "speed pot"], x=865, y=40)

comp("TB-SPD", "terminal_block",
     "Single-point terminal marked SPD carrying the speed signal.",
     "Junction point for the speed reference between SPD1 and the external receptacle.",
     "control_signal", "carries the speed reference", "top-right",
     aliases=["SPD terminal", "speed terminal"], x=790, y=117)

comp("REVERSE-CB", "circuit_breaker",
     "5 amp circuit breaker labelled REVERSE. Terminals 1 (from 24E-1) and 2 (to the DIR "
     "net). NOTE: on this machine family this breaker is used as a MANUAL SWITCH, not as "
     "over-current protection - it selects/enables the reverse (DIR) direction path. It is "
     "a breaker only because it DIN-rail mounts conveniently.",
     "Manually enables the reverse direction signal (DIR) sent to the drive cards.",
     "24VDC", "open (reverse not selected) unless the operator switches it on", "centre",
     ratings={"current": "5A", "poles": 1},
     aliases=["REVERSE 5AMP CIRCUIT BREAKER", "reverse breaker", "reverse switch",
              "direction switch"], x=568, y=183)

comp("TB-DIR", "terminal_block",
     "Single-point terminal marked DIR carrying the direction signal.",
     "Junction point for the direction signal between the reverse breaker and the external "
     "receptacle.",
     "control_signal", "de-energized unless the reverse breaker is closed", "centre",
     aliases=["DIR terminal", "direction terminal"], x=660, y=183)

# --- operator control ---
comp("PB1", "push_button",
     "Start/stop switch #1: a lighted push button with a red (R) lamp for the open/stopped "
     "state and a green (G) lamp for the closed/running state. Four terminals: 1 = +24VDC "
     "in, 2 = spare (to the PB1-SP terminal), 3 = 0V common, 4 = switched 24V signal out.",
     "Operator start/stop control that energizes relay CR1.",
     "control_signal", "open (not pressed) - red lamp lit", "left",
     ratings={"terminals": 4, "supply": "24VDC"},
     aliases=["PB1 START/STOP SWITCH", "start/stop switch 1", "start stop button 1",
              "lighted push button 1"], x=180, y=270)

comp("PB2", "push_button",
     "Start/stop switch #2: a lighted push button with a red (R) lamp for the open/stopped "
     "state and a green (G) lamp for the closed/running state. Four terminals: 1 = +24VDC "
     "in, 2 = spare (to the PB2-SP terminal), 3 = 0V common, 4 = switched 24V signal out.",
     "Operator start/stop control that energizes relay CR2.",
     "control_signal", "open (not pressed) - red lamp lit", "left",
     ratings={"terminals": 4, "supply": "24VDC"},
     aliases=["PB2 START/STOP SWITCH", "start/stop switch 2", "start stop button 2",
              "lighted push button 2"], x=180, y=370)

comp("TB-PB1SP", "terminal_block",
     "Single-point terminal marked PB1-SP carrying the spare conductor of the PB1 start/stop "
     "cable. The conductor is landed but is not used elsewhere on this drawing.",
     "Parks the spare white conductor of the PB1 start/stop cable.",
     "control_signal", "unused / spare", "left",
     aliases=["PB1-SP terminal", "PB1 spare terminal"], x=196, y=282)

comp("TB-PB2SP", "terminal_block",
     "Single-point terminal marked PB2-SP carrying the spare conductor of the PB2 start/stop "
     "cable. The conductor is landed but is not used elsewhere on this drawing.",
     "Parks the spare white conductor of the PB2 start/stop cable.",
     "control_signal", "unused / spare", "left",
     aliases=["PB2-SP terminal", "PB2 spare terminal"], x=196, y=382)

comp("LT1", "indicator_light",
     "Circuit 1 light with cable - a green indicator lamp on a 4-conductor cable. Black = "
     "24E-1 (+24VDC), blue = 0V; the brown and white conductors are NOT CONNECTED and must "
     "be cut back at the insulation and heat-shrunk.",
     "Indicates that the 24VDC control circuit (circuit 1) is powered.",
     "24VDC", "lit whenever CB2 is closed", "left-centre",
     ratings={"conductors": 4, "conductors_used": 2},
     aliases=["CIRCUIT 1 LIGHT WITH CABLE", "circuit 1 light", "power on light"], x=267, y=414)

# --- relays ---
comp("CR1", "relay",
     "Control relay CR1. Legend on the drawing: 'CR1: MODLINX PB1 START / STOP, 1N.O.' Coil "
     "terminals A1/A2; one normally-open contact 11-14.",
     "Energized by start/stop switch PB1; its N.O. contact 11-14 is the first element of the "
     "two-in-series start/stop permissive chain.",
     "24VDC", "de-energized (contact 11-14 open)", "right-centre",
     ratings={"coil_voltage": "24VDC", "contacts": "1 N.O."},
     aliases=["CR1", "MODLINX PB1 START/STOP relay", "start stop relay 1", "relay CR-1"],
     x=861, y=332)

comp("CR2", "relay",
     "Control relay CR2. Legend on the drawing: 'CR2: MODLINX PB2 START / STOP, 1N.O.' Coil "
     "terminals A1/A2; one normally-open contact 11-14.",
     "Energized by start/stop switch PB2; its N.O. contact 11-14 is the second element of the "
     "two-in-series start/stop permissive chain.",
     "24VDC", "de-energized (contact 11-14 open)", "right-centre",
     ratings={"coil_voltage": "24VDC", "contacts": "1 N.O."},
     aliases=["CR2", "MODLINX PB2 START/STOP relay", "start stop relay 2", "relay CR-2"],
     x=861, y=381)

comp("CR-ON", "relay",
     "Control relay CR-ON. Legend on the drawing: 'CR-ON: MODLINX RUN, RUN SIGNAL TO CARDS, "
     "1N.O.' Coil terminals A1/A2; one normally-open contact 11-14.",
     "The run relay. When energized its N.O. contact 11-14 puts 24VDC on the RUN net, which "
     "sends the run signal to the drive cards and makes the machine run.",
     "24VDC", "de-energized (machine stopped)", "right-centre",
     ratings={"coil_voltage": "24VDC", "contacts": "1 N.O."},
     aliases=["CR-ON", "MODLINX RUN relay", "run relay", "CR ON"], x=861, y=464)

comp("CR-BP", "relay",
     "Control relay CR-BP. Legend on the drawing: 'CR-BP: RUN BYPASS RELAY, 1N.C., 1N.O.' "
     "Coil terminals A1/A2; one normally-closed contact 11-12 and one normally-open contact "
     "21-24.",
     "The run bypass relay. When energized its N.O. contact 21-24 puts 24VDC directly on the "
     "RUN net (bypassing CR-ON), and its N.C. contact 11-12 opens, breaking the link between "
     "the discharge signal 111 and net 110.",
     "24VDC", "de-energized (11-12 closed, 21-24 open)", "bottom-right",
     ratings={"coil_voltage": "24VDC", "contacts": "1 N.C. + 1 N.O."},
     aliases=["CR-BP", "RUN BYPASS RELAY", "bypass relay", "run bypass relay"], x=861, y=679)

comp("CR-SW", "relay",
     "Control relay CR-SW. Legend on the drawing: 'CR-SW: SWITCH RELAY, SWITCH CIRCUIT ON, "
     "1N.O.' Coil terminals A1/A2; one normally-open contact 11-14.",
     "The switch relay. Its coil returns through net 130, which leaves this drawing at the "
     "discharge interface, so it can only be energized by the downstream (subordinate) "
     "machine. When energized its N.O. contact 11-14 pulls net 110 to 0V.",
     "24VDC", "de-energized (contact 11-14 open)", "bottom-right",
     ratings={"coil_voltage": "24VDC", "contacts": "1 N.O."},
     aliases=["CR-SW", "SWITCH RELAY", "switch relay", "CR SW"], x=861, y=704)

comp("BYPASS-CB", "circuit_breaker",
     "5 amp circuit breaker labelled BYPASS. Terminals 1 (from net 120) and 2 (to net 125). "
     "NOTE: on this machine family this breaker is used as a MANUAL SWITCH, not as "
     "over-current protection - it enables the bypass control path to the CR-BP coil. It is "
     "a breaker only because it DIN-rail mounts conveniently.",
     "Manually enables the bypass control path that energizes relay CR-BP.",
     "24VDC", "open (bypass not selected) unless the operator switches it on", "bottom-centre",
     ratings={"current": "5A", "poles": 1},
     aliases=["BYPASS 5AMP CIRCUIT BREAKER", "bypass breaker", "bypass switch"], x=385, y=664)

# --- signal terminals ---
comp("TB-RUN", "terminal_block",
     "Single-point terminal marked RUN carrying the run signal.",
     "Commons the run signal from the CR-ON and CR-BP contacts and sends it to the external "
     "receptacle.",
     "control_signal", "de-energized when the machine is stopped", "centre",
     aliases=["RUN terminal", "run signal terminal"], x=678, y=216)

comp("TB-110", "terminal_block",
     "Four-point terminal block marked 110 carrying the start/stop signal net.",
     "Commons net 110 between the CR-SW contact, the infeed interface, the CR-ON coil return "
     "and the CR-BP normally-closed contact.",
     "control_signal", "carries the start/stop signal", "centre-right",
     ratings={"points": 4},
     aliases=["110 terminal", "terminal 110", "start stop signal terminal"], x=781, y=500)

comp("TB-120", "terminal_block",
     "Three-point terminal block marked 120 carrying the start/stop permissive net.",
     "Commons net 120 between the CR1/CR2 series contacts, the machine interfaces and the "
     "bypass breaker.",
     "control_signal", "carries the start/stop permissive", "bottom-left-centre",
     ratings={"points": 3},
     aliases=["120 terminal", "terminal 120"], x=300, y=600)

comp("TB-130", "terminal_block",
     "Two-point terminal block marked 130 carrying the CR-SW coil return net.",
     "Commons net 130 between the CR-SW coil return and the machine interfaces.",
     "control_signal", "carries the switch-relay coil return", "bottom-centre-right",
     ratings={"points": 2},
     aliases=["130 terminal", "terminal 130"], x=796, y=580)

# --- machine interfaces ---
comp("RECEPT1", "connector_receptacle",
     "5-pin micro (M12) female receptacle for the external device connection. The five "
     "conductors are, in drawing order top to bottom: SPD brown 18AWG, DIR grey 18AWG, RUN "
     "black 18AWG, 0V white 18AWG and 24E-1 blue 18AWG. Their colours follow the standard "
     "M12 5-pin cordset code (1 brown, 2 white, 3 blue, 4 black, 5 grey), so the drawing "
     "order maps to standard pins 1, 5, 4, 2 and 3 respectively.",
     "Carries 24VDC power, 0V, and the run, direction and speed signals out to the external "
     "drive-card devices.",
     "24VDC", "energized whenever CB2 is closed", "top-right",
     ratings={"pins": 5, "style": "M12 micro, female"},
     aliases=["5-PIN MICRO FEMALE RECEPTACLE", "5 pin receptacle", "external device connector",
              "micro receptacle"], x=980, y=150)

comp("INFEED1", "connector_receptacle",
     "Infeed interface #1, female 6-pin mini receptacle. Conductors: 110 blue 16AWG, 0V green "
     "16AWG, 120 red 16AWG, 130 orange 16AWG, IINSP1 black 16AWG, IINSP2 white 16AWG.",
     "Connects this master machine to the upstream (infeed) machine, carrying the start/stop "
     "signal, common, permissive and inspection signals.",
     "control_signal", "connected to the upstream machine", "centre-bottom",
     ratings={"pins": 6, "style": "6-pin mini, female"},
     aliases=["INFEED INTERFACE #1", "infeed interface", "infeed receptacle",
              "female 6-pin mini receptacle"], x=620, y=560)

comp("DISCHARGE1", "cable_plug",
     "Discharge interface #1, male 6-pin mini cable. Conductors: 111 blue 16AWG, 0V green "
     "16AWG, 120 red 16AWG, 130 orange 16AWG, DINSP1 black 16AWG, DINSP2 white 16AWG.",
     "Connects this master machine to the downstream (discharge / subordinate) machine, "
     "carrying the start/stop signal, common, permissive and inspection signals.",
     "control_signal", "connected to the downstream machine", "centre-bottom",
     ratings={"pins": 6, "style": "6-pin mini, male"},
     aliases=["DISCHARGE INTERFACE #1", "discharge interface", "discharge cable",
              "male 6-pin mini cable"], x=760, y=560)

for tb, sig, zone, x, y in [
    ("TB-IINSP1", "IINSP1", "centre-bottom", 480, 590),
    ("TB-IINSP2", "IINSP2", "centre-bottom", 480, 610),
    ("TB-DINSP1", "DINSP1", "centre-bottom", 700, 590),
    ("TB-DINSP2", "DINSP2", "centre-bottom", 700, 610),
]:
    side = "infeed" if sig.startswith("I") else "discharge"
    comp(tb, "terminal_block",
         f"Single-point terminal marked {sig} carrying the {side} inspection signal "
         f"{sig}. The signal is landed here and does not go anywhere else on this drawing.",
         f"Lands the {sig} inspection signal from the {side} interface.",
         "control_signal", "carries an inspection signal", zone,
         aliases=[f"{sig} terminal"], x=x, y=y)

# --- off-page boundary entities ---
for ref, what in [
    ("MXCS-M9", "external device connection drawing"),
    ("MXCS-M11", "external device connection drawing"),
    ("MXCS-P9", "external device connection drawing"),
    ("MXCS-P11", "external device connection drawing"),
]:
    comp(ref, "external_drawing",
         f"{ref} is an {what} referenced by this schematic for the devices that plug into the "
         f"5-pin micro receptacle. Its contents are NOT on this drawing.",
         "Documents the external device connections beyond the 5-pin receptacle.",
         "control_signal", "not applicable - external reference", "off-page",
         aliases=[ref], x=None, y=None)

comp("UPSTREAM-MACHINE", "external_machine",
     "The upstream (previous / infeed) Mod-Linx machine that plugs into INFEED INTERFACE #1. "
     "Not documented on this drawing. This sheet is the MASTER machine, so in a typical "
     "installation there may be no previous machine.",
     "Supplies the infeed-side start/stop, common, permissive and inspection signals.",
     "control_signal", "not applicable - external", "off-page",
     aliases=["previous machine", "infeed machine", "upstream conveyor"])

comp("DOWNSTREAM-MACHINE", "external_machine",
     "The downstream (subordinate / discharge) Mod-Linx machine that plugs into DISCHARGE "
     "INTERFACE #1. Not documented on this drawing. Net 130 - the CR-SW coil return - only "
     "completes through this machine, which is why CR-SW cannot be energized from anything "
     "shown on this sheet alone.",
     "Completes the CR-SW coil return (net 130) and receives signal 111.",
     "control_signal", "not applicable - external", "off-page",
     aliases=["subordinate machine", "discharge machine", "downstream conveyor", "next machine"])

# ---------------------------------------------------------------------------------------
# Terminals:  (component, terminal, function, net)
# ---------------------------------------------------------------------------------------
T = [
    ("PLG1", "B", "line", "L1"), ("PLG1", "W", "neutral", "N"), ("PLG1", "G", "ground", "GND"),
    ("PLG2", "B", "line", "L1"), ("PLG2", "W", "neutral", "N"), ("PLG2", "G", "ground", "GND"),
    ("TB-L1", "1", "line", "L1"),
    ("TB-N", "1", "neutral", "N"),
    ("TB-GND-A", "1", "ground", "GND"),
    ("DISC1", "L1", "line", "L1"), ("DISC1", "T1", "output", "L1-A"),
    ("DISC1", "L2", "line", None), ("DISC1", "T2", "output", None),
    ("DISC1", "L3", "neutral", "N"), ("DISC1", "T3", "output", "N-1"),
    ("CB1", "1", "line", "L1-A"), ("CB1", "2", "output", "L1-A1"),
    ("PS1", "L1", "line", "L1-A1"), ("PS1", "N", "neutral", "N-1"),
    ("PS1", "GND", "ground", "GND"),
    ("PS1", "+", "output", "+24V"),
    ("PS1", "-1", "output", "0V"), ("PS1", "-2", "output", "0V"),
    ("TB-GND-B", "1", "ground", "GND"), ("TB-GND-B", "2", "ground", "GND"),
    ("DOOR-GND", "1", "ground", "GND"),
    ("EARTH", "1", "ground", "GND"), ("EARTH", "2", "ground", "GND"),
    ("CB2", "1", "input", "+24V"), ("CB2", "2", "output", "24E-1"),
    ("TB-24E1-A", "1", "input", "24E-1"),
    ("TB-24E1-A", "2", "output", "24E-1"), ("TB-24E1-A", "3", "output", "24E-1"),
    ("TB-24E1-A", "4", "output", "24E-1"), ("TB-24E1-A", "5", "output", "24E-1"),
    ("TB-24E1-A", "6", "output", "24E-1"), ("TB-24E1-A", "7", "output", "24E-1"),
    ("TB-24E1-A", "8", "output", "24E-1"),
    ("TB-24E1-B", "1", "input", "24E-1"), ("TB-24E1-B", "2", "output", "24E-1"),
    ("TB-24E1-B", "3", "output", "24E-1"), ("TB-24E1-B", "4", "output", "24E-1"),
    ("TB-24E1-B", "5", "output", "24E-1"),
    ("SPD1", "1", "input", "24E-1"), ("SPD1", "2", "common", "0V"),
    ("SPD1", "3", "output", "SPD"),
    ("TB-SPD", "1", "common", "SPD"),
    ("REVERSE-CB", "1", "input", "24E-1"), ("REVERSE-CB", "2", "output", "DIR"),
    ("TB-DIR", "1", "common", "DIR"),
    ("PB1", "1", "input", "24E-1"), ("PB1", "2", "output", "PB1-SP"),
    ("PB1", "3", "common", "0V"), ("PB1", "4", "output", "NET-PB1"),
    ("PB2", "1", "input", "24E-1"), ("PB2", "2", "output", "PB2-SP"),
    ("PB2", "3", "common", "0V"), ("PB2", "4", "output", "NET-PB2"),
    ("TB-PB1SP", "1", "common", "PB1-SP"),
    ("TB-PB2SP", "1", "common", "PB2-SP"),
    ("LT1", "BLACK", "input", "24E-1"), ("LT1", "BLUE", "common", "0V"),
    ("LT1", "BROWN", "input", None), ("LT1", "WHITE", "input", None),
    ("CR1", "A1", "coil", "NET-PB1"), ("CR1", "A2", "coil", "0V"),
    ("CR1", "11", "common", "0V"), ("CR1", "14", "NO_contact", "121"),
    ("CR2", "A1", "coil", "NET-PB2"), ("CR2", "A2", "coil", "0V"),
    ("CR2", "11", "common", "121"), ("CR2", "14", "NO_contact", "120"),
    ("CR-ON", "A1", "coil", "24E-1"), ("CR-ON", "A2", "coil", "110"),
    ("CR-ON", "11", "common", "24E-1"), ("CR-ON", "14", "NO_contact", "RUN"),
    ("CR-BP", "A1", "coil", "24E-1"), ("CR-BP", "A2", "coil", "125"),
    ("CR-BP", "11", "common", "111"), ("CR-BP", "12", "NC_contact", "110"),
    ("CR-BP", "21", "common", "24E-1"), ("CR-BP", "24", "NO_contact", "RUN"),
    ("CR-SW", "A1", "coil", "24E-1"), ("CR-SW", "A2", "coil", "130"),
    ("CR-SW", "11", "common", "0V"), ("CR-SW", "14", "NO_contact", "110"),
    ("BYPASS-CB", "1", "input", "120"), ("BYPASS-CB", "2", "output", "125"),
    ("TB-RUN", "1", "common", "RUN"),
    ("TB-110", "1", "common", "110"), ("TB-110", "2", "common", "110"),
    ("TB-110", "3", "common", "110"), ("TB-110", "4", "common", "110"),
    ("TB-120", "1", "common", "120"), ("TB-120", "2", "common", "120"),
    ("TB-120", "3", "common", "120"),
    ("TB-130", "1", "common", "130"), ("TB-130", "2", "common", "130"),
    ("TB-0V", "1", "common", "0V"), ("TB-0V", "2", "common", "0V"),
    ("TB-0V", "3", "common", "0V"), ("TB-0V", "4", "common", "0V"),
    ("TB-0V", "5", "common", "0V"), ("TB-0V", "6", "common", "0V"),
    ("TB-0V", "7", "common", "0V"), ("TB-0V", "8", "common", "0V"),
    ("TB-0V", "9", "common", "0V"), ("TB-0V", "10", "common", "0V"),
    ("TB-0V", "11", "common", "0V"), ("TB-0V", "12", "common", "0V"),
    ("RECEPT1", "1", "output", "SPD"), ("RECEPT1", "2", "output", "DIR"),
    ("RECEPT1", "3", "output", "RUN"), ("RECEPT1", "4", "common", "0V"),
    ("RECEPT1", "5", "output", "24E-1"),
    ("INFEED1", "1", "input", "110"), ("INFEED1", "2", "common", "0V"),
    ("INFEED1", "3", "input", "120"), ("INFEED1", "4", "input", "130"),
    ("INFEED1", "5", "input", "IINSP1"), ("INFEED1", "6", "input", "IINSP2"),
    ("DISCHARGE1", "1", "output", "111"), ("DISCHARGE1", "2", "common", "0V"),
    ("DISCHARGE1", "3", "output", "120"), ("DISCHARGE1", "4", "output", "130"),
    ("DISCHARGE1", "5", "output", "DINSP1"), ("DISCHARGE1", "6", "output", "DINSP2"),
    ("TB-IINSP1", "1", "common", "IINSP1"), ("TB-IINSP2", "1", "common", "IINSP2"),
    ("TB-DINSP1", "1", "common", "DINSP1"), ("TB-DINSP2", "1", "common", "DINSP2"),
]

# ---------------------------------------------------------------------------------------
# Nets: id -> (signal_type, nominal_voltage, description)
# ---------------------------------------------------------------------------------------
NETS = {
    "L1": ("power", "115VAC",
           "115VAC line (hot) from the supply plugs to the panel disconnect."),
    "L1-A": ("power", "115VAC",
             "115VAC line between the panel disconnect output T1 and circuit breaker CB1."),
    "L1-A1": ("power", "115VAC",
              "115VAC line between circuit breaker CB1 and the power supply line input."),
    "N": ("power", "115VAC neutral",
          "115VAC neutral from the supply plugs to the panel disconnect."),
    "N-1": ("power", "115VAC neutral",
            "115VAC neutral between the panel disconnect output T3 and the power supply."),
    "GND": ("ground", "0V",
            "Protective earth. Bonds the plug grounds, the enclosure door and the power "
            "supply chassis to the two earth ground symbols on the drawing."),
    "+24V": ("power", "24VDC",
             "24VDC output of power supply PS1 up to circuit breaker CB2."),
    "24E-1": ("power", "24VDC",
              "The main 24VDC distribution bus, downstream of CB2. It feeds both 24E-1 "
              "terminal blocks, both start/stop switches, the circuit-1 light, the speed "
              "controller, the reverse breaker, the CR-ON, CR-BP and CR-SW relay coils, the "
              "CR-ON and CR-BP run contacts, and the external 5-pin receptacle."),
    "0V": ("ground", "0V",
           "The 24VDC common return for the whole assembly, landed on the TERMINAL'S 0V "
           "strip. Fed by both minus terminals of PS1."),
    "SPD": ("control", "24VDC",
            "Speed reference signal from the speed controller out to the external receptacle."),
    "DIR": ("control", "24VDC",
            "Direction (reverse) signal from the REVERSE breaker/switch out to the external "
            "receptacle."),
    "RUN": ("control", "24VDC",
            "The run signal. Energized to 24VDC by either the CR-ON N.O. contact 11-14 or the "
            "CR-BP N.O. contact 21-24, and sent out through the 5-pin receptacle to the drive "
            "cards. When RUN is energized the machine runs."),
    "110": ("control", "24VDC",
            "The start/stop signal net shared between machines. It ties together the CR-SW "
            "N.O. contact 14, the CR-ON coil return A2, the CR-BP N.C. contact 12, the infeed "
            "interface and the four points of terminal block 110. Pulling 110 down to 0V "
            "energizes the CR-ON coil and runs the machine."),
    "111": ("control", "24VDC",
            "The start/stop signal passed out to the downstream (discharge) machine, taken "
            "from net 110 through the CR-BP normally-closed contact 11-12."),
    "120": ("control", "24VDC",
            "The start/stop permissive net. It is pulled to 0V only when BOTH CR1 and CR2 "
            "N.O. contacts are closed, i.e. when both start/stop buttons are on. It also "
            "appears on both machine interfaces."),
    "121": ("control", "24VDC",
            "The link between the CR1 N.O. contact 14 and the CR2 N.O. contact 11 - the "
            "midpoint of the two-relay series start/stop chain."),
    "125": ("control", "24VDC",
            "The CR-BP coil return, from coil terminal A2 through the BYPASS breaker/switch "
            "to net 120."),
    "130": ("control", "24VDC",
            "The CR-SW coil return, from coil terminal A2 to terminal block 130 and out to "
            "both machine interfaces. It only completes through the downstream machine."),
    # These two nets are printed on the drawing simply as "PB1" and "PB2", but the graph
    # already uses those names for the push-button components, so the nets are prefixed.
    "NET-PB1": ("control", "24VDC",
                "The switched 24V output of start/stop switch PB1, feeding the CR1 coil. "
                "The drawing prints this net designator simply as PB1 (black 22AWG)."),
    "NET-PB2": ("control", "24VDC",
                "The switched 24V output of start/stop switch PB2, feeding the CR2 coil. "
                "The drawing prints this net designator simply as PB2 (black 22AWG)."),
    "PB1-SP": ("control", None,
               "The spare conductor of the PB1 start/stop cable, landed on terminal PB1-SP "
               "and not used elsewhere on this drawing."),
    "PB2-SP": ("control", None,
               "The spare conductor of the PB2 start/stop cable, landed on terminal PB2-SP "
               "and not used elsewhere on this drawing."),
    "IINSP1": ("control", None,
               "Infeed inspection signal 1, from the infeed interface to terminal IINSP1."),
    "IINSP2": ("control", None,
               "Infeed inspection signal 2, from the infeed interface to terminal IINSP2."),
    "DINSP1": ("control", None,
               "Discharge inspection signal 1, from the discharge interface to terminal "
               "DINSP1."),
    "DINSP2": ("control", None,
               "Discharge inspection signal 2, from the discharge interface to terminal "
               "DINSP2."),
}

# ---------------------------------------------------------------------------------------
# Wires:  (from, to, colour, gauge, net, cable, note)
# Colours/gauges are exactly as printed. Where a single continuous run carries two colour
# callouts on the drawing (panel wire at one end, cordset conductor at the other) the note
# records the second callout.
# ---------------------------------------------------------------------------------------
W = [
    # 115VAC input
    ("PLG1:B", "TB-L1:1", "BLACK", "10AWG", "L1", "CABLE-POWER-IN", ""),
    ("PLG1:W", "TB-N:1", "WHITE", "10AWG", "N", "CABLE-POWER-IN", ""),
    ("PLG1:G", "TB-GND-A:1", "GREEN", "10AWG", "GND", "CABLE-POWER-IN", ""),
    ("PLG2:B", "TB-L1:1", "BLACK", "10AWG", "L1", "CABLE-POWER-OUT", ""),
    ("PLG2:W", "TB-N:1", "WHITE", "10AWG", "N", "CABLE-POWER-OUT", ""),
    ("PLG2:G", "TB-GND-A:1", "GREEN", "10AWG", "GND", "CABLE-POWER-OUT", ""),
    ("TB-L1:1", "DISC1:L1", "BLACK", "12AWG", "L1", None, ""),
    ("TB-N:1", "DISC1:L3", "WHITE", "12AWG", "N", None, ""),
    ("DISC1:T1", "CB1:1", "BLACK", "12AWG", "L1-A", None, ""),
    ("CB1:2", "PS1:L1", "BLACK", "12AWG", "L1-A1", None, ""),
    ("DISC1:T3", "PS1:N", "WHITE", "12AWG", "N-1", None, ""),
    ("TB-GND-A:1", "EARTH:1", None, None, "GND", None, "Earth ground symbol."),
    ("DOOR-GND:1", "TB-GND-B:1", "GREEN", "12AWG", "GND", None, ""),
    ("TB-GND-B:2", "PS1:GND", "GREEN", "12AWG", "GND", None, ""),
    ("TB-GND-B:2", "EARTH:2", None, None, "GND", None, "Earth ground symbol."),
    # 24VDC generation
    ("PS1:+", "CB2:1", "BLUE", "12AWG", "+24V", None, ""),
    ("CB2:2", "TB-24E1-A:1", "BLUE", "12AWG", "24E-1", None, ""),
    ("PS1:-1", "TB-0V:1", "WHITE/BLUE", "12AWG", "0V", None, ""),
    ("PS1:-2", "TB-0V:2", "WHITE/BLUE", "12AWG", "0V", None, ""),
    # 24VDC distribution from the main block
    ("TB-24E1-A:2", "TB-24E1-B:1", "BLUE", "12AWG", "24E-1", None, ""),
    ("TB-24E1-A:3", "PB1:1", "BROWN", "22AWG", "24E-1", "CABLE-PB1-START-STOP", ""),
    ("TB-24E1-A:4", "PB2:1", "BROWN", "22AWG", "24E-1", "CABLE-PB2-START-STOP", ""),
    ("TB-24E1-A:5", "LT1:BLACK", "BLACK", "22AWG", "24E-1", "CABLE-LT1", ""),
    ("TB-24E1-A:6", "CR-ON:A1", "BLUE", "18AWG", "24E-1", None,
     "Labelled BLUE 12AWG at the terminal-block end and BLUE 18AWG at the coil end."),
    ("TB-24E1-A:7", "CR-BP:A1", "BLUE", "18AWG", "24E-1", None,
     "Labelled BLUE 12AWG at the terminal-block end and BLUE 18AWG at the coil end."),
    ("TB-24E1-A:8", "CR-SW:A1", "BLUE", "18AWG", "24E-1", None,
     "Labelled BLUE 12AWG at the terminal-block end and BLUE 18AWG at the coil end."),
    # 24VDC distribution from the secondary block
    ("TB-24E1-B:1", "REVERSE-CB:1", "BLUE", "18AWG", "24E-1", None, ""),
    ("TB-24E1-B:2", "SPD1:1", "BLUE", "18AWG", "24E-1", None, ""),
    ("TB-24E1-B:3", "CR-ON:11", "BLUE", "18AWG", "24E-1", None, ""),
    ("TB-24E1-B:4", "CR-BP:21", "BLUE", "18AWG", "24E-1", None, ""),
    ("TB-24E1-B:5", "RECEPT1:5", "RED", "18AWG", "24E-1", None,
     "Labelled RED 18AWG at the terminal-block end and BLUE 18AWG at the receptacle end "
     "(the receptacle end callout is the M12 cordset conductor colour)."),
    # speed / direction
    ("SPD1:3", "TB-SPD:1", "BLUE", "18AWG", "SPD", None, ""),
    ("TB-SPD:1", "RECEPT1:1", "BROWN", "18AWG", "SPD", "CABLE-RECEPT1", ""),
    ("REVERSE-CB:2", "TB-DIR:1", "BLUE", "18AWG", "DIR", None, ""),
    ("TB-DIR:1", "RECEPT1:2", "GREEN", "18AWG", "DIR", "CABLE-RECEPT1",
     "Labelled GREEN 18AWG at the terminal-block end and GREY 18AWG at the receptacle end "
     "(the receptacle end callout is the M12 cordset conductor colour)."),
    ("SPD1:2", "TB-0V:3", "WHITE/BLUE", "18AWG", "0V", None, ""),
    ("TB-0V:4", "RECEPT1:4", "WHITE", "18AWG", "0V", "CABLE-RECEPT1", ""),
    # start/stop switches
    ("PB1:2", "TB-PB1SP:1", "WHITE", "22AWG", "PB1-SP", "CABLE-PB1-START-STOP", ""),
    ("PB1:3", "TB-0V:5", "BLUE", "22AWG", "0V", "CABLE-PB1-START-STOP", ""),
    ("PB1:4", "CR1:A1", "BLACK", "22AWG", "NET-PB1", "CABLE-PB1-START-STOP", ""),
    ("PB2:2", "TB-PB2SP:1", "WHITE", "22AWG", "PB2-SP", "CABLE-PB2-START-STOP", ""),
    ("PB2:3", "TB-0V:6", "BLUE", "22AWG", "0V", "CABLE-PB2-START-STOP", ""),
    ("PB2:4", "CR2:A1", "BLACK", "22AWG", "NET-PB2", "CABLE-PB2-START-STOP", ""),
    ("LT1:BLUE", "TB-0V:7", "BLUE", "22AWG", "0V", "CABLE-LT1", ""),
    # relay coil returns
    ("CR1:A2", "TB-0V:8", "WHITE/BLUE", "18AWG", "0V", None, ""),
    ("CR2:A2", "TB-0V:9", "WHITE/BLUE", "18AWG", "0V", None, ""),
    ("CR-ON:A2", "TB-110:3", "BLUE", "18AWG", "110", None, ""),
    ("CR-BP:A2", "BYPASS-CB:2", "BLUE", "18AWG", "125", None, ""),
    ("CR-SW:A2", "TB-130:1", "BLUE", "18AWG", "130", None, ""),
    # start/stop series permissive chain
    ("TB-0V:10", "CR1:11", "WHITE/BLUE", "18AWG", "0V", None, ""),
    ("CR1:14", "CR2:11", "BLUE", "18AWG", "121", None, ""),
    ("CR2:14", "TB-120:1", "BLUE", "18AWG", "120", None,
     "Labelled BLUE 18AWG at the contact end and RED 16AWG at the terminal-block end."),
    ("TB-120:3", "BYPASS-CB:1", "BLUE", "18AWG", "120", None, ""),
    # run circuit
    ("CR-ON:14", "TB-RUN:1", "BLUE", "18AWG", "RUN", None, ""),
    ("CR-BP:24", "TB-RUN:1", "BLUE", "18AWG", "RUN", None, ""),
    ("TB-RUN:1", "RECEPT1:3", "BLACK", "18AWG", "RUN", "CABLE-RECEPT1", ""),
    # net 110 / 111
    ("TB-0V:11", "CR-SW:11", "WHITE/BLUE", "18AWG", "0V", None, ""),
    ("CR-SW:14", "TB-110:1", "BLUE", "18AWG", "110", None, ""),
    ("INFEED1:1", "TB-110:2", "BLUE", "16AWG", "110", "CABLE-INFEED1", ""),
    ("CR-BP:12", "TB-110:4", "BLUE", "18AWG", "110", None, ""),
    ("DISCHARGE1:1", "CR-BP:11", "BLUE", "16AWG", "111", "CABLE-DISCHARGE1", ""),
    # machine interfaces
    ("INFEED1:2", "TB-0V:12", "GREEN", "16AWG", "0V", "CABLE-INFEED1", ""),
    ("INFEED1:3", "TB-120:2", "RED", "16AWG", "120", "CABLE-INFEED1", ""),
    ("INFEED1:4", "TB-130:2", "ORANGE", "16AWG", "130", "CABLE-INFEED1", ""),
    ("INFEED1:5", "TB-IINSP1:1", "BLACK", "16AWG", "IINSP1", "CABLE-INFEED1", ""),
    ("INFEED1:6", "TB-IINSP2:1", "WHITE", "16AWG", "IINSP2", "CABLE-INFEED1", ""),
    ("DISCHARGE1:2", "TB-0V:12", "GREEN", "16AWG", "0V", "CABLE-DISCHARGE1", ""),
    ("DISCHARGE1:3", "TB-120:2", "RED", "16AWG", "120", "CABLE-DISCHARGE1", ""),
    ("DISCHARGE1:4", "TB-130:2", "ORANGE", "16AWG", "130", "CABLE-DISCHARGE1", ""),
    ("DISCHARGE1:5", "TB-DINSP1:1", "BLACK", "16AWG", "DINSP1", "CABLE-DISCHARGE1", ""),
    ("DISCHARGE1:6", "TB-DINSP2:1", "WHITE", "16AWG", "DINSP2", "CABLE-DISCHARGE1", ""),
]

CABLES = {
    "CABLE-POWER-IN": "POWER IN 115VAC cable to plug PLG1 (LEV2611): black 10AWG line, "
                      "white 10AWG neutral, green 10AWG ground.",
    "CABLE-POWER-OUT": "POWER OUT 115VAC cable to plug PLG2 (LEV2613): black 10AWG line, "
                       "white 10AWG neutral, green 10AWG ground.",
    "CABLE-PB1-START-STOP": "PB1 start/stop cable: brown 22AWG (+24V in), white 22AWG "
                            "(spare, to PB1-SP), blue 22AWG (0V), black 22AWG (switched "
                            "signal out to the CR1 coil).",
    "CABLE-PB2-START-STOP": "PB2 start/stop cable: brown 22AWG (+24V in), white 22AWG "
                            "(spare, to PB2-SP), blue 22AWG (0V), black 22AWG (switched "
                            "signal out to the CR2 coil).",
    "CABLE-LT1": "Circuit 1 light cable: black 22AWG (24E-1) and blue 22AWG (0V) are used; "
                 "brown 22AWG and white 22AWG are NOT CONNECTED and must be removed at the "
                 "insulation with the exposed end heat-shrunk.",
    "CABLE-RECEPT1": "5-pin micro (M12) cordset at the external device receptacle: brown "
                     "18AWG (SPD), white 18AWG (0V), blue 18AWG (24E-1), black 18AWG (RUN), "
                     "grey 18AWG (DIR).",
    "CABLE-INFEED1": "Infeed interface #1 6-pin mini cable: blue 16AWG (110), green 16AWG "
                     "(0V), red 16AWG (120), orange 16AWG (130), black 16AWG (IINSP1), "
                     "white 16AWG (IINSP2).",
    "CABLE-DISCHARGE1": "Discharge interface #1 6-pin mini cable: blue 16AWG (111), green "
                        "16AWG (0V), red 16AWG (120), orange 16AWG (130), black 16AWG "
                        "(DINSP1), white 16AWG (DINSP2).",
}

SUBSYSTEMS = {
    "SUB-115VAC-INPUT": ("115VAC single-phase input and isolation section: the supply plugs, "
                         "the L1/N/GND terminals, the panel disconnect and breaker CB1.",
                         ["PLG1", "PLG2", "TB-L1", "TB-N", "TB-GND-A", "DISC1", "CB1"]),
    "SUB-24VDC-SUPPLY": ("24VDC generation and distribution section: the power supply, its "
                         "output breaker, the two 24E-1 distribution terminal blocks and the "
                         "0V common strip.",
                         ["PS1", "CB2", "TB-GND-B", "DOOR-GND", "EARTH", "TB-24E1-A",
                          "TB-24E1-B", "TB-0V"]),
    "SUB-OPERATOR-CONTROL": ("Operator start/stop control: both lighted start/stop switches, "
                             "their spare terminals, the relays they drive and the circuit-1 "
                             "indicator light.",
                             ["PB1", "PB2", "TB-PB1SP", "TB-PB2SP", "CR1", "CR2", "LT1",
                              "TB-120"]),
    "SUB-BYPASS": ("Bypass control circuit: the bypass breaker used as a manual switch and "
                   "the run bypass relay it energizes.",
                   ["BYPASS-CB", "CR-BP"]),
    "SUB-RUN-CONTROL": ("Run control circuit: the run relay, the switch relay, the run "
                        "terminal and the 110/130 signal terminal blocks.",
                        ["CR-ON", "CR-SW", "TB-RUN", "TB-110", "TB-130"]),
    "SUB-SPEED-DIRECTION": ("Speed and direction section: the speed controller, the reverse "
                            "breaker used as a manual switch, and their signal terminals.",
                            ["SPD1", "TB-SPD", "REVERSE-CB", "TB-DIR"]),
    "SUB-MACHINE-INTERFACE": ("External and machine-to-machine interfaces: the 5-pin device "
                              "receptacle, the infeed and discharge 6-pin interfaces and the "
                              "inspection-signal terminals.",
                              ["RECEPT1", "INFEED1", "DISCHARGE1", "TB-IINSP1", "TB-IINSP2",
                               "TB-DINSP1", "TB-DINSP2"]),
}

# ---------------------------------------------------------------------------------------
# Build the master document
# ---------------------------------------------------------------------------------------
terminals = [
    {"id": f"{c}:{t}", "parent_component": c, "function": fn, "net": net}
    for c, t, fn, net in T
]

net_members = {}
for t in terminals:
    if t["net"]:
        net_members.setdefault(t["net"], []).append(t["id"])

nets = [
    {"id": nid, "signal_type": st, "nominal_voltage": nv,
     "member_terminals": sorted(net_members.get(nid, [])), "description": desc}
    for nid, (st, nv, desc) in NETS.items()
]

wires = []
for i, (frm, to, colour, gauge, net, cable, note) in enumerate(W, start=1):
    wires.append({
        "id": f"W{i:03d}", "color": colour, "gauge": gauge,
        "from_terminal": frm, "to_terminal": to, "cable": cable, "net": net,
        "description": note,
    })

cable_members = {}
for w in wires:
    if w["cable"]:
        cable_members.setdefault(w["cable"], []).append(w["id"])
cables = [
    {"id": cid, "description": desc, "member_wires": sorted(cable_members.get(cid, []))}
    for cid, desc in CABLES.items()
]

subsystems = [
    {"id": sid, "description": desc, "member_components": members}
    for sid, (desc, members) in SUBSYSTEMS.items()
]

# --- derived edges -----------------------------------------------------------------------
R = []


def rel(rtype, src, tgt, desc, props=None):
    R.append({"type": rtype, "src": src, "tgt": tgt, "description": desc,
              "properties": props or {}})


comp_by_id = {c["id"]: c for c in C}
net_by_id = {n["id"]: n for n in nets}

for t in terminals:
    parent = comp_by_id[t["parent_component"]]
    tname = t["id"].split(":", 1)[1]
    rel("HAS_TERMINAL", t["parent_component"], t["id"],
        f"{parent['id']} ({parent['class'].replace('_', ' ')}) has terminal {tname}, which "
        f"serves as a {t['function'].replace('_', ' ')} connection point.")

for t in terminals:
    if not t["net"]:
        continue
    n = net_by_id[t["net"]]
    volts = f" at {n['nominal_voltage']}" if n["nominal_voltage"] else ""
    rel("ON_NET", t["id"], t["net"],
        f"Terminal {t['id']} is electrically common with net {t['net']}{volts}. A fault or "
        f"signal on net {t['net']} is seen at this terminal.")

for w in wires:
    spec = " ".join(x for x in [w["color"], w["gauge"]] if x) or "an unlabelled conductor"
    extra = f" {w['description']}" if w["description"] else ""
    cable = f" It is part of cable {w['cable']}." if w["cable"] else ""
    rel("CONNECTS_TO", w["from_terminal"], w["to_terminal"],
        f"{w['from_terminal']} connects to {w['to_terminal']} via wire {w['id']}, "
        f"a {spec} conductor on net {w['net']}.{cable}{extra}",
        {"wire": w["id"], "wire_color": w["color"], "wire_gauge": w["gauge"],
         "net": w["net"], "cable": w["cable"]})

for s in subsystems:
    for m in s["member_components"]:
        rel("PART_OF", m, s["id"],
            f"{m} is part of the {s['description'].split(':')[0].lower()} "
            f"({s['id']}) of drawing {DRAWING_NO}.")

# --- authored edges ----------------------------------------------------------------------
rel("POWERS", "PS1", "24E-1",
    "Power supply PS1 converts the 115VAC input to 24VDC and supplies the 24E-1 distribution "
    "bus through circuit breaker CB2. Everything on 24E-1 loses power if PS1 fails.")
rel("POWERS", "PS1", "0V",
    "Both minus terminals of power supply PS1 establish the 0V DC common for the assembly.")
rel("POWERS", "PLG1", "L1",
    "Input plug PLG1 brings the 115VAC line supply onto net L1.")
rel("POWERS", "TB-L1", "PLG2",
    "The L1 terminal feeds output plug PLG2, passing 115VAC through to the next machine.")
rel("POWERS", "24E-1", "SPD1",
    "The 24E-1 bus supplies the speed controller SPD1.")
rel("POWERS", "24E-1", "LT1",
    "The 24E-1 bus supplies the circuit 1 indicator light, so LT1 being lit shows the 24VDC "
    "control circuit is live.")
rel("POWERS", "24E-1", "RECEPT1",
    "The 24E-1 bus supplies 24VDC out through pin 5 of the external 5-pin receptacle.")

rel("PROTECTS", "CB1", "PS1",
    "Circuit breaker CB1 (8A) is the over-current protection for the 115VAC feed to power "
    "supply PS1. If CB1 trips, PS1 loses its input and the entire 24VDC system goes dead.")
rel("PROTECTS", "CB2", "24E-1",
    "Circuit breaker CB2 (20A) is the over-current protection for the whole 24VDC "
    "distribution bus. If CB2 trips, everything on net 24E-1 loses power: both start/stop "
    "switches, the circuit 1 light, the speed controller, all relay coils and the external "
    "receptacle.")
rel("PROTECTS", "DISC1", "SUB-24VDC-SUPPLY",
    "The panel disconnect DISC1 isolates the 115VAC supply to the power supply section for "
    "servicing. It is an isolation device, not an over-current device.")

rel("ACTUATES", "PB1", "CR1",
    "Start/stop switch PB1 actuates relay CR1: pressing PB1 puts 24VDC on net NET-PB1 "
    "(printed on the drawing as PB1), which energizes the CR1 coil at terminal A1.")
rel("ACTUATES", "PB2", "CR2",
    "Start/stop switch PB2 actuates relay CR2: pressing PB2 puts 24VDC on net NET-PB2 "
    "(printed on the drawing as PB2), which energizes the CR2 coil at terminal A1.")
rel("ACTUATES", "BYPASS-CB", "CR-BP",
    "The BYPASS 5A breaker is used as a manual switch, not as over-current protection. "
    "Closing it connects the CR-BP coil return (net 125) to net 120. CR-BP energizes only "
    "when the bypass switch is closed AND net 120 is pulled to 0V, which requires both CR1 "
    "and CR2 to be energized - that is, both start/stop buttons on.")
rel("ACTUATES", "REVERSE-CB", "DIR",
    "The REVERSE 5A breaker is used as a manual switch, not as over-current protection. "
    "Closing it puts 24VDC from the 24E-1 bus onto the DIR net, which commands the drive "
    "cards to run in reverse.")
rel("ACTUATES", "DOWNSTREAM-MACHINE", "CR-SW",
    "The CR-SW coil return is net 130, which leaves this drawing at the discharge interface. "
    "Only the downstream (subordinate) machine can complete that return, so CR-SW cannot be "
    "energized by anything shown on this sheet alone.")

rel("COIL_CONTROLS_CONTACT", "CR1", "CR1:14",
    "Energizing the CR1 coil (A1-A2) closes its normally-open contact 11-14, connecting 0V "
    "through to net 121. This is the first half of the two-relay series start/stop chain.")
rel("COIL_CONTROLS_CONTACT", "CR2", "CR2:14",
    "Energizing the CR2 coil (A1-A2) closes its normally-open contact 11-14, connecting net "
    "121 through to net 120. With CR1 also energized, this pulls net 120 down to 0V.")
rel("COIL_CONTROLS_CONTACT", "CR-ON", "CR-ON:14",
    "Energizing the CR-ON coil (A1-A2) closes its normally-open contact 11-14, putting 24VDC "
    "from the 24E-1 bus onto the RUN net. The RUN signal reaches the drive cards through the "
    "5-pin receptacle and the machine runs.")
rel("COIL_CONTROLS_CONTACT", "CR-BP", "CR-BP:24",
    "Energizing the CR-BP coil (A1-A2) closes its normally-open contact 21-24, putting 24VDC "
    "from the 24E-1 bus directly onto the RUN net. This is the bypass path: it runs the "
    "machine without CR-ON.")
rel("COIL_CONTROLS_CONTACT", "CR-BP", "CR-BP:12",
    "Energizing the CR-BP coil (A1-A2) OPENS its normally-closed contact 11-12, breaking the "
    "link between net 111 (the signal from the discharge interface) and net 110. While CR-BP "
    "is de-energized this contact is closed and 111 is tied to 110.")
rel("COIL_CONTROLS_CONTACT", "CR-SW", "CR-SW:14",
    "Energizing the CR-SW coil (A1-A2) closes its normally-open contact 11-14, pulling net "
    "110 down to 0V. That energizes the CR-ON coil and runs the machine.")

rel("ACTUATES", "110", "CR-ON",
    "The CR-ON coil sits between the 24E-1 bus (terminal A1) and net 110 (terminal A2). "
    "Pulling net 110 down to 0V - by the CR-SW contact 11-14, by the infeed interface, or "
    "through the CR-BP normally-closed contact from net 111 - energizes CR-ON and runs the "
    "machine.")

rel("GROUNDED_TO", "TB-GND-A", "EARTH",
    "The plug ground terminal is bonded to protective earth.")
rel("GROUNDED_TO", "TB-GND-B", "EARTH",
    "The door/power-supply ground terminal is bonded to protective earth.")
rel("GROUNDED_TO", "PS1", "EARTH",
    "The power supply chassis ground terminal is bonded to protective earth through the GND "
    "terminal block.")

for ref in drawing["references"]:
    rel("REFERENCES", DRAWING_NO, ref,
        f"This drawing references external device connection drawing {ref} for the devices "
        f"that connect through the 5-pin micro receptacle. Those connections are not "
        f"documented on this sheet.")
rel("REFERENCES", "RECEPT1", "MXCS-P9",
    "The 5-pin micro receptacle is the boundary of this drawing; what connects beyond it is "
    "documented on drawings MXCS-M9, MXCS-M11, MXCS-P9 and MXCS-P11.")
rel("REFERENCES", "INFEED1", "UPSTREAM-MACHINE",
    "Infeed interface #1 is the boundary to the upstream (previous) machine. This sheet is "
    "the master machine, so in a typical installation there may be no previous machine, and "
    "the infeed side of net 110 is then open.")
rel("REFERENCES", "DISCHARGE1", "DOWNSTREAM-MACHINE",
    "Discharge interface #1 is the boundary to the downstream (subordinate) machine. Nets "
    "111, 120, 130, 0V, DINSP1 and DINSP2 continue onto that machine's drawing, which is not "
    "part of this sheet.")

master = {
    "drawing": drawing,
    "components": C,
    "terminals": terminals,
    "nets": nets,
    "wires": wires,
    "cables": cables,
    "subsystems": subsystems,
    "relationships": R,
}

OUT.write_text(json.dumps(master, indent=2))
print(f"Wrote {OUT}")
print(f"  components    {len(C)}")
print(f"  terminals     {len(terminals)}")
print(f"  nets          {len(nets)}")
print(f"  wires         {len(wires)}")
print(f"  cables        {len(cables)}")
print(f"  subsystems    {len(subsystems)}")
print(f"  relationships {len(R)}")
