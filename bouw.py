#!/usr/bin/env python3
"""Bouwt instructiekaart.html: één zelfstandig bestand met de editor, de opmaak en de pictogrammen.

Gebruik:
    python3 bouw.py                              # bouwt instructiekaart.html (start met een lege kaart)
    python3 bouw.py --pdf                        # maakt ook een pdf naast elke kaart in kaarten/
    python3 bouw.py --pdf kaarten/A.json ...     # maakt een pdf naast elk opgegeven kaartbestand
    python3 bouw.py --zip                        # maakt Instructiekaart-editor.zip om door te geven

Alleen de standaardbibliotheek van Python is nodig; voor --pdf ook Chrome of Edge.
"""
import base64
import json
import mimetypes
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
ZIPNAAM = "Instructiekaart-editor"

BROWSERS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "google-chrome", "chromium", "chromium-browser", "msedge",
]


def data_uri(pad: pathlib.Path) -> str:
    soort = "image/svg+xml" if pad.suffix == ".svg" else mimetypes.guess_type(pad.name)[0]
    if not soort:
        raise SystemExit(f"Onbekend bestandstype: {pad}")
    return f"data:{soort};base64,{base64.b64encode(pad.read_bytes()).decode('ascii')}"


def bibliotheek() -> dict:
    """Alles wat in elke kaart beschikbaar is: het logo, de officiële pictogrammen en de figuren.

    Figuren staan per bron in een eigen map onder src/figuren/ (zie bronnen.json); een bron kan een
    vermelding hebben die de editor onderaan de kaart zet zodra een van haar figuren gebruikt wordt.
    """
    index = json.loads((SRC / "pictogrammen" / "index.json").read_text(encoding="utf-8"))
    pictogrammen = {code: {**info, "src": data_uri(SRC / "pictogrammen" / f"{code}.svg")} for code, info in index.items()}

    bronnen = json.loads((SRC / "figuren" / "bronnen.json").read_text(encoding="utf-8"))
    figuren = {}
    for bron in bronnen:
        index = json.loads((SRC / "figuren" / bron / "index.json").read_text(encoding="utf-8"))
        for code, info in index.items():
            info = {k: v for k, v in info.items() if k != "origineel"}
            figuren[code] = {**info, "bron": bron, "src": data_uri(SRC / "figuren" / bron / f"{code}.svg")}
    return {"logo": data_uri(SRC / "logo.jpg"), "pictogrammen": pictogrammen, "figuren": figuren, "bronnen": bronnen}


def beelden_insluiten(deel, kaartmap: pathlib.Path):
    """Vervangt elke "src" die naar een los bestand wijst door het beeld zelf."""
    if isinstance(deel, dict):
        for sleutel, waarde in deel.items():
            if sleutel == "src" and isinstance(waarde, str) and not waarde.startswith("data:"):
                deel[sleutel] = data_uri(kaartmap / waarde)
            else:
                beelden_insluiten(waarde, kaartmap)
    elif isinstance(deel, list):
        for onderdeel in deel:
            beelden_insluiten(onderdeel, kaartmap)


def laad_kaart(pad: pathlib.Path) -> dict:
    """Leest een kaart: een .json-bestand uit de editor, of een map met kaart.json en losse beelden."""
    bestand = pad / "kaart.json" if pad.is_dir() else pad
    kaart = json.loads(bestand.read_text(encoding="utf-8"))
    beelden_insluiten(kaart, bestand.parent)
    return kaart


