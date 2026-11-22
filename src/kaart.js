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

  function tekenVoet(kop, nummer, totaal, vermelding, woord) {
    const kenmerk = ['Westlandia', kop.code, kop.versie && 'versie ' + kop.versie, datum(kop.datum)]
      .filter(Boolean).join(' · ');
    return el('footer', { class: 'voet' },
      el('span', { text: kenmerk }),
      vermelding && el('span', { class: 'voet-bron', text: 'Figuren: ' + vermelding }),
      el('span', { text: (woord || 'Pagina') + ' ' + nummer + '/' + totaal }));
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

  /* Een lijst punten; elk punt is een korte tekst met eventueel beelden eronder.
     `start`: aantal stappen die al op een vorige dia stonden, zodat de nummering doorloopt. */
  function tekenPunten(items, klasse, start) {
    const lijst = el(klasse === 'stappen' ? 'ol' : 'ul', { class: 'punten ' + klasse, style: start ? 'counter-reset: stap ' + start : null });
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
    stappen: (v) => tekenPunten(v.items, 'stappen', v.startNummer),
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

  /* ---------- presentatie: dezelfde vensters op dia's van 16:9 ---------- */

  /* Welke vensters samen op een dia staan. Zonder eigen indeling krijgt elk venster een eigen dia, in de
     volgorde van de kaart. Een eigen indeling (kaart.presentatie.dias: lijsten van venster-id's) bepaalt
     de groepen en hun volgorde; een venster dat er nog niet in staat (bv. net toegevoegd), komt op een
     eigen dia na de dia van het venster dat er op de kaart voor staat. */
  function diaIndeling(kaart) {
    const vensters = kaart.vensters || [];
    const perId = new Map(vensters.map((v) => [v.id, v]));
    const eigen = kaart.presentatie && Array.isArray(kaart.presentatie.dias) ? kaart.presentatie.dias : [];
    const geplaatst = new Set();
    const dias = [];
    for (const ids of eigen) {
      if (!Array.isArray(ids)) continue;
      const dia = [];
      for (const id of ids) {
        const v = perId.get(id);
        if (v && !geplaatst.has(v)) { dia.push(v); geplaatst.add(v); }
      }
      if (dia.length) dias.push(dia);
    }
    let vorige = -1;
    for (const v of vensters) {
      if (geplaatst.has(v)) { vorige = dias.findIndex((d) => d.includes(v)); continue; }
      dias.splice(++vorige, 0, [v]);
      geplaatst.add(v);
    }
    return dias;
  }

  /* Hoe groot de vensters op een dia mogen worden: zo groot als past, tot DIA.max. Een venster alleen
     op een dia gaat niet kleiner dan DIA.alleen; is het dan nog te lang, dan loopt het door op een
     volgende dia. Vensters die je samen op één dia zette, mogen kleiner, tot DIA.samen. */
  const DIA = { max: 1.75, alleen: 1.25, samen: 0.85 };

  /* Een venster bestaat uit eenheden die over dia's verdeeld kunnen worden: punten, stappen,
     pictogrammen, of bij doen / niet doen eerst de wel- en dan de niet-punten. */
  const eenheden = (v) => (v.type === 'doen-niet-doen' ? (v.wel || []).length + (v.niet || []).length : (v.items || []).length);

  function deelVan(v, van, tot, nummer, delen) {
    const deel = Object.assign({}, v);
    if (delen > 1) deel.titel = [v.titel, '(' + nummer + '/' + delen + ')'].filter(Boolean).join(' ');
    if (v.type === 'doen-niet-doen') {
      const wel = v.wel || [];
      deel.wel = wel.slice(Math.min(van, wel.length), Math.min(tot, wel.length));
      deel.niet = (v.niet || []).slice(Math.max(van - wel.length, 0), Math.max(tot - wel.length, 0));
    } else {
      deel.items = (v.items || []).slice(van, tot);
      if (v.type === 'stappen') deel.startNummer = (v.items || []).slice(0, van).filter((p) => !p.los).length;
    }
    if (van > 0) deel.illustratie = null;   // de grote figuur alleen bij het eerste deel
    return deel;
  }

  function tekenTitelDia(kop) {
    const extra = [['Geldig voor', kop.geldigVoor], ['Toepassingsgebied', kop.toepassingsgebied], ['Eigenaar', kop.eigenaar]]
      .filter(([, waarde]) => waarde);
    return el('article', { class: 'dia titeldia' },
      el('div', { class: 'kop-boven' },
        beeld(bib.logo, 'Westlandia', 'kop-logo'),
        el('dl', { class: 'velden kop-id' },
          veld('Document', kop.code, 'veld-code'),
          veld('Versie', kop.versie),
          veld('Datum', datum(kop.datum)))),
      el('div', { class: 'kop-titel titeldia-titel' },
        kop.soort && el('p', { class: 'kop-soort', text: kop.soort }),
        el('h1', { text: kop.titel }),
        kop.doelstelling && el('p', { class: 'titeldia-doel', text: kop.doelstelling })),
      extra.length ? el('dl', { class: 'velden titeldia-meta' }, ...extra.map(([naam, waarde]) => veld(naam, waarde))) : null);
  }

  function maakDia(kop, vensters, groep, vermelding) {
    const lijst = el('div', { class: 'dia-vensters n' + Math.min(vensters.length, 6) }, ...vensters.map(tekenVenster));
    const midden = el('div', { class: 'dia-midden' }, lijst);
    const voet = tekenVoet(kop, 0, 0, vermelding, 'Dia');   // het nummer komt er pas op het einde in
    const dia = el('article', { class: 'dia', 'data-groep': groep },
      el('header', { class: 'dia-kop' },
        el('div', { class: 'dia-kop-titel' },
          kop.soort && el('span', { class: 'kop-soort', text: kop.soort }),
          el('strong', { text: kop.titel })),
        beeld(bib.logo, 'Westlandia', 'kop-logo')),
      midden, voet);
    return { el: dia, lijst, midden, voet };
  }

  /* Past de inhoud bij deze vergroting op de dia? */
  function past(dia, z) {
    dia.lijst.style.zoom = z;
    return dia.lijst.getBoundingClientRect().height <= dia.midden.getBoundingClientRect().height + 0.5;
  }

  /* Zoekt de grootste vergroting tussen min en DIA.max waarbij alles op de dia past. */
  function pasIn(dia, min) {
    dia.el.classList.remove('te-vol');
    if (past(dia, DIA.max)) return DIA.max;
    if (!past(dia, min)) { dia.el.classList.add('te-vol'); return min; }
    let laag = min;
    let hoog = DIA.max;
    for (let i = 0; i < 6; i++) {
      const z = (laag + hoog) / 2;
      if (past(dia, z)) laag = z; else hoog = z;
    }
    past(dia, laag);
    return laag;
  }

  /* De dia('s) voor één venster alleen: één dia als het leesbaar past, anders verdeeld over
     zoveel dia's als nodig, zo gelijk mogelijk, allemaal even groot. */
  function diasVoorVenster(v, kop, groep, vermelding, doel) {
    const n = eenheden(v);
    const probeer = (van, tot, nummer, delen) => {
      const dia = maakDia(kop, [deelVan(v, van, tot, nummer, delen)], groep, vermelding);
      doel.append(dia.el);
      return dia;
    };
    const heel = probeer(0, n, 1, 1);
    if (n < 2 || past(heel, DIA.alleen)) { pasIn(heel, DIA.samen); return [heel]; }
    heel.el.remove();

    /* hoeveel dia's nodig zijn: telkens zoveel eenheden als er leesbaar op passen */
    const grenzen = [];
    for (let van = 0; van < n;) {
      let laag = van + 1;
      let hoog = n;
      while (laag < hoog) {
        const tot = Math.ceil((laag + hoog) / 2);
        const dia = probeer(van, tot, 1, 2);
        const ok = past(dia, DIA.alleen);
        dia.el.remove();
        if (ok) laag = tot; else hoog = tot - 1;
      }
      grenzen.push(laag);
      van = laag;
    }

    /* liefst even veel per dia; past dat niet, dan zoals hierboven gevonden */
    const k = grenzen.length;
    const maak = (eindes) => {
      let van = 0;
      return eindes.map((tot, i) => { const dia = probeer(van, tot, i + 1, k); van = tot; return dia; });
    };
    let dias = maak(Array.from({ length: k }, (_, i) => Math.round((i + 1) * n / k)));
    if (!dias.every((dia) => past(dia, DIA.alleen))) {
      for (const dia of dias) dia.el.remove();
      dias = maak(grenzen);
    }
    const passend = dias.map((dia) => [dia, pasIn(dia, DIA.samen)]).filter(([dia]) => !dia.el.classList.contains('te-vol'));
    const z = Math.min(...passend.map(([, zoom]) => zoom));
    for (const [dia] of passend) past(dia, z);
    return dias;
  }

  /* Tekent de presentatie in `doel`: een titeldia en dan de vensters. Geeft het aantal dia's, de gebruikte
     indeling (lijsten van venster-id's) en hoeveel dia's te vol zijn. */
  function toonPresentatie(kaart, bibliotheek, doel) {
    bib = bibliotheek;
    const kop = kaart.kop || {};
    const vermelding = vermeldingen(kaart).join(' · ');
    const indeling = diaIndeling(kaart);
    doel.replaceChildren(tekenTitelDia(kop));
    const dias = [];
    indeling.forEach((groep, i) => {
      if (groep.length === 1) { dias.push(...diasVoorVenster(groep[0], kop, i, vermelding, doel)); return; }
      const dia = maakDia(kop, groep, i, vermelding);
      doel.append(dia.el);
      pasIn(dia, DIA.samen);
      dias.push(dia);
    });
    const totaal = dias.length + 1;
    dias.forEach((dia, i) => dia.el.replaceChild(tekenVoet(kop, i + 2, totaal, vermelding, 'Dia'), dia.voet));
    return {
      dias: totaal,
      indeling: indeling.map((groep) => groep.map((v) => v.id)),
      teVol: dias.filter((dia) => dia.el.classList.contains('te-vol')).length,
    };
  }

  return { toon, toonPresentatie, meet, ontbrekendeMaten, el, datum };
})();
