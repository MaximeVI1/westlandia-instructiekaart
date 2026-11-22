#!/usr/bin/env python3
"""Maakt de eigen tekeningen (popjes in één stijl) als svg, met index.json erbij.

Gebruik:  python3 src/figuren/eigen/teken.py     (daarna python3 bouw.py)

Elke tekening is 200 x 200 met dezelfde bouwstenen: een popje (hoofd, romp, armen, benen),
grijze voorwerpen, een rode ster waar het pijn doet, en een gekleurd kader:
geel = gevaar of ongeval, groen met vinkje = zo wel, rood met kruisje = zo niet.
Een tekening toevoegen: schrijf een functie zoals hieronder en zet ze in TEKENINGEN.
"""
import json
import math
import pathlib

MAP = pathlib.Path(__file__).resolve().parent

INKT, GRIJS, LICHT = "#1c2330", "#8a93a0", "#dfe3e8"
ROOD, GEEL, BLAUW, GROEN = "#d6332a", "#f9a800", "#2f8fd0", "#237f52"


# ---------- bouwstenen ----------

def lijn(punten, dikte, kleur=INKT):
    pad = " ".join(f"{x:g},{y:g}" for x, y in punten)
    return (f'<polyline points="{pad}" fill="none" stroke="{kleur}" stroke-width="{dikte}" '
            'stroke-linecap="round" stroke-linejoin="round"/>')


def vlak(x, y, b, h, kleur=LICHT, rand=GRIJS, r=4, draai=0):
    extra = f' transform="rotate({draai} {x + b / 2:g} {y + h / 2:g})"' if draai else ""
    return (f'<rect x="{x:g}" y="{y:g}" width="{b:g}" height="{h:g}" rx="{r}" fill="{kleur}" '
            f'stroke="{rand}" stroke-width="4" stroke-linejoin="round"{extra}/>')


def rond(x, y, r, kleur=GRIJS, rand=None):
    streep = f' stroke="{rand}" stroke-width="4"' if rand else ""
    return f'<circle cx="{x:g}" cy="{y:g}" r="{r:g}" fill="{kleur}"{streep}/>'


def ovaal(x, y, rx, ry, kleur=BLAUW):
    return f'<ellipse cx="{x:g}" cy="{y:g}" rx="{rx:g}" ry="{ry:g}" fill="{kleur}"/>'


def vloer(x0=16, x1=184, y=174):
    return lijn([(x0, y), (x1, y)], 4, GRIJS)


def ster(x, y, r=13, kleur=ROOD):
    """Stervormige vlek: hier doet het pijn of gebeurt de botsing."""
    punten = []
    for i in range(16):
        hoek = math.pi * i / 8 - math.pi / 2
        straal = r if i % 2 == 0 else r * 0.5
        punten.append(f"{x + straal * math.cos(hoek):.1f},{y + straal * math.sin(hoek):.1f}")
    return (f'<polygon points="{" ".join(punten)}" fill="{kleur}" stroke="#fff" stroke-width="2" '
            'stroke-linejoin="round"/>')


def druppels(punten, kleur=BLAUW, r=3.2):
    return "".join(rond(x, y, r, kleur) for x, y in punten)


def vaart(lijnen, kleur=GRIJS):
    """Korte streepjes die beweging tonen."""
    return "".join(lijn(l, 3.5, kleur) for l in lijnen)


def pop(schouder, heup, armen, benen, hoofd=None, kleur=INKT):
    """Een popje. armen: [[elleboog, hand], ...]; benen: [[knie, voet], ...].
    Zonder opgegeven hoofd staat het in het verlengde van de romp."""
    if hoofd is None:
        dx, dy = schouder[0] - heup[0], schouder[1] - heup[1]
        lengte = math.hypot(dx, dy)
        hoofd = (schouder[0] + dx / lengte * 25, schouder[1] + dy / lengte * 25)
    delen = [lijn([heup] + been, 12, kleur) for been in benen]
    delen.append(lijn([schouder, heup], 21, kleur))
    delen += [lijn([schouder] + arm, 10, kleur) for arm in armen]
    delen.append(rond(hoofd[0], hoofd[1], 12.5, kleur))
    return "".join(delen)


def staand(x, armen, y=0, spreid=7):
    """Een rechtopstaand popje met de voeten op de vloer."""
    return pop((x, 78 + y), (x, 122 + y), armen,
               [[(x - spreid, 148 + y), (x - spreid - 1, 172)], [(x + spreid, 148 + y), (x + spreid + 1, 172)]])