def als_json(gegevens) -> str:
    # "</" mag niet letterlijk in een <script>-blok staan
    return json.dumps(gegevens, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def lees(*namen: str) -> str:
    return "\n".join((SRC / naam).read_text(encoding="utf-8") for naam in namen)


def bouw_pagina(kaart=None) -> str:
    """Zet opmaak, code, pictogrammen en figuren samen in de pagina.

    Zonder kaart start de editor met een lege kaart. Met een kaart toont hij die meteen;
    dat dient om er een pdf van te maken."""
    pagina = (SRC / "pagina.html").read_text(encoding="utf-8")
    delen = {
        "/*__CSS__*/": lees("kaart.css", "editor.css"),
        "/*__JS__*/": lees("kaart.js", "import.js", "editor.js"),
        "__BIBLIOTHEEK__": als_json(bibliotheek()),
        "__KAART__": als_json(kaart),
    }
    for merk in delen:
        if pagina.count(merk) != 1:
            raise SystemExit(f"{merk} moet precies één keer in src/pagina.html staan")
    patroon = re.compile("|".join(re.escape(merk) for merk in delen))
    return patroon.sub(lambda m: delen[m.group(0)], pagina)


def maak_pdf(html: pathlib.Path, uit: pathlib.Path) -> None:
    browser = next((b for b in BROWSERS if pathlib.Path(b).exists() or shutil.which(b)), None)
    if not browser:
        raise SystemExit("Geen Chrome of Edge gevonden; open de kaart in de editor en kies Afdrukken / pdf.")
    subprocess.run(
        [browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         "--virtual-time-budget=5000",   # geeft de pagina de tijd om de beelden op te meten en de pagina's te verdelen
         f"--print-to-pdf={uit}", html.as_uri()],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120,
    )
    print(f"{uit.relative_to(ROOT) if uit.is_relative_to(ROOT) else uit}  ({uit.stat().st_size / 1024:.0f} kB)")


def maak_zip() -> None:
    """Maakt het zip-bestand om door te geven: bovenaan de editor en een korte uitleg,
    daaronder de kaarten als voorbeeld en de broncode voor wie de editor wil aanpassen."""
    doel = ROOT / f"{ZIPNAAM}.zip"
    with zipfile.ZipFile(doel, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(ROOT / "instructiekaart.html", f"{ZIPNAAM}/Instructiekaart-editor.html")
        # met regeleinden en tekenset die Kladblok op elke Windows-pc goed toont
        uitleg = (SRC / "lees-mij.txt").read_text(encoding="utf-8").replace("\n", "\r\n")
        z.writestr(f"{ZIPNAAM}/Lees mij.txt", uitleg.encode("utf-8-sig"))
        for pad in sorted((ROOT / "kaarten").glob("*")):
            if pad.suffix in (".json", ".pdf"):
                z.write(pad, f"{ZIPNAAM}/Kaarten/{pad.name}")
        for pad in sorted(ROOT.glob("*.docx")):
            if not pad.name.startswith("~$"):   # geen tijdelijke bestanden van Word
                z.write(pad, f"{ZIPNAAM}/Kaarten/Oude Word-kaart ({pad.stem}).docx")
        z.write(ROOT / "bouw.py", f"{ZIPNAAM}/Broncode/bouw.py")
        for pad in sorted(SRC.rglob("*")):
            if pad.is_file() and not pad.name.startswith("."):
                z.write(pad, f"{ZIPNAAM}/Broncode/src/{pad.relative_to(SRC).as_posix()}")
    print(f"{doel.name}  ({doel.stat().st_size / 1024:.0f} kB)")


def main() -> None:
    kaarten = [pathlib.Path(a).resolve() for a in sys.argv[1:] if not a.startswith("--")]
    uit = ROOT / "instructiekaart.html"
    uit.write_text(bouw_pagina(), encoding="utf-8")
    print(f"{uit.name}  ({uit.stat().st_size / 1024:.0f} kB)")

    if "--pdf" in sys.argv:
        kaarten = kaarten or sorted((ROOT / "kaarten").glob("*.json"))   # zonder namen: alle kaarten in kaarten/
        with tempfile.TemporaryDirectory() as tijdelijk:
            for pad in kaarten:
                html = pathlib.Path(tijdelijk) / "kaart.html"
                html.write_text(bouw_pagina(laad_kaart(pad)), encoding="utf-8")
                maak_pdf(html, (pad / "kaart.pdf") if pad.is_dir() else pad.with_suffix(".pdf"))
    if "--zip" in sys.argv:
        maak_zip()


if __name__ == "__main__":
    main()
