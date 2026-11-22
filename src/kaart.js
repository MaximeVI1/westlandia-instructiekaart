/* Tekent een instructiekaart uit de kaartgegevens: vaste kop, vensters, voet, op zoveel A4's als nodig.
   Geen afhankelijkheden. */
window.Instructiekaart = (function () {
  'use strict';

  let bib = { pictogrammen: {}, figuren: {}, bronnen: {} };

  /* Breedte en hoogte van elk beeld. Daarmee ligt de opmaak vast nog voor een beeld geladen is,
     en kan betrouwbaar gemeten worden wat op een pagina past. */
  const maten = new Map();

  /* Kleine hulp om elementen te maken; tekst gaat altijd via textContent. */
  function el(tag, attrs, ...kinderen) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kind of kinderen) if (kind != null && kind !== false) node.append(kind);
    return node;
  }

  function datum(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
  }

  function veld(naam, waarde, klasse) {
    return el('div', { class: klasse },
      el('dt', { text: naam }),
      el('dd', { class: waarde ? null : 'leeg', text: waarde || '–' }));
  }

  /* Icoontjes in de vensterkop: vaste, eigen tekeningen (geen invoer van de gebruiker). */
  const ICONEN = {
    gebod: '<circle cx="12" cy="12" r="10.5" fill="currentColor"/><rect x="10.6" y="5.4" width="2.8" height="8.6" rx="1.4" fill="var(--toon)"/><circle cx="12" cy="17.3" r="1.7" fill="var(--toon)"/>',
    gevaar: '<path d="M12 2.2 22.6 20.8a1 1 0 0 1-.9 1.5H2.3a1 1 0 0 1-.9-1.5z" fill="currentColor"/><rect x="10.7" y="8.4" width="2.6" height="7.2" rx="1.3" fill="var(--toon)"/><circle cx="12" cy="18.6" r="1.5" fill="var(--toon)"/>',
    verbod: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3"/><path d="M5.8 5.8 18.2 18.2" stroke="currentColor" stroke-width="3"/>',
    ehbo: '<path d="M8.6 2.5h6.8v6.1h6.1v6.8h-6.1v6.1H8.6v-6.1H2.5V8.6h6.1z" fill="currentColor"/>',
    info: '<circle cx="12" cy="12" r="10.5" fill="currentColor"/><rect x="10.6" y="10.2" width="2.8" height="8.2" rx="1.4" fill="var(--toon)"/><circle cx="12" cy="6.9" r="1.7" fill="var(--toon)"/>',
  };

  function icoon(soort) {
    const houder = document.createElement('span');
    houder.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONEN[soort] + '</svg>';
    return houder.firstChild;
  }

  function beeld(src, alt, klasse) {
    const img = el('img', { class: klasse, src, alt: alt || '', decoding: 'sync' });
    const maat = maten.get(src);
    if (maat) {
      img.setAttribute('width', maat[0]);
      img.setAttribute('height', maat[1]);
    }
    return img;
  }

  function pictogram(code) {
    const p = bib.pictogrammen[code];
    return p ? beeld(p.src, p.naam) : el('span', { class: 'onbekend', text: code || '?' });
  }

  /* Een figuur uit de ingebouwde lijst (tekening van een situatie; geen officieel pictogram). */
  function figuur(code, klasse) {
    const f = (bib.figuren || {})[code];
    return f ? beeld(f.src, f.naam, klasse)
      : el('span', { class: 'onbekend' + (klasse ? ' ' + klasse : ''), text: code || '?' });
  }

  /* ---------- kop en voet ---------- */

  /* Op de eerste pagina staat de volledige kop; op vervolgpagina's een korte, zonder de strook met gegevens. */
  function tekenKop(kop, kort) {
    return el('header', { class: 'kop' + (kort ? ' kort' : '') },
      el('div', { class: 'kop-boven' },
        beeld(bib.logo, 'Westlandia', 'kop-logo'),
        el('dl', { class: 'velden kop-id' },
          veld('Document', kop.code, 'veld-code'),
          veld('Versie', kop.versie),
          veld('Datum', datum(kop.datum)))),
      el('div', { class: 'kop-titel' },
        kop.soort && el('p', { class: 'kop-soort', text: kop.soort }),
        el('h1', { text: kop.titel })),
      !kort && el('div', { class: 'kop-meta' },
        el('dl', { class: 'velden' },
          veld('Auteur', kop.auteur),
          veld('Eigenaar', kop.eigenaar),
          veld('Goedgekeurd door', kop.goedgekeurdDoor),
          veld('Geldig vanaf', datum(kop.geldigVanaf)),
          veld('Geldig voor', kop.geldigVoor),
          veld('Toepassingsgebied', kop.toepassingsgebied)),
        kop.doelstelling && el('p', { class: 'kop-doel' },
          el('span', { class: 'veldnaam', text: 'Doelstelling' }),
          el('span', { text: kop.doelstelling }))));
  }

  function tekenVoet(kop, nummer, totaal, vermelding) {
    const kenmerk = ['Westlandia', kop.code, kop.versie && 'versie ' + kop.versie, datum(kop.datum)]
      .filter(Boolean).join(' · ');
    return el('footer', { class: 'voet' },
      el('span', { text: kenmerk }),
      vermelding && el('span', { class: 'voet-bron', text: 'Figuren: ' + vermelding }),
      el('span', { text: 'Pagina ' + nummer + '/' + totaal }));
  }

  /* ---------- inhoud van een venster ---------- */

  /* Losse tekst: een gewone alinea die tussen de andere elementen van een venster kan staan. */
  const losseTekst = (item) => el('li', { class: 'los' }, el('p', { class: 'losse-tekst', text: item.tekst }));

  function tekenPictogrammen(v) {
    const lijst = el('ul', { class: 'picto-lijst' });
    for (const item of v.items || []) {
      if (item.los) { lijst.append(losseTekst(item)); continue; }
      const p = bib.pictogrammen[item.picto];
      const rond = p && (p.soort === 'gebod' || p.soort === 'verbod');
      lijst.append(el('li', { class: rond ? 'rond' : null },
        pictogram(item.picto),
        el('div', null,
          el('span', { class: 'picto-label', text: item.label }),
          item.noot && el('span', { class: 'picto-noot', text: item.noot }))));
    }
    return el('div', { class: 'picto-venster' },
      el('div', { class: 'picto-hoofd' },
        v.inleiding && el('p', { class: 'inleiding', text: v.inleiding }),
        lijst),
      v.illustratie && (v.illustratie.figuur ? figuur(v.illustratie.figuur, 'illustratie uit-lijst')
        : v.illustratie.src && beeld(v.illustratie.src, v.illustratie.alt, 'illustratie')));
  }

  function tekenBeeld(b) {
    const grootte = ['klein', 'middel', 'groot'].includes(b.grootte) ? b.grootte : 'middel';
    const soort = b.picto ? 'picto' : b.figuur ? 'figuur' : 'foto';
    return el('figure', { class: 'beeld ' + grootte + ' ' + soort },
      b.picto ? pictogram(b.picto) : b.figuur ? figuur(b.figuur) : beeld(b.src, b.alt),
      b.bijschrift && el('figcaption', { text: b.bijschrift }));
  }

  /* Een lijst punten; elk punt is een korte tekst met eventueel beelden eronder. */
  function tekenPunten(items, klasse) {
    const lijst = el(klasse === 'stappen' ? 'ol' : 'ul', { class: 'punten ' + klasse });
    for (const item of items || []) {
      if (item.los) { lijst.append(losseTekst(item)); continue; }
      const beelden = item.beelden || [];
      const klassen = [beelden.length && 'met-beelden', !item.tekst && 'zonder-tekst'].filter(Boolean).join(' ');
      lijst.append(el('li', { class: klassen || null },
        item.tekst && el('p', { class: 'punt-tekst', text: item.tekst }),
        beelden.length ? el('div', { class: 'beelden' }, ...beelden.map(tekenBeeld)) : null));
    }
    return lijst;
  }

  function tekenDoenNietDoen(v) {
    const kant = (items, klasse, titel) => (items || []).length
      ? el('div', { class: 'doen ' + klasse }, el('p', { class: 'doen-kop', text: titel }), tekenPunten(items, klasse))
      : null;
    return el('div', { class: 'doen-niet-doen' }, kant(v.wel, 'wel', 'Wel doen'), kant(v.niet, 'niet', 'Niet doen'));
  }

  const TYPES = {
    pictogrammen: tekenPictogrammen,
    punten: (v) => tekenPunten(v.items, 'kaal'),
    stappen: (v) => tekenPunten(v.items, 'stappen'),
    'doen-niet-doen': tekenDoenNietDoen,
  };

  function tekenVenster(v) {
    const soort = ICONEN[v.soort] ? v.soort : 'info';
    return el('section', { class: 'venster ' + soort, 'data-id': v.id },
      el('div', { class: 'venster-kop' }, icoon(soort), el('h2', { text: v.titel })),
      el('div', { class: 'venster-inhoud' },
        /* bij pictogrammen staat het kopje naast de figuur, dus binnen de inhoud zelf */
        v.type !== 'pictogrammen' && v.inleiding && el('p', { class: 'inleiding', text: v.inleiding }),
        (TYPES[v.type] || TYPES.punten)(v)));
  }

  /* ---------- vensters ordenen en over pagina's verdelen ---------- */

  /* Vensters staan onder elkaar in rijen. Een venster op volle breedte is een rij op zich; opeenvolgende
     vensters met breedte "links" of "rechts" vormen samen één rij van twee kolommen, waarin ze onder elkaar staan.
     Een venster met "nieuwePagina" begint altijd een nieuwe rij, bovenaan een nieuwe pagina. */
  function groepeer(vensters) {
    const rijen = [];
    let kolommen = null;
    for (const v of vensters || []) {
      if (v.breedte !== 'links' && v.breedte !== 'rechts') {
        kolommen = null;
        rijen.push({ breek: !!v.nieuwePagina, vol: v });
        continue;
      }
      if (!kolommen || v.nieuwePagina) {
        kolommen = { breek: !!v.nieuwePagina, links: [], rechts: [] };
        rijen.push(kolommen);
      }
      kolommen[v.breedte].push(v);
    }
    return rijen;
  }

  /* Verdeelt de rijen over pagina's. Een venster wordt nooit doormidden geknipt; twee kolommen
     mogen wel elk apart doorlopen op de volgende pagina. */
  function verdeel(rijen, hoogte, ruimte, tussen) {
    const paginas = [[]];
    let rest = ruimte(0);
    const huidige = () => paginas[paginas.length - 1];
    const nieuwe = () => { paginas.push([]); rest = ruimte(paginas.length - 1); };
    const stapel = (lijst) => lijst.reduce((som, v, i) => som + hoogte.get(v) + (i ? tussen : 0), 0);
    const aantalDatPast = (lijst, vrij) => {
      let som = 0;
      let n = 0;
      for (const v of lijst) {
        som += hoogte.get(v) + (n ? tussen : 0);
        if (som > vrij) break;
        n++;
      }
      return n;
    };

    for (const rij of rijen) {
      if (rij.breek && huidige().length) nieuwe();

      if (rij.vol) {
        const h = hoogte.get(rij.vol);
        if (huidige().length && h + tussen > rest) nieuwe();
        rest -= h + (huidige().length ? tussen : 0);
        huidige().push({ vol: rij.vol });
        continue;
      }

      const links = rij.links.slice();
      const rechts = rij.rechts.slice();
      while (links.length || rechts.length) {
        const vrij = rest - (huidige().length ? tussen : 0);
        let nl = aantalDatPast(links, vrij);
        let nr = aantalDatPast(rechts, vrij);
        if ((links.length && !nl) || (rechts.length && !nr)) {
          /* een kolom kan hier niet beginnen: samen naar een nieuwe pagina, of, op een lege pagina,
             toch plaatsen (dat venster is dan te groot voor één pagina) */
          if (huidige().length) { nieuwe(); continue; }
          if (links.length && !nl) nl = 1;
          if (rechts.length && !nr) nr = 1;
        }
        const deelLinks = links.splice(0, nl);
        const deelRechts = rechts.splice(0, nr);
        rest = vrij - Math.max(stapel(deelLinks), stapel(deelRechts));
        huidige().push({ links: deelLinks, rechts: deelRechts });
        if (links.length || rechts.length) nieuwe();
      }
    }
    return paginas;
  }

  /* ---------- de hele kaart ---------- */

  /* Alle beelden van de kaart, in welke vorm ook: { picto }, { figuur } of { src }. */
  function alleBeelden(kaart) {
    const uit = [];
    const punten = (lijst) => { for (const punt of lijst || []) uit.push(...(punt.beelden || [])); };
    for (const v of kaart.vensters || []) {
      if (v.type === 'pictogrammen') {
        for (const item of v.items || []) if (item.picto) uit.push({ picto: item.picto });
        if (v.illustratie) uit.push(v.illustratie);
      } else if (v.type === 'doen-niet-doen') {
        punten(v.wel);
        punten(v.niet);
      } else {
        punten(v.items);
      }
    }
    return uit;
  }

  /* De bestanden achter die beelden (plus het logo). */
  function bronnen(kaart, bibliotheek) {
    const uit = new Set([bibliotheek.logo]);
    for (const b of alleBeelden(kaart)) {
      const uitLijst = b.picto ? bibliotheek.pictogrammen[b.picto] : b.figuur ? (bibliotheek.figuren || {})[b.figuur] : null;
      if (uitLijst) uit.add(uitLijst.src); else if (b.src) uit.add(b.src);
    }
    return uit;
  }

  /* Bronvermeldingen die de gebruikte figuren vragen (bv. bij een Creative Commons-licentie). */
  function vermeldingen(kaart) {
    const uit = new Set();
    for (const b of alleBeelden(kaart)) {
      const f = b.figuur && (bib.figuren || {})[b.figuur];
      const bron = f && (bib.bronnen || {})[f.bron];
      if (bron && bron.vermelding) uit.add(bron.vermelding);
    }
    return [...uit];
  }

  /* Beelden waarvan de maat nog niet gekend is. */
  function ontbrekendeMaten(kaart, bibliotheek) {
    return [...bronnen(kaart, bibliotheek)].filter((src) => src && !maten.has(src));
  }

  /* Meet beelden op; daarna kent toon() hun verhouding. */
  function meet(lijst) {
    return Promise.all(lijst.map(async (src) => {
      const img = new Image();
      img.src = src;
      try { await img.decode(); } catch (fout) { /* onleesbaar beeld: blijft zonder maat */ }
      maten.set(src, img.naturalWidth && img.naturalHeight ? [img.naturalWidth, img.naturalHeight] : null);
    }));
  }

  /* Tekent de kaart in `doel` (een element dat in de pagina staat), op zoveel bladen als nodig. */
  function toon(kaart, bibliotheek, doel) {
    bib = bibliotheek;
    const kop = kaart.kop || {};
    const rijen = groepeer(kaart.vensters);

    /* 1. Alles één keer tekenen op een onzichtbaar blad en opmeten. */
    const elementen = new Map();
    const meetVensters = el('div', { class: 'vensters' });
    for (const rij of rijen) {
      if (rij.vol) {
        elementen.set(rij.vol, tekenVenster(rij.vol));
        meetVensters.append(elementen.get(rij.vol));
        continue;
      }
      for (const v of [...rij.links, ...rij.rechts]) {
        elementen.set(v, tekenVenster(v));
        meetVensters.append(el('div', { class: 'kolommen' }, el('div', { class: 'kolom' }, elementen.get(v)), el('div', { class: 'kolom' })));
      }
    }
    const kopVol = tekenKop(kop, false);
    const kopKort = tekenKop(kop, true);
    const vermelding = vermeldingen(kaart).join(' · ');
    const voet = tekenVoet(kop, 1, 1, vermelding);
    const lat = el('div', { style: 'height:100mm;flex:none' });
    const meetblad = el('article', { class: 'blad meet' }, kopVol, kopKort, meetVensters, voet, lat);
    document.body.append(meetblad);

    const h = (e) => e.getBoundingClientRect().height;
    const px = (waarde) => parseFloat(waarde) || 0;
    const stijl = getComputedStyle(meetblad);
    const stijlVensters = getComputedStyle(meetVensters);
    const binnen = 297 * h(lat) / 100 - px(stijl.paddingTop) - px(stijl.paddingBottom);
    const vast = px(stijlVensters.marginTop) + h(voet) + px(getComputedStyle(voet).marginTop);
    const ruimtes = [binnen - vast - h(kopVol) - 0.5, binnen - vast - h(kopKort) - 0.5];
    const tussen = px(stijlVensters.rowGap);
    const hoogte = new Map();
    for (const [v, e] of elementen) hoogte.set(v, h(e));
    meetblad.remove();

    /* 2. Verdelen over pagina's en de bladen opbouwen met dezelfde elementen. */
    const paginas = verdeel(rijen, hoogte, (i) => ruimtes[i ? 1 : 0], tussen);
    const kolom = (lijst) => el('div', { class: 'kolom' }, ...lijst.map((v) => elementen.get(v)));
    doel.replaceChildren(...paginas.map((blokken, i) =>
      el('article', { class: 'blad' },
        tekenKop(kop, i > 0),
        el('div', { class: 'vensters' }, ...blokken.map((blok) =>
          (blok.vol ? elementen.get(blok.vol) : el('div', { class: 'kolommen' }, kolom(blok.links), kolom(blok.rechts))))),
        tekenVoet(kop, i + 1, paginas.length, vermelding))));
    return { paginas: paginas.length };
  }

  return { toon, meet, ontbrekendeMaten, el, datum };
})();