def ballon(x, y, b, h, tekst, punt, kleur=ROOD):
    """Tekstballon met een korte tekst en een puntje naar de spreker."""
    return (f'<path d="M{punt[0]:g},{punt[1]:g} L{x + b * 0.35:g},{y + h:g} L{x + b * 0.6:g},{y + h:g} Z" fill="#fff" '
            f'stroke="{INKT}" stroke-width="4" stroke-linejoin="round"/>'
            + vlak(x, y, b, h, "#fff", INKT, 10)
            + f'<rect x="{x + b * 0.37:g}" y="{y + h - 3:g}" width="{b * 0.21:g}" height="6" fill="#fff"/>'
            + f'<text x="{x + b / 2:g}" y="{y + h * 0.72:g}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" '
              f'font-weight="700" font-size="{h * 0.62:g}" fill="{kleur}">{tekst}</text>')


def kader(soort):
    kleur = {"gevaar": GEEL, "goed": GROEN, "fout": ROOD}[soort]
    uit = f'<rect x="5" y="5" width="190" height="190" rx="22" fill="#fff" stroke="{kleur}" stroke-width="8"/>'
    return uit, kleur


def kenteken(soort, kleur):
    """Vinkje (zo wel) of kruisje (zo niet) in de hoek."""
    if soort == "gevaar":
        return ""
    teken = "M157,36 l6,7 l11,-13" if soort == "goed" else "M158,28 l14,14 M172,28 l-14,14"
    return (rond(165, 35, 17, kleur) + f'<path d="{teken}" fill="none" stroke="#fff" stroke-width="5" '
            'stroke-linecap="round" stroke-linejoin="round"/>')


# ---------- gevaren en ongevallen ----------

def uitglijden():
    return [vloer(), ovaal(126, 175, 48, 6),
            pop((74, 92), (98, 124), [[(92, 76), (108, 60)], [(54, 102), (42, 120)]],
                [[(126, 120), (152, 104)], [(122, 144), (148, 166)]]),
            vaart([[(160, 150), (174, 144)], [(164, 164), (178, 162)], [(158, 92), (170, 84)]])]


def struikelen():
    return [vloer(), vlak(40, 152, 30, 20),
            pop((122, 94), (92, 118), [[(142, 104), (160, 116)], [(136, 114), (150, 132)]],
                [[(74, 138), (62, 150)], [(108, 142), (114, 170)]]),
            ster(60, 148, 11)]


def val_van_ladder():
    rail1, rail2 = [(36, 172), (80, 26)], [(60, 172), (104, 26)]
    sporten = []
    for t in (0.14, 0.31, 0.48, 0.65, 0.82):
        p = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for a, b in (rail1, rail2)]
        sporten.append(lijn(p, 4, GRIJS))
    return [vloer(), lijn(rail1, 5, GRIJS), lijn(rail2, 5, GRIJS), *sporten,
            pop((150, 104), (128, 126), [[(150, 82), (138, 66)], [(170, 112), (184, 102)]],
                [[(112, 114), (98, 128)], [(126, 148), (112, 162)]]),
            vaart([[(146, 36), (146, 52)], [(164, 44), (164, 60)], [(128, 50), (128, 64)]])]


def vallend_voorwerp():
    return [vloer(),
            pop((88, 90), (88, 130), [[(72, 84), (76, 62)], [(104, 84), (100, 62)]],
                [[(81, 152), (80, 172)], [(95, 152), (96, 172)]], hoofd=(88, 66)),
            vlak(104, 24, 30, 26, draai=18), vaart([[(144, 20), (144, 34)], [(154, 28), (154, 40)]]),
            ster(98, 52, 11)]


def hand_gekneld():
    return [vloer(), vlak(126, 78, 56, 96, r=6), rond(150, 108, 15, GRIJS, INKT), rond(150, 140, 15, GRIJS, INKT),
            rond(150, 108, 3, INKT), rond(150, 140, 3, INKT),
            pop((70, 78), (68, 122), [[(98, 100), (132, 123)], [(58, 100), (56, 120)]],
                [[(61, 148), (60, 172)], [(75, 148), (76, 172)]]),
            ster(133, 124, 13)]


