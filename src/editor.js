/* De editor: formulier links, live blad rechts.
   Een kaart wordt bewaard als één .json-bestand met de foto's erin. */
(function () {
  'use strict';

  const K = window.Instructiekaart;
  const el = K.el;
  const bib = JSON.parse(document.getElementById('bibliotheek').textContent);

  const SOORTEN = [
    { id: 'gebod', naam: 'Gebod', stip: true },
    { id: 'gevaar', naam: 'Gevaar', stip: true },
    { id: 'verbod', naam: 'Verbod', stip: true },
    { id: 'ehbo', naam: 'EHBO', stip: true },
    { id: 'info', naam: 'Info', stip: true },
  ];
  const TYPES = [
    { id: 'pictogrammen', naam: 'Pictogrammen', uitleg: 'Pictogrammen met een woord erbij' },
    { id: 'punten', naam: 'Punten', uitleg: 'Korte tekst met foto’s of pictogrammen' },
    { id: 'stappen', naam: 'Stappenplan', uitleg: 'Genummerde stappen' },
    { id: 'doen-niet-doen', naam: 'Doen / niet doen', uitleg: 'Twee lijstjes naast elkaar' },
  ];
  const BREEDTES = [
    { id: 'vol', naam: 'Volle breedte' },
    { id: 'links', naam: 'Links' },
    { id: 'rechts', naam: 'Rechts' },
  ];
  const GROOTTES = [
    { id: 'klein', naam: 'Klein' },
    { id: 'middel', naam: 'Middel' },
    { id: 'groot', naam: 'Groot' },
  ];
  const GROEPEN = [
    { id: 'gebod', naam: 'Gebod' },
    { id: 'gevaar', naam: 'Waarschuwing' },
    { id: 'verbod', naam: 'Verbod' },
    { id: 'ghs', naam: 'Gevaarlijke stoffen' },
    { id: 'ehbo', naam: 'Nood en EHBO' },
    { id: 'brand', naam: 'Brand' },
  ];
  /* Figuren zijn tekeningen van situaties; ze staan los van de officiële pictogrammen. */
  const FIGUURGROEPEN = [
    { id: 'letsel', naam: 'Letsels en gevaren' },
    { id: 'pbm', naam: 'Bescherming' },
    { id: 'ehbo', naam: 'Eerste hulp' },
    { id: 'hygiene', naam: 'Hygiëne en opruimen' },
    { id: 'tillen', naam: 'Tillen en bewegen' },
    { id: 'gedrag', naam: 'Gedrag' },
    { id: 'gereedschap', naam: 'Gereedschap' },
    { id: 'popje-gevaar', naam: 'Popjes: gevaren' },
    { id: 'popje-gedrag', naam: 'Popjes: zo wel, zo niet' },
  ];
  const KOPVELDEN = [
    { sleutel: 'titel', naam: 'Titel', breed: true },
    { sleutel: 'soort', naam: 'Soort document', breed: true },
    { sleutel: 'code', naam: 'Documentcode' },
    { sleutel: 'versie', naam: 'Versie' },
    { sleutel: 'datum', naam: 'Datum', type: 'date' },
    { sleutel: 'geldigVanaf', naam: 'Geldig vanaf', type: 'date' },
    { sleutel: 'auteur', naam: 'Auteur' },
    { sleutel: 'eigenaar', naam: 'Eigenaar' },
    { sleutel: 'goedgekeurdDoor', naam: 'Goedgekeurd door' },
    { sleutel: 'geldigVoor', naam: 'Geldig voor' },
    { sleutel: 'toepassingsgebied', naam: 'Toepassingsgebied', breed: true },
    { sleutel: 'doelstelling', naam: 'Doelstelling', breed: true, rijen: 2 },
  ];
  const BESTANDSTYPES = [{ description: 'Instructiekaart', accept: { 'application/json': ['.json'] } }];

  const formulier = document.getElementById('formulier');
  const voorbeeld = document.getElementById('voorbeeld');
  const kader = document.getElementById('blad-kader');
  const bladen = document.getElementById('bladen');
  const paginasEl = document.getElementById('werkbalk-paginas');
  const naamEl = document.getElementById('werkbalk-naam');
  const teVolEl = document.getElementById('werkbalk-melding');
  const meldingEl = document.getElementById('melding');
  const bestandKiezer = document.getElementById('bestand-kiezen');
  const docxKiezer = document.getElementById('docx-kiezen');
  const uitleg = document.getElementById('dia-uitleg');
  const automatischKnop = document.getElementById('dia-automatisch');

  const staat = {
    kaart: null,
    naam: '',                 // naam van het bestand, als de kaart al opgeslagen of geopend is
    zonderNaam: 'Nieuwe kaart',
    handvat: null,            // het bestand zelf, zodat Opslaan er meteen in kan schrijven
    gewijzigd: false,
    open: new Set(),          // welke blokken in het formulier opengeklapt zijn
  };
  let verleden = [];
  let toekomst = [];
  let laatsteBron = null;
  let laatsteTijd = 0;

  /* ---------- kaartgegevens: nakijken, nieuw maken, kopiëren ---------- */

  const tekst = (w) => (typeof w === 'string' ? w : '');
  const lijst = (w) => (Array.isArray(w) ? w : []);
  const eenVan = (opties, w, anders) => (opties.some((o) => o.id === w) ? w : anders);
  const nieuwId = () => 'v' + Math.random().toString(36).slice(2, 9);

  /* Alleen ingesloten beelden zijn toegelaten, nooit een adres op het internet. */
  const veiligBeeld = (src) =>
    (typeof src === 'string' && /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : '');

  function normBeeld(b) {
    if (!b || typeof b !== 'object') return null;
    const basis = { grootte: eenVan(GROOTTES, b.grootte, 'middel'), bijschrift: tekst(b.bijschrift) };
    if (tekst(b.picto)) return { picto: b.picto, ...basis };
    if (tekst(b.figuur)) return { figuur: b.figuur, ...basis };
    const src = veiligBeeld(b.src);
    return src ? { src, alt: tekst(b.alt), ...basis } : null;
  }

  /* Losse tekst: een alinea die tussen de pictogrammen, punten of stappen van een venster staat. */
  const normLos = (p) => ({ los: true, tekst: tekst(p.tekst) });

  const normPunt = (p) => (p && p.los ? normLos(p)
    : { tekst: tekst(p && p.tekst), beelden: lijst(p && p.beelden).map(normBeeld).filter(Boolean) });

  function normVenster(v) {
    v = v && typeof v === 'object' ? v : {};
    const uit = {
      id: /^[a-z0-9]{1,12}$/.test(tekst(v.id)) ? v.id : nieuwId(),
      titel: tekst(v.titel),
      soort: eenVan(SOORTEN, v.soort, 'info'),
      breedte: eenVan(BREEDTES, v.breedte, 'vol'),
      type: eenVan(TYPES, v.type, 'punten'),
      inleiding: tekst(v.inleiding),
    };
    if (v.nieuwePagina === true) uit.nieuwePagina = true;
    if (uit.type === 'pictogrammen') {
      uit.items = lijst(v.items).map((p) => (p && p.los ? normLos(p)
        : { picto: tekst(p && p.picto), label: tekst(p && p.label), noot: tekst(p && p.noot) }));
      const src = veiligBeeld(v.illustratie && v.illustratie.src);
      if (v.illustratie && tekst(v.illustratie.figuur)) uit.illustratie = { figuur: v.illustratie.figuur };
      else if (src) uit.illustratie = { src, alt: tekst(v.illustratie.alt) };
    } else if (uit.type === 'doen-niet-doen') {
      uit.wel = lijst(v.wel).map(normPunt);
      uit.niet = lijst(v.niet).map(normPunt);
    } else {
      uit.items = lijst(v.items).map(normPunt);
    }
    return uit;
  }

  /* Maakt van eender welk ingelezen bestand een kaart in de vaste vorm, of geeft een fout. */
  function normaliseer(bron) {
    if (!bron || typeof bron !== 'object' || !bron.kop || typeof bron.kop !== 'object' || !Array.isArray(bron.vensters)) {
      throw new Error('geen instructiekaart');
    }
    const kop = {};
    for (const v of KOPVELDEN) {
      const w = tekst(bron.kop[v.sleutel]);
      kop[v.sleutel] = v.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(w) ? '' : w;
    }
    const vensters = bron.vensters.map(normVenster);
    const gezien = new Set();
    for (const v of vensters) {
      while (gezien.has(v.id)) v.id = nieuwId();
      gezien.add(v.id);
    }
    const uit = { schema: 1, kop, vensters };
    /* eigen indeling van de presentatie: welke vensters samen op een dia staan */
    const dias = bron.presentatie && Array.isArray(bron.presentatie.dias) ? bron.presentatie.dias : [];
    const schoon = dias.filter(Array.isArray)
      .map((dia) => dia.filter((id) => typeof id === 'string' && gezien.has(id)))
      .filter((dia) => dia.length);
    if (schoon.length) uit.presentatie = { dias: schoon };
    return uit;
  }

  function vandaag() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* Een nieuwe kaart begint met de vier vaste vensters van Westlandia. */
  function nieuweKaart() {
    return normaliseer({
      kop: { soort: 'Veiligheidsinstructiekaart', versie: '001', datum: vandaag(), geldigVanaf: vandaag() },
      vensters: [
        { titel: 'Persoonlijke beschermingsmiddelen', soort: 'gebod', breedte: 'vol', type: 'pictogrammen', inleiding: 'Draagplicht' },
        { titel: 'Aandachtspunten', soort: 'gevaar', breedte: 'links', type: 'punten' },
        { titel: 'EHBO', soort: 'ehbo', breedte: 'rechts', type: 'punten' },
        {
          titel: 'Algemeen', soort: 'info', breedte: 'rechts', type: 'punten',
          items: [
            { tekst: 'Raadpleeg ook de algemene veiligheidsinstructiekaarten' },
            { tekst: 'Raadpleeg ook de specifieke instructiekaarten (zie overzichtstabel)' },
          ],
        },
      ],
    });
  }

  /* Diepe kopie; lange teksten (de foto's) worden gedeeld, niet verdubbeld. */
  function kloon(w) {
    if (Array.isArray(w)) return w.map(kloon);
    if (w && typeof w === 'object') {
      const uit = {};
      for (const k of Object.keys(w)) uit[k] = kloon(w[k]);
      return uit;
    }
    return w;
  }

  function verplaats(rij, van, naar) {
    if (naar < 0 || naar >= rij.length || van === naar) return;
    rij.splice(naar, 0, rij.splice(van, 1)[0]);
  }

  /* ---------- wijzigen, ongedaan maken ---------- */

  /* Bewaart de toestand vóór een wijziging. Typen in hetzelfde veld telt als één stap. */
  function vastleggen(bron) {
    const nu = Date.now();
    const zelfdeVeld = bron && bron === laatsteBron && nu - laatsteTijd < 2000;
    laatsteBron = bron || null;
    laatsteTijd = nu;
    if (zelfdeVeld) return;
    verleden.push(kloon(staat.kaart));
    if (verleden.length > 80) verleden.shift();
    toekomst = [];
  }

  function wijzig(bron, doe) {
    vastleggen(bron);
    doe();
    staat.gewijzigd = true;
    planVoorbeeld();
    werkbalk();
  }

  /* Een wijziging die de opbouw van het formulier verandert (toevoegen, verwijderen, verplaatsen, keuze). */
  function structuur(doe, focus) {
    wijzig(null, doe);
    tekenFormulier(typeof focus === 'function' ? focus() : focus);
  }

  function herstel(uit, naar) {
    if (!uit.length) return;
    naar.push(staat.kaart);
    staat.kaart = uit.pop();
    laatsteBron = null;
    staat.gewijzigd = true;
    tekenFormulier();
    tekenVoorbeeld();
    werkbalk();
  }
  const ongedaan = () => herstel(verleden, toekomst);
  const opnieuw = () => herstel(toekomst, verleden);

  /* ---------- werkbalk en meldingen ---------- */

  const actieKnop = (naam) => document.querySelector('[data-actie="' + naam + '"]');

  function werkbalk() {
    naamEl.textContent = (staat.naam || staat.zonderNaam) + (staat.gewijzigd ? ' · niet opgeslagen' : '');
    actieKnop('ongedaan').disabled = !verleden.length;
    actieKnop('opnieuw').disabled = !toekomst.length;
  }

  let meldingKlok = 0;
  function meld(boodschap, fout) {
    meldingEl.textContent = boodschap;
    meldingEl.className = 'melding' + (fout ? ' fout' : '');
    meldingEl.hidden = false;
    clearTimeout(meldingKlok);
    meldingKlok = setTimeout(() => { meldingEl.hidden = true; }, fout ? 7000 : 3500);
  }

  /* ---------- voorbeeld (het blad rechts) ---------- */

  let voorbeeldGepland = false;
  function planVoorbeeld() {
    if (voorbeeldGepland) return;
    voorbeeldGepland = true;
    requestAnimationFrame(tekenVoorbeeld);
  }

  function tekenVoorbeeld() {
    voorbeeldGepland = false;
    const ongemeten = K.ontbrekendeMaten(staat.kaart, bib);
    const kop = staat.kaart.kop;
    const naam = [kop.code, kop.titel].filter(Boolean).join(' – ') || 'Instructiekaart';
    if (weergave === 'presentatie') {
      const uit = K.toonPresentatie(staat.kaart, bib, bladen);
      indeling = uit.indeling;
      tussenstroken();
      paginasEl.textContent = uit.dias + ' dia’s';
      paginasEl.hidden = false;
      document.title = naam + ' – presentatie';   // ook de voorgestelde naam van de pdf
      automatischKnop.disabled = !staat.kaart.presentatie;
    } else {
      const uit = K.toon(staat.kaart, bib, bladen);
      paginasEl.textContent = uit.paginas + ' pagina’s';
      paginasEl.hidden = uit.paginas < 2;
      document.title = naam;
    }
    schaal();
    controleerPasvorm();
    /* Beelden waarvan de maat nog niet gekend was: eerst opmeten, dan klopt de verdeling over de pagina's zeker. */
    if (ongemeten.length) K.meet(ongemeten).then(tekenVoorbeeld);
  }

  /* "Groot" vult de breedte, "Hele blad" toont de volledige A4. De keuze wordt onthouden op deze computer. */
  let zoom = 'breedte';
  try { if (localStorage.getItem('instructiekaart-zoom') === 'blad') zoom = 'blad'; } catch (fout) { /* geen opslag: niet erg */ }

  function zetZoom(keuze) {
    zoom = keuze === 'blad' ? 'blad' : 'breedte';
    try { localStorage.setItem('instructiekaart-zoom', zoom); } catch (fout) { /* geen opslag: niet erg */ }
    for (const b of document.querySelectorAll('[data-zoom]')) b.setAttribute('aria-pressed', String(b.dataset.zoom === zoom));
    schaal();
  }

  /* Toont het blad zo groot als de ruimte toelaat, zonder de opmaak zelf te veranderen. */
  function schaal() {
    const blad = bladen.firstElementChild;
    if (!blad) return;
    const breed = (voorbeeld.clientWidth - 48) / blad.offsetWidth;
    const hoog = (voorbeeld.clientHeight - 48 - (uitleg.hidden ? 0 : uitleg.offsetHeight + 16)) / blad.offsetHeight;
    const z = Math.max(0.2, zoom === 'blad' ? Math.min(breed, hoog) : Math.min(1.1, breed));
    bladen.style.transform = 'scale(' + z + ')';
    kader.style.width = bladen.offsetWidth * z + 'px';
    kader.style.height = bladen.offsetHeight * z + 'px';
  }

  /* De vensters lopen vanzelf door op een volgende pagina. Alleen een venster dat op zich groter is
     dan een pagina past nergens: dan valt de onderkant weg, en daar waarschuwen we voor. */
  function controleerPasvorm() {
    let teVol = false;
    if (weergave === 'presentatie') {
      teVol = !!bladen.querySelector('.dia.te-vol');   // dat bepaalt K.toonPresentatie bij het inpassen
      teVolEl.textContent = 'Een dia is te vol';
      teVolEl.title = 'Zet een van de vensters op die dia op een eigen dia, of maak de tekst korter.';
    } else {
      for (const blad of bladen.querySelectorAll('.blad')) {
        const vol = blad.scrollHeight > blad.clientHeight + 1;
        blad.classList.toggle('te-vol', vol);
        teVol = teVol || vol;
      }
      teVolEl.textContent = 'Een venster is te groot voor één pagina';
      teVolEl.title = '';
    }
    teVolEl.hidden = !teVol;
  }

  /* ---------- kaart of presentatie ---------- */

  let weergave = 'kaart';
  let indeling = [];   // welke vensters samen op een dia staan, zoals laatst getekend
  const papier = document.head.appendChild(document.createElement('style'));

  function zetWeergave(keuze) {
    weergave = keuze === 'presentatie' ? 'presentatie' : 'kaart';
    const dias = weergave === 'presentatie';
    for (const b of document.querySelectorAll('[data-weergave]')) b.setAttribute('aria-pressed', String(b.dataset.weergave === weergave));
    bladen.classList.toggle('dias', dias);
    uitleg.hidden = !dias;
    papier.textContent = dias ? '@page { size: 338.67mm 190.5mm; margin: 0; }' : '';
    actieKnop('afdrukken').title = dias ? 'De presentatie afdrukken of opslaan als pdf (Ctrl+P)' : 'Afdrukken of opslaan als pdf (Ctrl+P)';
    voorbeeld.scrollTop = 0;
    tekenVoorbeeld();
  }

  /* Stroken tussen de dia's: wie er een venster op loslaat, geeft het een eigen dia op die plek.
     Dia's van één venster dat over meer dia's doorloopt, krijgen er geen strook tussen. */
  function tussenstroken() {
    const strook = (plek) => K.el('div', { class: 'dia-tussen', 'data-plek': plek, text: 'Hier als aparte dia' });
    let vorige = null;
    for (const dia of bladen.querySelectorAll('.dia[data-groep]')) {
      if (dia.dataset.groep !== vorige) dia.before(strook(Number(dia.dataset.groep)));
      vorige = dia.dataset.groep;
      for (const v of dia.querySelectorAll('.venster[data-id]')) v.draggable = true;
      for (const img of dia.querySelectorAll('img')) img.draggable = false;   // zo versleep je het venster, niet een foto
    }
    bladen.append(strook(indeling.length));
  }

  /* Zet venster `id` op een andere dia (doel.groep, voor of na doel.venster) of op een eigen,
     nieuwe dia (doel.plek: de plaats tussen de dia's). */
  function zetOpDia(id, doel) {
    const dias = indeling.map((dia) => dia.slice());
    const bron = dias.find((dia) => dia.includes(id));
    if (!bron) return;
    const na = doel.strook ? dias[doel.plek - 1] || null : null;
    const doelDia = doel.strook ? null : dias[doel.groep];
    bron.splice(bron.indexOf(id), 1);
    if (doelDia) {
      const plek = doel.venster ? doelDia.indexOf(doel.venster.dataset.id) + (doel.na ? 1 : 0) : doelDia.length;
      doelDia.splice(plek, 0, id);
    } else {
      dias.splice(na ? dias.indexOf(na) + 1 : 0, 0, [id]);
    }
    const nieuw = dias.filter((dia) => dia.length);
    if (JSON.stringify(nieuw) === JSON.stringify(indeling)) return;
    const vanzelf = JSON.stringify(nieuw) === JSON.stringify(staat.kaart.vensters.map((v) => [v.id]));
    wijzig(null, () => {
      if (vanzelf) delete staat.kaart.presentatie;
      else staat.kaart.presentatie = { dias: nieuw };
    });
  }

  function automatischIndelen() {
    if (staat.kaart.presentatie) wijzig(null, () => { delete staat.kaart.presentatie; });
  }

  /* ---------- bouwstenen van het formulier ---------- */

  /* Kleine tekens voor de knoppen: vaste, eigen tekeningen. */
  const TEKENS = {
    omhoog: '<path d="M12 19V6M6 11l6-6 6 6"/>',
    omlaag: '<path d="M12 5v13M6 13l6 6 6-6"/>',
    kruis: '<path d="M6 6l12 12M18 6 6 18"/>',
    kopie: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5 15.5V6.5a2 2 0 0 1 2-2h8.5"/>',
    open: '<path d="m6 9 6 6 6-6"/>',
    dicht: '<path d="m9 6 6 6-6 6"/>',
    greep: [6, 12, 18].map((y) => '<circle cx="9" cy="' + y + '" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="' + y + '" r="1.5" fill="currentColor" stroke="none"/>').join(''),
  };

  function teken(naam) {
    const houder = document.createElement('span');
    houder.innerHTML = '<svg class="teken" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TEKENS[naam] + '</svg>';
    return houder.firstChild;
  }

  function knop(inhoud, titel, actie, opties) {
    opties = opties || {};
    const b = el('button', { type: 'button', class: opties.klasse || (opties.weg ? 'mini weg' : 'mini'), title: titel, 'aria-label': opties.klasse ? null : titel, disabled: opties.uit }, inhoud);
    b.addEventListener('click', (e) => { e.stopPropagation(); actie(); });
    return b;
  }

  function veld(naam, invoer, breed) {
    return el('label', { class: 'veld' + (breed ? ' breed' : '') }, el('span', { text: naam }), invoer);
  }

  function groep(naam, inhoud) {
    return el('div', { class: 'veld breed' }, el('span', { text: naam }), inhoud);
  }

  function tekstInvoer(doel, sleutel, opties) {
    opties = opties || {};
    const inv = opties.rijen
      ? el('textarea', { rows: opties.rijen, placeholder: opties.tip, 'aria-label': opties.tip })
      : el('input', { type: opties.type || 'text', placeholder: opties.tip, 'aria-label': opties.tip });
    inv.value = doel[sleutel] || '';
    inv.addEventListener('input', () => {
      wijzig(inv, () => { doel[sleutel] = inv.value; });
      if (opties.bij) opties.bij(inv.value);
    });
    return inv;
  }

  function vinkje(naam, doel, sleutel) {
    const inv = el('input', { type: 'checkbox' });
    inv.checked = !!doel[sleutel];
    inv.addEventListener('change', () => wijzig(null, () => {
      if (inv.checked) doel[sleutel] = true; else delete doel[sleutel];
    }));
    return el('label', { class: 'vinkje breed' }, inv, el('span', { text: naam }));
  }

  /* Een rij knoppen waarvan er één gekozen is. */
  function keuze(opties, huidig, zet, naam) {
    return el('div', { class: 'keuze', role: 'group' }, ...opties.map((o) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(o.id === huidig), 'data-keuze': naam + '-' + o.id },
        o.stip && el('span', { class: 'stip ' + o.id }), o.naam);
      b.addEventListener('click', () => {
        if (o.id !== huidig) structuur(() => zet(o.id), '[data-keuze="' + naam + '-' + o.id + '"]');
      });
      return b;
    }));
  }

  function volgorde(rij, i, wat) {
    return el('span', { class: 'knoppen' },
      knop(teken('omhoog'), wat + ' naar boven', () => structuur(() => verplaats(rij, i, i - 1)), { uit: i === 0 }),
      knop(teken('omlaag'), wat + ' naar onder', () => structuur(() => verplaats(rij, i, i + 1)), { uit: i === rij.length - 1 }),
      knop(teken('kruis'), wat + ' verwijderen', () => structuur(() => { rij.splice(i, 1); }), { weg: true }));
  }

  /* Een inklapbaar blok in het formulier. */
  function blok(id, titel, knoppen, maakInhoud, klasse) {
    const open = staat.open.has(id);
    const kop = el('div', { class: 'blok-kop', role: 'button', tabindex: '0', 'aria-expanded': String(open) },
      el('span', { class: 'pijl' }, teken(open ? 'open' : 'dicht')), titel, knoppen);
    const schakel = () => {
      if (open) staat.open.delete(id); else staat.open.add(id);
      tekenFormulier('[data-blok="' + id + '"] > .blok-kop');
    };
    kop.addEventListener('click', (e) => { if (!e.target.closest('button, .greep')) schakel(); });
    kop.addEventListener('keydown', (e) => {
      if (e.target === kop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); schakel(); }
    });
    return el('section', { class: 'blok' + (open ? ' open' : '') + (klasse ? ' ' + klasse : ''), 'data-blok': id },
      kop, open && el('div', { class: 'blok-inhoud' }, maakInhoud()));
  }

  /* ---------- formulier: kop en vensters ---------- */

  function kopBlok() {
    const titel = el('span', { class: 'blok-titel' }, el('span', { class: 'naam', text: 'Kop van de kaart' }));
    return blok('kop', titel, null, () =>
      el('div', { class: 'velden-raster' },
        ...KOPVELDEN.map((v) => veld(v.naam, tekstInvoer(staat.kaart.kop, v.sleutel, v), v.breed))));
  }

  function vensterBlok(v, i) {
    const vensters = staat.kaart.vensters;
    const type = TYPES.find((t) => t.id === v.type);
    const naam = el('span', { class: 'naam', text: v.titel || '(zonder titel)' });
    const titel = el('span', { class: 'blok-titel' },
      el('span', { class: 'greep', title: 'Sleep om te verplaatsen' }, teken('greep')),
      el('span', { class: 'stip ' + v.soort }),
      naam,
      el('span', { class: 'bij', text: type.naam + (v.breedte === 'vol' ? '' : ' · ' + v.breedte) }));
    const knoppen = el('span', { class: 'knoppen' },
      knop(teken('omhoog'), 'Venster naar boven', () => structuur(() => verplaats(vensters, i, i - 1)), { uit: i === 0 }),
      knop(teken('omlaag'), 'Venster naar onder', () => structuur(() => verplaats(vensters, i, i + 1)), { uit: i === vensters.length - 1 }),
      knop(teken('kopie'), 'Venster dupliceren', () => structuur(() => {
        const kopie = kloon(v);
        kopie.id = nieuwId();
        vensters.splice(i + 1, 0, kopie);
        staat.open.add(kopie.id);
      })),
      knop(teken('kruis'), 'Venster verwijderen', () => structuur(() => { vensters.splice(i, 1); }), { weg: true }));
    const b = blok(v.id, titel, knoppen, () => vensterInhoud(v, naam), 'venster-blok');
    sleepbaar(b, i);
    return b;
  }

  function vensterInhoud(v, naamInKop) {
    const delen = [
      veld('Titel', tekstInvoer(v, 'titel', { bij: (w) => { naamInKop.textContent = w || '(zonder titel)'; } }), true),
      groep('Kleur', keuze(SOORTEN, v.soort, (id) => { v.soort = id; }, v.id + '-soort')),
      groep('Plaats op het blad', keuze(BREEDTES, v.breedte, (id) => { v.breedte = id; }, v.id + '-breedte')),
    ];
    if (v.type === 'punten' || v.type === 'stappen') {
      const weergaven = [{ id: 'punten', naam: 'Punten' }, { id: 'stappen', naam: 'Genummerde stappen' }];
      delen.push(groep('Weergave', keuze(weergaven, v.type, (id) => { v.type = id; }, v.id + '-type')));
    }
    delen.push(vinkje('Begin dit venster op een nieuwe pagina', v, 'nieuwePagina'));
    delen.push(veld('Kopje boven de inhoud (optioneel)', tekstInvoer(v, 'inleiding'), true));
    if (v.type === 'pictogrammen') {
      delen.push(pictoLijst(v), figuurVeld(v));
    } else if (v.type === 'doen-niet-doen') {
      delen.push(puntenLijst(v.wel, 'Wel doen', 'Regel', v.id + '-wel'), puntenLijst(v.niet, 'Niet doen', 'Regel', v.id + '-niet'));
    } else {
      const stappen = v.type === 'stappen';
      delen.push(puntenLijst(v.items, stappen ? 'Stappen' : 'Punten', stappen ? 'Stap' : 'Punt', v.id + '-punt'));
    }
    return el('div', { class: 'velden-raster' }, ...delen);
  }

  function toevoegBlok() {
    return el('div', { class: 'toevoegen' }, ...TYPES.map((t) => {
      const b = el('button', { type: 'button' }, el('strong', { text: '+ ' + t.naam }), el('span', { text: t.uitleg }));
      b.addEventListener('click', () => {
        const v = normVenster({ type: t.id, soort: t.id === 'pictogrammen' ? 'gebod' : 'info' });
        structuur(() => { staat.kaart.vensters.push(v); staat.open.add(v.id); }, '[data-blok="' + v.id + '"] input');
      });
      return b;
    }));
  }

  function tekenFormulier(focus) {
    const stand = formulier.scrollTop;
    formulier.replaceChildren(
      el('p', { class: 'tip', text: 'Klik op een onderdeel van het blad, of hieronder, om het aan te passen.' }),
      kopBlok(),
      el('div', { class: 'paneel-titel', text: 'Vensters' }),
      ...staat.kaart.vensters.map(vensterBlok),
      el('div', { class: 'paneel-titel', text: 'Venster toevoegen' }),
      toevoegBlok());
    formulier.scrollTop = stand;
    const doel = focus && formulier.querySelector(focus);
    if (doel) {
      doel.focus({ preventScroll: true });
      doel.scrollIntoView({ block: 'nearest' });
    }
  }

  /* Vensters verslepen aan het greepje in de titelbalk. */
  let sleepVan = null;

  function wisSleep() {
    for (const b of formulier.querySelectorAll('.sleep-voor, .sleep-na')) b.classList.remove('sleep-voor', 'sleep-na');
  }

  function sleepbaar(blokEl, i) {
    const greep = blokEl.querySelector('.greep');
    const onderHelft = (e) => {
      const r = blokEl.getBoundingClientRect();
      return e.clientY > r.top + r.height / 2;
    };
    greep.draggable = true;
    greep.addEventListener('dragstart', (e) => {
      sleepVan = i;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'venster');
      e.dataTransfer.setDragImage(blokEl, 16, 16);
      requestAnimationFrame(() => blokEl.classList.add('wordt-gesleept'));
    });
    greep.addEventListener('dragend', () => {
      sleepVan = null;
      wisSleep();
      blokEl.classList.remove('wordt-gesleept');
    });
    blokEl.addEventListener('dragover', (e) => {
      if (sleepVan == null) return;
      e.preventDefault();
      wisSleep();
      blokEl.classList.add(onderHelft(e) ? 'sleep-na' : 'sleep-voor');
    });
    blokEl.addEventListener('drop', (e) => {
      if (sleepVan == null) return;
      e.preventDefault();
      e.stopPropagation();
      const van = sleepVan;
      let naar = i + (onderHelft(e) ? 1 : 0);
      if (van < naar) naar--;
      sleepVan = null;
      wisSleep();
      if (van !== naar) structuur(() => verplaats(staat.kaart.vensters, van, naar));
    });
  }

  /* ---------- formulier: inhoud van een venster ---------- */

  function pictoDuim(code) {
    const p = bib.pictogrammen[code];
    return p ? el('img', { src: p.src, alt: p.naam }) : el('span', { text: '?' });
  }

  /* Losse tekst in het formulier: een tekstvak dat je tussen de andere elementen kunt schuiven. */
  function losBlok(rij, item, i, sleutel) {
    const invoer = tekstInvoer(item, 'tekst', { rijen: 2, tip: 'Losse tekst' });
    invoer.dataset.punt = sleutel + '-' + i;
    return el('div', { class: 'los-blok' },
      el('div', { class: 'lijst-kop', text: 'Losse tekst' }),
      el('div', { class: 'rij' }, invoer, volgorde(rij, i, 'Tekst')));
  }

  function losKnop(rij, sleutel) {
    return knop('+ Losse tekst', 'Een alinea toevoegen; met de pijltjes zet je ze tussen de andere elementen', () => structuur(
      () => { rij.push({ los: true, tekst: '' }); },
      () => '[data-punt="' + sleutel + '-' + (rij.length - 1) + '"]'), { klasse: 'grootknop' });
  }

  function pictoLijst(v) {
    const sleutel = v.id + '-picto';
    return el('div', { class: 'lijst breed' },
      el('div', { class: 'lijst-kop', text: 'Pictogrammen' }),
      ...v.items.map((item, i) => (item.los ? losBlok(v.items, item, i, sleutel) : el('div', { class: 'rij' },
        knop(pictoDuim(item.picto), 'Ander pictogram kiezen', () => kiesPictogram((code) => structuur(() => { item.picto = code; })), { klasse: 'picto-knop' }),
        el('div', { class: 'rij-velden' },
          tekstInvoer(item, 'label', { tip: 'Woord bij het pictogram' }),
          tekstInvoer(item, 'noot', { tip: 'Extra uitleg (optioneel)' })),
        volgorde(v.items, i, 'Pictogram')))),
      el('div', { class: 'lijst-acties' },
        knop('+ Pictogram toevoegen', 'Kies een pictogram uit de lijst', () => kiesPictogram((code) => structuur(() => {
          v.items.push({ picto: code, label: bib.pictogrammen[code].naam, noot: '' });
        })), { klasse: 'grootknop' }),
        losKnop(v.items, sleutel)));
  }

  /* Klein voorbeeld van een beeld in het formulier: een foto, een pictogram of een figuur uit de lijst. */
  function duim(beeld) {
    const uitLijst = beeld.picto ? bib.pictogrammen[beeld.picto] : beeld.figuur ? bib.figuren[beeld.figuur] : null;
    if (uitLijst) return el('img', { class: 'duim', src: uitLijst.src, alt: uitLijst.naam });
    return beeld.src ? el('img', { class: 'duim', src: beeld.src, alt: '' }) : el('span', { class: 'duim', text: '?' });
  }

  /* De figuur rechts in een venster met pictogrammen: uit de lijst met figuren, of een eigen afbeelding. */
  function figuurVeld(v) {
    const bestand = el('input', { type: 'file', accept: 'image/*', hidden: true });
    const zet = async (bestanden) => {
      const nieuw = await leesBeelden(bestanden.slice(0, 1));
      if (nieuw.length) structuur(() => { v.illustratie = nieuw[0]; });
    };
    bestand.addEventListener('change', () => zet([...bestand.files]));
    const huidig = v.illustratie;
    const naam = huidig && (huidig.figuur ? (bib.figuren[huidig.figuur] || {}).naam || huidig.figuur : huidig.alt || 'Eigen afbeelding');
    const zone = el('div', { class: 'lijst breed' },
      el('div', { class: 'lijst-kop', text: 'Figuur naast de pictogrammen (optioneel)' }),
      huidig && el('div', { class: 'rij beeld-rij' },
        duim(huidig),
        el('span', { class: 'rij-velden tip', text: naam }),
        el('span', { class: 'knoppen' },
          knop(teken('kruis'), 'Figuur verwijderen', () => structuur(() => { delete v.illustratie; }), { weg: true }))),
      el('div', { class: 'beeld-acties' },
        knop('+ Figuur', 'Kies een tekening uit de lijst met figuren', () => kiesFiguur((code) => structuur(() => { v.illustratie = { figuur: code }; })), { klasse: 'tekstknop' }),
        knop('+ Eigen afbeelding', 'Kies een afbeelding van je computer', () => bestand.click(), { klasse: 'tekstknop' }),
        el('span', { class: 'tip', text: 'of sleep een afbeelding hierheen' })),
      bestand);
    fotoDoel(zone, zet);
    return zone;
  }

  function puntenLijst(punten, titel, enkel, sleutel) {
    return el('div', { class: 'lijst breed' },
      el('div', { class: 'lijst-kop', text: titel }),
      ...punten.map((punt, i) => (punt.los ? losBlok(punten, punt, i, sleutel) : puntBlok(punten, punt, i, sleutel))),
      el('div', { class: 'lijst-acties' },
        knop('+ ' + enkel, enkel + ' toevoegen', () => structuur(
          () => { punten.push({ tekst: '', beelden: [] }); },
          () => '[data-punt="' + sleutel + '-' + (punten.length - 1) + '"]'), { klasse: 'grootknop' }),
        losKnop(punten, sleutel)));
  }

  function puntBlok(punten, punt, i, sleutel) {
    const kiezer = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const voegToe = async (bestanden) => {
      const nieuw = await leesBeelden(bestanden);
      if (nieuw.length) structuur(() => { for (const n of nieuw) punt.beelden.push({ ...n, grootte: 'middel', bijschrift: '' }); });
    };
    kiezer.addEventListener('change', () => voegToe([...kiezer.files]));
    const invoer = tekstInvoer(punt, 'tekst', { rijen: 2, tip: 'Korte tekst' });
    invoer.dataset.punt = sleutel + '-' + i;
    const b = el('div', { class: 'punt-blok' },
      el('div', { class: 'rij' }, invoer, volgorde(punten, i, 'Regel')),
      ...punt.beelden.map((beeld, j) => beeldRij(punt.beelden, beeld, j)),
      el('div', { class: 'beeld-acties' },
        knop('+ Foto', 'Kies een of meer foto’s', () => kiezer.click(), { klasse: 'tekstknop' }),
        knop('+ Figuur', 'Kies een tekening uit de lijst met figuren', () => kiesFiguur((code) => structuur(() => {
          punt.beelden.push({ figuur: code, grootte: 'middel', bijschrift: '' });
        })), { klasse: 'tekstknop' }),
        knop('+ Pictogram', 'Kies een pictogram uit de lijst', () => kiesPictogram((code) => structuur(() => {
          punt.beelden.push({ picto: code, grootte: 'middel', bijschrift: '' });
        })), { klasse: 'tekstknop' }),
        el('span', { class: 'tip', text: 'of sleep of plak een foto hier' })),
      kiezer);
    fotoDoel(b, voegToe);
    return b;
  }

  function beeldRij(beelden, beeld, j) {
    const grootte = el('select', { 'aria-label': 'Grootte' },
      ...GROOTTES.map((g) => el('option', { value: g.id, text: g.naam, selected: g.id === beeld.grootte })));
    grootte.addEventListener('change', () => wijzig(null, () => { beeld.grootte = grootte.value; }));
    return el('div', { class: 'rij beeld-rij' },
      duim(beeld),
      el('div', { class: 'rij-velden' }, grootte, tekstInvoer(beeld, 'bijschrift', { tip: 'Bijschrift' })),
      volgorde(beelden, j, 'Beeld'));
  }

  /* ---------- foto's inlezen ---------- */

  const heeftBestanden = (e) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

  /* Verkleint een foto en geeft ze terug als ingesloten beeld (jpg, of png als ze doorzichtig is). */
  async function leesBeeld(bestand) {
    if (!bestand.type.startsWith('image/')) throw new Error('geen beeld');
    const adres = URL.createObjectURL(bestand);
    try {
      const img = new Image();
      img.src = adres;
      await img.decode();
      const factor = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const doek = document.createElement('canvas');
      doek.width = Math.max(1, Math.round(img.naturalWidth * factor));
      doek.height = Math.max(1, Math.round(img.naturalHeight * factor));
      const ctx = doek.getContext('2d');
      ctx.drawImage(img, 0, 0, doek.width, doek.height);
      let doorzichtig = false;
      if (bestand.type !== 'image/jpeg') {
        const punten = ctx.getImageData(0, 0, doek.width, doek.height).data;
        for (let i = 3; i < punten.length; i += 4) {
          if (punten[i] < 250) { doorzichtig = true; break; }
        }
      }
      return doorzichtig ? doek.toDataURL('image/png') : doek.toDataURL('image/jpeg', 0.86);
    } finally {
      URL.revokeObjectURL(adres);
    }
  }

  async function leesBeelden(bestanden) {
    const uit = [];
    for (const bestand of bestanden) {
      try {
        uit.push({ src: await leesBeeld(bestand), alt: bestand.name.replace(/\.[^.]+$/, '') });
      } catch (fout) {
        meld('“' + bestand.name + '” kan niet gelezen worden. Gebruik een jpg- of png-bestand.', true);
      }
    }
    return uit;
  }

  /* Maakt van een deel van het formulier een plek waar je foto's kunt neerzetten of plakken. */
  function fotoDoel(doel, klaar) {
    doel.addEventListener('dragover', (e) => {
      if (!heeftBestanden(e)) return;
      e.preventDefault();
      e.stopPropagation();
      doel.classList.add('sleep-doel');
    });
    doel.addEventListener('dragleave', () => doel.classList.remove('sleep-doel'));
    doel.addEventListener('drop', (e) => {
      if (!heeftBestanden(e)) return;
      e.preventDefault();
      e.stopPropagation();
      doel.classList.remove('sleep-doel');
      klaar([...e.dataTransfer.files]);
    });
    doel.addEventListener('paste', (e) => {
      const beelden = [...((e.clipboardData && e.clipboardData.files) || [])].filter((b) => b.type.startsWith('image/'));
      if (!beelden.length) return;
      e.preventDefault();
      klaar(beelden);
    });
  }

  /* ---------- kiezer voor pictogrammen en voor figuren ---------- */

  const kiezer = document.getElementById('picto-kiezer');
  const kiezerTitel = document.getElementById('picto-titel');
  const kiezerNoot = document.getElementById('picto-noot');
  const zoekVeld = document.getElementById('picto-zoek');
  const tabs = document.getElementById('picto-tabs');
  const raster = document.getElementById('picto-raster');

  /* Eén venster, twee lijsten: de officiële pictogrammen en de figuren. */
  const LIJSTEN = {
    picto: {
      titel: 'Pictogram kiezen', tip: 'Zoeken, bv. handschoenen', leeg: 'Geen pictogram gevonden.',
      alles: () => bib.pictogrammen, groepen: GROEPEN, groepVan: (p) => p.soort, groep: '', toonCode: true,
    },
    figuur: {
      titel: 'Figuur kiezen', tip: 'Zoeken, bv. tillen', leeg: 'Geen figuur gevonden.',
      alles: () => bib.figuren, groepen: FIGUURGROEPEN, groepVan: (f) => f.groep, groep: '', toonCode: false,
    },
  };
  let actief = LIJSTEN.picto;
  let kiezerKlaar = null;

  function kies(soort, klaar) {
    actief = LIJSTEN[soort];
    kiezerKlaar = klaar;
    kiezerTitel.textContent = actief.titel;
    zoekVeld.placeholder = actief.tip;
    zoekVeld.value = '';
    const vermeldingen = soort === 'figuur' ? Object.values(bib.bronnen).map((b) => b.vermelding).filter(Boolean) : [];
    kiezerNoot.textContent = vermeldingen.length
      ? 'Bron: ' + vermeldingen.join(' · ') + '. De bronvermelding komt vanzelf onderaan de kaart.' : '';
    kiezerNoot.hidden = !vermeldingen.length;
    tekenKiezer();
    kiezer.showModal();
  }
  const kiesPictogram = (klaar) => kies('picto', klaar);
  const kiesFiguur = (klaar) => kies('figuur', klaar);

  function tekenKiezer() {
    const term = zoekVeld.value.trim().toLowerCase();
    const alle = Object.entries(actief.alles());
    const groepen = [{ id: '', naam: 'Alles' }, ...actief.groepen.filter((g) => alle.some(([, p]) => actief.groepVan(p) === g.id))];
    tabs.replaceChildren(...groepen.map((g) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(g.id === actief.groep) }, g.naam);
      b.addEventListener('click', () => { actief.groep = g.id; tekenKiezer(); });
      return b;
    }));
    const gevonden = alle.filter(([code, p]) =>
      (!actief.groep || actief.groepVan(p) === actief.groep) &&
      (!term || (p.naam + ' ' + code + ' ' + (p.zoek || '')).toLowerCase().includes(term)));
    if (!gevonden.length) {
      raster.replaceChildren(el('div', { class: 'kiezer-leeg', text: actief.leeg }));
      return;
    }
    raster.replaceChildren(...gevonden.map(([code, p]) => {
      const b = el('button', { type: 'button', title: p.naam, 'data-code': code },
        el('img', { src: p.src, alt: '', loading: 'lazy' }), el('span', { text: p.naam }), actief.toonCode && el('small', { text: code }));
      b.addEventListener('click', () => {
        const klaar = kiezerKlaar;
        kiezerKlaar = null;
        kiezer.close();
        if (klaar) klaar(code);
      });
      return b;
    }));
  }

  zoekVeld.addEventListener('input', () => { actief.groep = ''; tekenKiezer(); });   // zoeken gaat altijd door alles
  document.getElementById('picto-sluiten').addEventListener('click', () => kiezer.close());
  kiezer.addEventListener('click', (e) => { if (e.target === kiezer) kiezer.close(); });   // klik naast het venster

  /* ---------- bestanden: nieuw, openen, opslaan ---------- */

  function zetKaart(kaart, naam, handvat, zonderNaam) {
    staat.kaart = kaart;
    staat.naam = naam || '';
    staat.zonderNaam = zonderNaam || 'Nieuwe kaart';
    staat.handvat = handvat || null;
    staat.gewijzigd = false;
    staat.open = new Set();
    verleden = [];
    toekomst = [];
    laatsteBron = null;
    tekenFormulier();
    formulier.scrollTop = 0;
    tekenVoorbeeld();
    werkbalk();
  }

  const magWeg = () => !staat.gewijzigd || window.confirm('De wijzigingen zijn nog niet opgeslagen. Toch doorgaan?');

  function nieuw() {
    if (!magWeg()) return;
    zetKaart(nieuweKaart());
    staat.open.add('kop');
    tekenFormulier('[data-blok="kop"] input');
  }

  /* Leest een gekozen bestand in. De vraag over niet-opgeslagen wijzigingen komt pas hier,
     ná het kiezen: een vraag vooraf kan de browser het bestandsvenster doen weigeren. */
  function laad(inhoud, naam, handvat) {
    let kaart;
    try {
      kaart = normaliseer(JSON.parse(inhoud));
    } catch (fout) {
      meld('“' + naam + '” is geen instructiekaart.', true);
      return false;
    }
    if (!magWeg()) return false;
    zetKaart(kaart, naam, handvat);
    onthoud();
    return true;
  }

  /* ---------- kaarten die je al opsloeg of opende ---------- */

  /* De editor onthoudt in deze browser de laatste kaarten: hun naam, de inhoud zoals ze toen was en,
     waar de browser dat kan (Chrome, Edge), het bestand zelf. Lukt onthouden niet, dan werkt alles
     gewoon verder zonder lijst. */
  const geheugen = (function () {
    let basis = null;
    const open = () => basis || (basis = new Promise((klaar, mis) => {
      const vraag = indexedDB.open('instructiekaart', 1);
      vraag.onupgradeneeded = () => vraag.result.createObjectStore('kaarten', { keyPath: 'naam' });
      vraag.onsuccess = () => klaar(vraag.result);
      vraag.onerror = () => mis(vraag.error);
    }));
    const doe = async (wijze, werk) => {
      const db = await open();
      return new Promise((klaar, mis) => {
        const t = db.transaction('kaarten', wijze);
        const vraag = werk(t.objectStore('kaarten'));
        t.oncomplete = () => klaar(vraag && vraag.result);
        t.onerror = t.onabort = () => mis(t.error);
      });
    };
    const lijst = async () => {
      try { return (await doe('readonly', (s) => s.getAll())).sort((a, b) => b.tijd - a.tijd); } catch (fout) { return []; }
    };
    return {
      lijst,
      async bewaar(item) {
        try {
          try { await doe('readwrite', (s) => s.put(item)); }
          catch (fout) { await doe('readwrite', (s) => s.put({ ...item, handvat: undefined })); }   // het bestand zelf kon niet onthouden worden
          const oud = (await lijst()).slice(30);   // hou de dertig laatste
          for (const o of oud) await doe('readwrite', (s) => s.delete(o.naam));
        } catch (fout) { /* geen opslag in deze browser: dan is er geen lijst */ }
      },
      async wis(naam) {
        try { await doe('readwrite', (s) => s.delete(naam)); } catch (fout) { /* niets te wissen */ }
      },
    };
  })();

  let recent = [];   // steeds bijgewerkt, zodat Openen meteen weet of er iets te tonen is
  const ververs = async () => { recent = await geheugen.lijst(); };

  /* Zet de kaart die nu open staat in de lijst (alleen als ze een bestandsnaam heeft). */
  async function onthoud() {
    if (!staat.naam) return;
    const kop = staat.kaart.kop;
    await geheugen.bewaar({ naam: staat.naam, titel: kop.titel, code: kop.code, tijd: Date.now(), inhoud: alsTekst(), handvat: staat.handvat || undefined });
    await ververs();
  }

  const openVenster = document.getElementById('open-venster');
  const openLijst = document.getElementById('open-lijst');

  /* Openen toont eerst de kaarten die je al opsloeg of opende; Bladeren zoekt elders op de computer. */
  function openen() {
    if (!recent.length) { bladeren(); return; }
    openLijst.replaceChildren(...recent.map((item) => {
      const kies = el('button', { type: 'button', class: 'open-kaart' },
        el('strong', { text: item.titel || '(zonder titel)' }),
        el('span', { text: [item.code, item.naam].filter(Boolean).join(' · ') }),
        el('small', { text: 'Laatst gebruikt op ' + new Date(item.tijd).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' }) }));
      kies.addEventListener('click', () => openRecent(item));
      return el('li', { 'data-naam': item.naam }, kies,
        knop(teken('kruis'), 'Uit deze lijst halen (het bestand zelf blijft bestaan)', async () => {
          await geheugen.wis(item.naam);
          await ververs();
          if (recent.length) openen(); else openVenster.close();
        }, { weg: true }));
    }));
    if (!openVenster.open) openVenster.showModal();
  }

  async function openRecent(item) {
    openVenster.close();
    if (item.handvat) {
      try {
        const mag = async (wat) => (await item.handvat[wat]({ mode: 'read' })) === 'granted';
        if (!(await mag('queryPermission')) && !(await mag('requestPermission'))) throw new Error('geen toegang');
        const bestand = await item.handvat.getFile();
        laad(await bestand.text(), bestand.name, item.handvat);
        return;
      } catch (fout) {
        if (laad(item.inhoud, item.naam, null)) meld('Het bestand zelf is niet bereikbaar. Dit is de kaart zoals de editor ze onthouden had.', true);
        return;
      }
    }
    laad(item.inhoud, item.naam, null);
  }

  async function bladeren() {
    if (openVenster.open) openVenster.close();
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const [handvat] = await window.showOpenFilePicker({ types: BESTANDSTYPES, id: 'instructiekaart' });
        const bestand = await handvat.getFile();
        laad(await bestand.text(), bestand.name, handvat);
        return;
      } catch (fout) {
        if (fout && fout.name === 'AbortError') return;   // de gebruiker sloot het venster
      }
    }
    bestandKiezer.value = '';
    bestandKiezer.click();
  }

  document.getElementById('open-bladeren').addEventListener('click', bladeren);
  document.getElementById('open-annuleer').addEventListener('click', () => openVenster.close());

  bestandKiezer.addEventListener('change', async () => {
    const bestand = bestandKiezer.files[0];
    if (bestand) laad(await bestand.text(), bestand.name, null);
  });

  /* ---------- een bestaande Word-kaart importeren ---------- */

  function importeren() {
    docxKiezer.value = '';
    docxKiezer.click();
  }

  docxKiezer.addEventListener('change', () => { if (docxKiezer.files[0]) importeerWord(docxKiezer.files[0]); });

  async function importeerWord(bestand) {
    if (!/\.docx$/i.test(bestand.name)) {
      meld(/\.doc$/i.test(bestand.name)
        ? 'Dit is een oud Word-bestand (.doc). Open het in Word, sla het op als .docx en importeer dat.'
        : '“' + bestand.name + '” is geen Word-bestand (.docx).', true);
      return;
    }
    meld('Bezig met importeren van ' + bestand.name + ' …');
    let resultaat;
    try {
      resultaat = await K.importeerDocx(await bestand.arrayBuffer(), (blob) => leesBeeld(blob));
      resultaat.kaart = normaliseer(resultaat.kaart);
    } catch (fout) {
      meld('“' + bestand.name + '” kan niet ingelezen worden als Word-kaart.', true);
      return;
    }
    if (!magWeg()) return;
    zetKaart(resultaat.kaart, '', null, 'Geïmporteerd uit ' + bestand.name);
    staat.gewijzigd = true;   // nog nergens opgeslagen
    werkbalk();
    meldingEl.hidden = true;
    const v = resultaat.verslag;
    document.getElementById('verslag-titel').textContent = 'Geïmporteerd uit ' + bestand.name;
    document.getElementById('verslag-samenvatting').textContent =
      v.velden + ' velden in de kop, ' + v.vensters + (v.vensters === 1 ? ' venster en ' : ' vensters en ') +
      v.beelden + (v.beelden === 1 ? ' afbeelding' : ' afbeeldingen') + ' overgenomen.';
    document.getElementById('verslag-lijst').replaceChildren(...v.letOp.map((regel) => el('li', { text: regel })));
    document.getElementById('verslag-venster').showModal();
  }

  const alsTekst = () => JSON.stringify(staat.kaart, null, 2) + '\n';

  /* Chrome en Edge kunnen rechtstreeks in een bestand schrijven: je kiest zelf map en naam, en
     Opslaan schrijft daarna telkens in datzelfde bestand. Andere browsers (Firefox, Safari) kunnen
     alleen downloaden: daar vraagt de editor zelf de naam, en de browser bepaalt de map. */
  const kanSchrijven = () => typeof window.showSaveFilePicker === 'function';

  /* Maakt van wat iemand typt een geldige bestandsnaam, zonder ".json". */
  const nettoNaam = (naam) => String(naam || '').trim().replace(/\.json$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '');

  function voorgesteldeNaam() {
    return (nettoNaam(staat.kaart.kop.code) || nettoNaam(staat.naam) || 'instructiekaart') + '.json';
  }

  const naamVenster = document.getElementById('opslaan-venster');
  const naamVeld = document.getElementById('opslaan-naam');

  /* Vraagt de bestandsnaam in een eigen venstertje. Geeft de naam terug, of null bij annuleren. */
  function vraagNaam(voorstel) {
    return new Promise((klaar) => {
      naamVeld.value = nettoNaam(voorstel);
      naamVenster.returnValue = '';
      naamVenster.addEventListener('close', () => {
        const naam = nettoNaam(naamVeld.value);
        klaar(naamVenster.returnValue === 'ok' && naam ? naam + '.json' : null);
      }, { once: true });
      naamVenster.showModal();
      naamVeld.select();
    });
  }

  document.getElementById('opslaan-formulier').addEventListener('submit', (e) => {
    if (!nettoNaam(naamVeld.value)) { e.preventDefault(); naamVeld.focus(); }   // zonder naam gaat het niet door
  });
  document.getElementById('opslaan-annuleer').addEventListener('click', () => naamVenster.close(''));

  function download(inhoud, naam) {
    const adres = URL.createObjectURL(new Blob([inhoud], { type: 'application/json' }));
    const a = el('a', { href: adres, download: naam });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(adres), 10000);
  }

  function opgeslagen(naam, handvat, boodschap) {
    staat.naam = naam;
    staat.handvat = handvat;
    staat.gewijzigd = false;
    werkbalk();
    meld(boodschap);
    onthoud();
  }

  async function opslaan(onderAndereNaam) {
    const inhoud = alsTekst();
    if (kanSchrijven()) {
      try {
        let handvat = onderAndereNaam ? null : staat.handvat;
        if (!handvat) {
          const opties = { suggestedName: voorgesteldeNaam(), types: BESTANDSTYPES, id: 'instructiekaart' };
          if (staat.handvat) opties.startIn = staat.handvat;   // begin in de map van de kaart die open staat
          handvat = await window.showSaveFilePicker(opties);
        }
        const schrijver = await handvat.createWritable();
        await schrijver.write(inhoud);
        await schrijver.close();
        opgeslagen(handvat.name, handvat, 'Opgeslagen als ' + handvat.name);
        return;
      } catch (fout) {
        if (fout && fout.name === 'AbortError') return;   // venster gesloten zonder te kiezen
        meld('Rechtstreeks opslaan lukte niet; het bestand wordt nu gedownload.', true);
      }
    }
    /* Downloaden: bij Opslaan onder de naam die de kaart al heeft, anders eerst de naam vragen. */
    const naam = !onderAndereNaam && staat.naam ? staat.naam : await vraagNaam(voorgesteldeNaam());
    if (!naam) return;
    download(inhoud, naam);
    opgeslagen(naam, null, 'Gedownload als ' + naam + '. Je vindt het bestand bij je downloads.');
  }

  function afdrukken() {
    tekenVoorbeeld();
    window.print();
  }

  /* ---------- als app installeren ---------- */

  /* Alleen de webversie (bouw.py --web) heeft een manifest. Daar biedt Edge of Chrome aan om de
     editor als app te installeren; de knop verschijnt pas wanneer de browser dat aanbod doet. */
  let aanbod = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    aanbod = e;
    actieKnop('installeren').hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    aanbod = null;
    actieKnop('installeren').hidden = true;
    meld('De editor staat nu als app op deze computer');
  });
  function installeren() {
    if (!aanbod) return;
    const vraag = aanbod;
    aanbod = null;   // een aanbod kan maar één keer getoond worden; weigert de gebruiker, dan komt er later een nieuw
    actieKnop('installeren').hidden = true;
    vraag.prompt();
  }
  /* De dienst op de achtergrond bewaart de editor, zodat hij ook zonder internet opent. */
  if (document.querySelector('link[rel="manifest"]') && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* ---------- presentatie: vensters naar een andere dia slepen ---------- */

  const SLEEPTYPE = 'application/x-instructiekaart-venster';
  let sleepVenster = null;

  function wisDoel() {
    for (const e of bladen.querySelectorAll('.doel, .voeg-voor, .voeg-na')) e.classList.remove('doel', 'voeg-voor', 'voeg-na');
  }

  function eindeSleep() {
    sleepVenster = null;
    wisDoel();
    bladen.classList.remove('sleept');
    for (const e of bladen.querySelectorAll('.gesleept')) e.classList.remove('gesleept');
  }

  /* Waar het venster terechtkomt als je het hier loslaat. */
  function sleepDoel(e) {
    const strook = e.target.closest('.dia-tussen');
    if (strook) return { strook, plek: Number(strook.dataset.plek) };
    const dia = e.target.closest('.dia[data-groep]');
    if (!dia) return null;
    const doel = { dia, groep: Number(dia.dataset.groep) };
    const venster = e.target.closest('.venster[data-id]');
    if (venster && venster.dataset.id !== sleepVenster) {
      const r = venster.getBoundingClientRect();
      doel.venster = venster;
      doel.na = e.clientX > r.left + r.width / 2;
    }
    return doel;
  }

  bladen.addEventListener('dragstart', (e) => {
    const venster = weergave === 'presentatie' && e.target.closest && e.target.closest('.dia .venster[data-id]');
    if (!venster) return;
    sleepVenster = venster.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(SLEEPTYPE, sleepVenster);
    bladen.classList.add('sleept');
    for (const v of bladen.querySelectorAll('.venster[data-id="' + sleepVenster + '"]')) v.classList.add('gesleept');
  });
  bladen.addEventListener('dragover', (e) => {
    if (!sleepVenster) return;
    const doel = sleepDoel(e);
    wisDoel();
    if (!doel) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (doel.strook) doel.strook.classList.add('doel');
    else if (doel.venster) doel.venster.classList.add(doel.na ? 'voeg-na' : 'voeg-voor');
    else doel.dia.classList.add('doel');
  });
  bladen.addEventListener('drop', (e) => {
    if (!sleepVenster) return;
    e.preventDefault();
    const id = sleepVenster;
    const doel = sleepDoel(e);
    eindeSleep();
    if (doel) zetOpDia(id, doel);
  });
  bladen.addEventListener('dragend', eindeSleep);
  automatischKnop.addEventListener('click', automatischIndelen);

  /* ---------- gebeurtenissen ---------- */

  const ACTIES = {
    nieuw, openen, importeren, ongedaan, opnieuw, afdrukken, installeren,
    opslaan: () => opslaan(false),
    'opslaan-als': () => opslaan(true),
  };

  document.querySelector('.werkbalk').addEventListener('click', (e) => {
    const b = e.target.closest('[data-actie]');
    if (b) ACTIES[b.dataset.actie]();
  });

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const toets = e.key.toLowerCase();
    const inTekst = !!e.target.closest && !!e.target.closest('input, textarea, select');
    if (toets === 's') { e.preventDefault(); opslaan(e.shiftKey); }
    else if (toets === 'o') { e.preventDefault(); openen(); }
    else if (toets === 'z' && !inTekst) { e.preventDefault(); if (e.shiftKey) opnieuw(); else ongedaan(); }
    else if (toets === 'y' && !inTekst) { e.preventDefault(); opnieuw(); }
  });

  /* Klik op een onderdeel van het blad om het in het formulier te openen. */
  kader.addEventListener('click', (e) => {
    const venster = e.target.closest('.venster[data-id]');
    const id = venster ? venster.dataset.id : (e.target.closest('.kop, .titeldia, .dia-kop') ? 'kop' : '');
    if (!id) return;
    staat.open = new Set([id]);
    tekenFormulier();
    const b = formulier.querySelector('[data-blok="' + id + '"]');
    if (!b) return;
    b.scrollIntoView({ block: 'start', behavior: 'smooth' });
    b.classList.add('flits');
  });

  /* Een kaartbestand op het venster slepen opent het. */
  window.addEventListener('dragover', (e) => { if (heeftBestanden(e)) e.preventDefault(); });
  window.addEventListener('drop', async (e) => {
    if (!heeftBestanden(e)) return;
    e.preventDefault();
    const bestand = e.dataTransfer.files[0];
    if (bestand && /\.docx?$/i.test(bestand.name)) { importeerWord(bestand); return; }
    if (!bestand || !/\.json$/i.test(bestand.name)) {
      meld('Sleep een foto op een regel in het formulier, een kaartbestand (.json) om het te openen, of een Word-kaart (.docx) om ze te importeren.', true);
      return;
    }
    let handvat = null;
    const item = e.dataTransfer.items && e.dataTransfer.items[0];
    if (item && typeof item.getAsFileSystemHandle === 'function') {
      try { handvat = await item.getAsFileSystemHandle(); } catch (fout) { handvat = null; }
    }
    laad(await bestand.text(), bestand.name, handvat && handvat.kind === 'file' ? handvat : null);
  });

  window.addEventListener('beforeunload', (e) => {
    if (staat.gewijzigd) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('beforeprint', () => { if (voorbeeldGepland) tekenVoorbeeld(); });
  window.addEventListener('load', controleerPasvorm);
  kader.addEventListener('load', controleerPasvorm, true);   // beelden die pas later hun grootte kennen
  new ResizeObserver(schaal).observe(voorbeeld);
  document.querySelector('.weergave').addEventListener('click', (e) => {
    const b = e.target.closest('[data-weergave]');
    if (b && b.dataset.weergave !== weergave) zetWeergave(b.dataset.weergave);
  });
  document.querySelector('.zoom').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (b) zetZoom(b.dataset.zoom);
  });

  /* ---------- start ---------- */

  /* Gewoon geopend begint de editor met een lege kaart. Alleen wanneer bouw.py een pdf maakt,
     zit de kaart in de pagina zelf. */
  const ingebouwd = JSON.parse(document.getElementById('kaart').textContent);
  if (ingebouwd) {
    zetKaart(normaliseer(ingebouwd), '', null, 'Ingebouwde kaart');
  } else {
    zetKaart(nieuweKaart());
    staat.open.add('kop');
    tekenFormulier();
  }
  ververs();
  if (!kanSchrijven()) {
    actieKnop('opslaan').title = 'Opslaan: in deze browser wordt het bestand gedownload (Ctrl+S)';
    actieKnop('opslaan-als').title = 'Opslaan onder een andere naam: in deze browser wordt het bestand gedownload';
  }
  zetZoom(zoom);
  if (location.hash === '#presentatie') zetWeergave('presentatie');

  K.editor = { staat, laad, alsTekst, nieuweKaart, importeerWord, geheugen, zetWeergave };
})();
