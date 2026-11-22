# Instructiekaart-editor

Een editor voor veiligheidsinstructiekaarten: links vul je de kaart in, rechts zie je het A4-blad, en via "Afdrukken / pdf" maak je er een pdf van.

**Open de editor: https://maximevi1.github.io/westlandia-instructiekaart/**

## Gebruiken

1. Open de link hierboven, bij voorkeur in Edge of Chrome, en zet hem bij je favorieten.
2. Wil je een eigen icoon op je computer? Klik bovenaan op "App installeren". Daarna opent de editor in een eigen venster, ook zonder internet. Beheerdersrechten zijn niet nodig.

De kaarten zelf blijven op je eigen computer of op de gedeelde schijf: je bewaart ze met "Opslaan" als `.json`-bestand en opent ze weer met "Openen". Er wordt niets naar de website gestuurd.

### Zonder internet of zonder website

Download `Instructiekaart-editor.zip` bij [Releases](../../releases/latest), pak het uit en dubbelklik op `Instructiekaart-editor.html`. Dat is dezelfde editor als één los bestand. De uitleg van de knoppen staat in `Lees mij.txt` in het zip-bestand.

## Aanpassen en bouwen

Alleen Python 3 is nodig, zonder extra pakketten.

```
python3 bouw.py          # bouwt instructiekaart.html
python3 bouw.py --pdf    # maakt ook een pdf naast elke kaart in kaarten/ (vraagt Chrome of Edge)
python3 bouw.py --zip    # maakt Instructiekaart-editor.zip om door te geven
python3 bouw.py --web    # maakt de map web/ voor de website
```

| Map of bestand | Inhoud |
| --- | --- |
| `bouw.py` | Voegt alles uit `src/` samen tot één HTML-bestand. |
| `src/pagina.html`, `src/*.css`, `src/*.js` | De editor en de opmaak van de kaart. |
| `src/pictogrammen/` | Officiële pictogrammen (ISO 7010 en GHS). |
| `src/figuren/` | Tekeningen voor in de vensters. |
| `src/web/` | Wat de website extra nodig heeft: iconen, manifest en de dienst die de editor ook zonder internet laat openen. |
| `src/lees-mij.txt` | De uitleg die in het zip-bestand komt. |
| `kaarten/` | Kaarten als `.json`, met de pdf ernaast. |
| `.github/workflows/website.yml` | Zet de website online bij elke wijziging op `main`. |

## Een nieuwe versie doorgeven

```
git add -A && git commit -m "Wat er veranderd is"
git push
```

Na enkele minuten staat de nieuwe versie online. Wie de editor opent, krijgt ze vanzelf; niemand hoeft iets te downloaden.

Wil je ook het zip-bestand vernieuwen:

```
python3 bouw.py --zip
gh release create v1.2 Instructiekaart-editor.zip --title "Versie 1.2" --notes "Wat er veranderd is"
```

Bestaande kaartbestanden (`.json`) blijven werken met een nieuwe versie van de editor.

## Bronnen

- Pictogrammen: ISO 7010 en GHS, via Wikimedia Commons (publiek domein). Zie `src/pictogrammen/BRON.txt`.
- Figuren: Mulberry Symbols, © Steve Lee, licentie CC BY-SA 4.0, [mulberrysymbols.org](https://mulberrysymbols.org). Zie `src/figuren/mulberry/LICENSE.txt`.