def snijwonde():
    return [vloer(), lijn([(98, 122), (184, 122)], 6, GRIJS), lijn([(108, 124), (108, 172)], 5, GRIJS),
            lijn([(174, 124), (174, 172)], 5, GRIJS), vlak(144, 92, 32, 28),
            pop((66, 78), (64, 122), [[(92, 98), (120, 114)], [(88, 88), (106, 96)]],
                [[(57, 148), (56, 172)], [(71, 148), (72, 172)]]),
            '<path d="M106,96 L128,104 L112,108 Z" fill="#b9c0c9" stroke="%s" stroke-width="2.5" stroke-linejoin="round"/>' % INKT,
            ster(124, 114, 11), druppels([(122, 134), (128, 146)], ROOD, 3.4)]


def aanrijding():
    truck = [vlak(20, 112, 58, 40, GEEL, INKT, 6), lijn([(30, 112), (30, 78), (66, 78), (72, 112)], 5),
             lijn([(88, 66), (88, 160)], 6, GRIJS), lijn([(88, 158), (118, 158)], 5, GRIJS),
             rond(36, 160, 12, INKT), rond(68, 160, 12, INKT), rond(36, 160, 4, LICHT), rond(68, 160, 4, LICHT)]
    return [vloer(), *truck,
            pop((152, 88), (154, 130), [[(136, 86), (126, 68)], [(166, 100), (172, 118)]],
                [[(148, 152), (144, 172)], [(162, 152), (166, 172)]], hoofd=(151, 64)),
            ster(124, 132, 13)]


def brandwonde():
    golven = "".join(
        f'<path d="M{x},110 q-7,-8 0,-16 q7,-8 0,-16" fill="none" stroke="{ROOD}" stroke-width="4" stroke-linecap="round"/>'
        for x in (140, 156, 172))
    return [vloer(), vlak(112, 118, 68, 12, INKT, INKT, 3), lijn([(122, 132), (122, 172)], 5, GRIJS),
            lijn([(170, 132), (170, 172)], 5, GRIJS), golven,
            pop((68, 78), (66, 122), [[(94, 100), (116, 113)], [(56, 100), (52, 120)]],
                [[(59, 148), (58, 172)], [(73, 148), (74, 172)]]),
            ster(118, 110, 12)]


def spatten_in_ogen():
    return [vloer(),
            pop((90, 86), (90, 128), [[(110, 104), (128, 108)], [(104, 112), (126, 118)]],
                [[(83, 152), (82, 172)], [(97, 152), (98, 172)]], hoofd=(90, 62)),
            vlak(124, 96, 18, 26, GEEL, INKT, 4), vlak(129, 86, 8, 10, GEEL, INKT, 2),
            druppels([(126, 76), (118, 68), (136, 68), (144, 56), (128, 54)], GEEL, 3.4),
            ster(106, 56, 10)]


def elektrische_schok():
    schok = "".join(lijn(p, 4, GEEL) for p in (
        [(36, 84), (46, 94), (36, 104), (46, 114)], [(64, 40), (74, 32), (84, 42), (94, 32)],
        [(118, 124), (128, 132), (118, 142), (128, 150)]))
    return [vloer(), vlak(150, 72, 32, 56, r=5),
            f'<path d="M170,82 L160,102 H168 L162,120 L176,98 H168 Z" fill="{GEEL}" stroke="{INKT}" stroke-width="2" stroke-linejoin="round"/>',
            pop((84, 88), (84, 130), [[(112, 90), (146, 100)], [(62, 78), (50, 60)]],
                [[(72, 152), (62, 172)], [(96, 152), (106, 172)]], hoofd=(84, 64)),
            schok, ster(146, 100, 11, GEEL)]


def hoofd_stoten():
    return [vloer(), vlak(108, 40, 68, 18, GRIJS, INKT, 3),
            pop((86, 94), (84, 132), [[(74, 110), (70, 126)], [(100, 108), (110, 120)]],
                [[(74, 154), (66, 172)], [(98, 152), (108, 172)]], hoofd=(92, 70)),
            ster(106, 60, 12)]


def rugpijn():
    return [vloer(),
            pop((114, 88), (90, 122), [[(92, 96), (100, 114)], [(124, 110), (120, 130)]],
                [[(86, 148), (84, 172)], [(100, 148), (102, 172)]]),
            ster(76, 104, 13)]


# ---------- zo wel, zo niet ----------

