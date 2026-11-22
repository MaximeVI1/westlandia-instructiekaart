# Instructiekaart-editor

Een editor voor veiligheidsinstructiekaarten: links vul je de kaart in, rechts zie je het A4-blad, en via "Afdrukken / pdf" maak je er een pdf van. De editor is één HTML-bestand dat zonder installatie en zonder internet werkt.

## Gebruiken

1. Download `Instructiekaart-editor.zip` bij [Releases](../../releases/latest).
2. Pak het zip-bestand uit.
3. Dubbelklik op `Instructiekaart-editor.html`, bij voorkeur in Edge of Chrome.

De uitleg van de knoppen staat in `Lees mij.txt` in het zip-bestand.

## Aanpassen en bouwen

Alleen Python 3 is nodig, zonder extra pakketten.

```
python3 bouw.py          # bouwt instructiekaart.html
python3 bouw.py --pdf    # maakt ook een pdf naast elke kaart in kaarten/ (vraagt Chrome of Edge)
python3 bouw.py --zip    # maakt Instructiekaart-editor.zip om door te geven
```

| Map of bestand | Inhoud |
| --- | --- |
| `bouw.py` | Voegt alles uit `src/` samen tot één HTML-bestand. |
| `src/pagina.html`, `src/*.css`, `src/*.js` | De editor en de opmaak van de kaart. |
| `src/pictogrammen/` | Officiële pictogrammen (ISO 7010 en GHS). |
| `src/figuren/` | Tekeningen voor in de vensters. |
| `src/lees-mij.txt` | De uitleg die in het zip-bestand komt. |
| `kaarten/` | Kaarten als `.json`, met de pdf ernaast. |

## Een nieuwe versie doorgeven

```
python3 bouw.py --zip
git add -A && git commit -m "Wat er veranderd is"
git push
gh release create v1.1 Instructiekaart-editor.zip --title "Versie 1.1" --notes "Wat er veranderd is"
```

Bestaande kaartbestanden (`.json`) blijven werken met een nieuwe versie van de editor.

## Bronnen

- Pictogrammen: ISO 7010 en GHS, via Wikimedia Commons (publiek domein). Zie `src/pictogrammen/BRON.txt`.
- Figuren: Mulberry Symbols, © Steve Lee, licentie CC BY-SA 4.0, [mulberrysymbols.org](https://mulberrysymbols.org). Zie `src/figuren/mulberry/LICENSE.txt`.