def tillen_fout():
    return [vloer(), vlak(118, 138, 38, 34),
            pop((118, 102), (78, 100), [[(124, 124), (128, 142)], [(116, 126), (120, 144)]],
                [[(76, 138), (76, 172)], [(86, 138), (90, 172)]], hoofd=(142, 110)),
            ster(88, 80, 13)]


def tillen_goed():
    return [vloer(), vlak(114, 116, 38, 34),
            pop((80, 92), (70, 136), [[(98, 110), (116, 122)], [(96, 118), (114, 136)]],
                [[(106, 134), (100, 172)], [(100, 142), (88, 172)]])]


def samen_tillen():
    links = pop((40, 92), (40, 132), [[(50, 110), (62, 118)]], [[(33, 154), (32, 172)], [(47, 154), (48, 172)]], hoofd=(40, 68))
    rechts = pop((144, 92), (144, 132), [[(134, 110), (122, 118)]], [[(137, 154), (136, 172)], [(151, 154), (152, 172)]], hoofd=(144, 68))
    return [vloer(), links, rechts, vlak(58, 106, 68, 24)]


def kar_duwen():
    return [vloer(), vlak(112, 108, 50, 38), lijn([(98, 150), (178, 150)], 7, GRIJS),
            lijn([(98, 150), (92, 104)], 6, GRIJS), rond(112, 163, 8, INKT), rond(164, 163, 8, INKT),
            pop((70, 84), (56, 124), [[(82, 100), (92, 106)], [(80, 106), (93, 114)]],
                [[(72, 148), (70, 172)], [(46, 146), (30, 168)]])]


def handen_wassen():
    return [vloer(), vlak(116, 120, 62, 16), vlak(138, 136, 18, 38),
            f'<path d="M168,120 V98 Q168,88 158,88 H150 V96" fill="none" stroke="{GRIJS}" stroke-width="6" stroke-linecap="round"/>',
            druppels([(150, 104), (150, 113)]),
            pop((72, 80), (70, 124), [[(100, 100), (134, 114)], [(96, 106), (130, 119)]],
                [[(63, 150), (62, 172)], [(77, 150), (78, 172)]]),
            rond(124, 102, 4.5, "#fff", BLAUW), rond(140, 104, 3.5, "#fff", BLAUW)]


def opruimen():
    return [vloer(), ovaal(152, 175, 26, 5),
            lijn([(100, 86), (152, 166)], 5, GRIJS), vlak(138, 162, 30, 10, INKT, INKT, 3),
            pop((76, 82), (72, 126), [[(96, 94), (109, 100)], [(92, 106), (120, 117)]],
                [[(66, 150), (60, 172)], [(84, 150), (90, 172)]])]


def melden():
    return [vloer(),
            pop((56, 94), (56, 134), [[(72, 106), (88, 98)], [(46, 112), (44, 130)]],
                [[(49, 156), (48, 172)], [(63, 156), (64, 172)]], hoofd=(56, 70)),
            pop((136, 94), (136, 134), [[(126, 112), (124, 130)], [(146, 112), (148, 130)]],
                [[(129, 156), (128, 172)], [(143, 156), (144, 172)]], hoofd=(136, 70)),
            ballon(40, 16, 56, 34, "!", (62, 56))]


def hulp_roepen():
    return [vloer(),
            pop((104, 94), (104, 134), [[(86, 100), (92, 76)], [(114, 112), (116, 130)]],
                [[(97, 156), (96, 172)], [(111, 156), (112, 172)]], hoofd=(104, 70)),
            vlak(86, 58, 9, 20, INKT, INKT, 3),
            ballon(20, 18, 72, 34, "112", (84, 60))]


def ogen_spoelen():
    return [vloer(),
            pop((92, 96), (92, 136), [[(114, 92), (118, 66)], [(82, 114), (80, 132)]],
                [[(85, 156), (84, 172)], [(99, 156), (100, 172)]], hoofd=(92, 72)),
            vlak(108, 36, 16, 28, BLAUW, INKT, 4, draai=-28), druppels([(104, 62), (100, 68)]),
            druppels([(96, 78), (90, 84)], BLAUW, 2.6)]


def leuning():
    return [lijn([(18, 174), (56, 174), (56, 150), (96, 150), (96, 126), (136, 126), (136, 102), (184, 102)], 5, GRIJS),
            lijn([(26, 124), (150, 64)], 5, GRIJS), lijn([(40, 118), (40, 172)], 4, GRIJS),
            pop((100, 66), (94, 108), [[(116, 78), (128, 75)], [(92, 86), (88, 104)]],
                [[(88, 130), (80, 148)], [(112, 110), (118, 124)]])]


def niet_rennen():
    return [vloer(),
            pop((104, 82), (92, 122), [[(124, 90), (134, 74)], [(84, 96), (68, 104)]],
                [[(120, 130), (130, 154)], [(74, 140), (52, 152)]]),
            vaart([[(26, 92), (48, 92)], [(20, 112), (44, 112)], [(28, 132), (46, 132)]])]


# code -> (functie, naam, soort kader, groep in de kiezer, extra zoekwoorden)
TEKENINGEN = {
    "T-uitglijden": (uitglijden, "Uitglijden", "gevaar", "popje-gevaar", "gladde vloer nat vallen"),
    "T-struikelen": (struikelen, "Struikelen", "gevaar", "popje-gevaar", "vallen obstakel"),
    "T-val-van-ladder": (val_van_ladder, "Val van ladder", "gevaar", "popje-gevaar", "hoogte vallen"),
    "T-vallend-voorwerp": (vallend_voorwerp, "Vallend voorwerp", "gevaar", "popje-gevaar", "hoofd doos"),
    "T-hand-gekneld": (hand_gekneld, "Hand gekneld", "gevaar", "popje-gevaar", "machine knellen rollen"),
    "T-snijwonde": (snijwonde, "Snijwonde", "gevaar", "popje-gevaar", "mes snijden"),
    "T-aanrijding": (aanrijding, "Aanrijding", "gevaar", "popje-gevaar", "heftruck vorklift botsing"),
    "T-brandwonde": (brandwonde, "Brandwonde", "gevaar", "popje-gevaar", "heet warm verbranden"),
    "T-spatten-in-ogen": (spatten_in_ogen, "Spatten in de ogen", "gevaar", "popje-gevaar", "chemisch product"),
    "T-elektrische-schok": (elektrische_schok, "Elektrische schok", "gevaar", "popje-gevaar", "stroom elektrocutie"),
    "T-hoofd-stoten": (hoofd_stoten, "Hoofd stoten", "gevaar", "popje-gevaar", "balk botsen"),
    "T-rugpijn": (rugpijn, "Rugpijn", "gevaar", "popje-gevaar", "rug overbelasting"),
    "T-tillen-fout": (tillen_fout, "Fout tillen", "fout", "popje-gedrag", "rug heffen"),
    "T-tillen-goed": (tillen_goed, "Goed tillen", "goed", "popje-gedrag", "rug heffen knieën"),
    "T-samen-tillen": (samen_tillen, "Samen tillen", "goed", "popje-gedrag", "heffen hulp twee"),
    "T-kar-duwen": (kar_duwen, "Kar duwen", "goed", "popje-gedrag", "transport wagen"),
    "T-handen-wassen": (handen_wassen, "Handen wassen", "goed", "popje-gedrag", "hygiëne zeep"),
    "T-opruimen": (opruimen, "Opruimen", "goed", "popje-gedrag", "vegen dweilen proper"),
    "T-melden": (melden, "Melden", "goed", "popje-gedrag", "verantwoordelijke zeggen"),
    "T-hulp-roepen": (hulp_roepen, "Hulp roepen", "goed", "popje-gedrag", "bellen 112 nood"),
    "T-ogen-spoelen": (ogen_spoelen, "Ogen spoelen", "goed", "popje-gedrag", "oogspoelfles ehbo"),
    "T-leuning": (leuning, "Leuning vasthouden", "goed", "popje-gedrag", "trap"),
    "T-niet-rennen": (niet_rennen, "Niet rennen", "fout", "popje-gedrag", "lopen haast"),
}


def main():
    index = {}
    for code, (functie, naam, soort, groep, zoek) in TEKENINGEN.items():
        rand, kleur = kader(soort)
        inhoud = rand + "".join(functie()) + kenteken(soort, kleur)
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">{inhoud}</svg>\n'
        (MAP / f"{code}.svg").write_text(svg, encoding="utf-8")
        index[code] = {"naam": naam, "groep": groep, "zoek": zoek}
    regels = ",\n".join(f"  {json.dumps(c)}: {json.dumps(i, ensure_ascii=False)}" for c, i in index.items())
    (MAP / "index.json").write_text("{\n" + regels + "\n}\n", encoding="utf-8")
    print(f"{len(index)} eigen tekeningen in figuren/{MAP.name}/")


if __name__ == "__main__":
    main()
