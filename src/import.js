/* Leest een bestaande Word-kaart (.docx) in en maakt er een kaart van voor de editor.
   Een .docx is een zip met xml en beelden. Alles gebeurt in de browser; er wordt niets verstuurd.
   De import herkent de vaste opbouw van de Westlandia-kaarten: een tabel met bovenaan de kop
   (titel, code, versie, auteur ...), daaronder telkens een rij met een titel en een rij met inhoud. */
window.Instructiekaart.importeerDocx = (function () {
  'use strict';

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  /* ---------- zip uitpakken ---------- */

  function openZip(buffer) {
    const bytes = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    let eind = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eind = i; break; }
    }
    if (eind < 0) throw new Error('geen zip');
    const aantal = dv.getUint16(eind + 10, true);
    const namen = new TextDecoder();
    const bestanden = new Map();
    let p = dv.getUint32(eind + 16, true);
    for (let n = 0; n < aantal && dv.getUint32(p, true) === 0x02014b50; n++) {
      const naamLengte = dv.getUint16(p + 28, true);
      bestanden.set(namen.decode(bytes.subarray(p + 46, p + 46 + naamLengte)), {
        methode: dv.getUint16(p + 10, true),
        lengte: dv.getUint32(p + 20, true),
        plaats: dv.getUint32(p + 42, true),
      });
      p += 46 + naamLengte + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    return {
      namen: [...bestanden.keys()],
      async lees(naam) {
        const b = bestanden.get(naam);
        if (!b) return null;
        const start = b.plaats + 30 + dv.getUint16(b.plaats + 26, true) + dv.getUint16(b.plaats + 28, true);
        const ruw = bytes.subarray(start, start + b.lengte);
        if (b.methode === 0) return ruw;
        if (b.methode !== 8) throw new Error('onbekende compressie');
        const stroom = new Blob([ruw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stroom).arrayBuffer());
      },
    };
  }

  /* ---------- xml lezen ---------- */

  const xml = (bytes) => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  const kinderen = (node, naam) => [...node.children].filter((k) => k.localName === naam);
  const eerste = (node, naam) => kinderen(node, naam)[0] || null;
  const waarde = (node) => (node ? node.getAttributeNS(W, 'val') : null);

  /* De beelden in een stuk tekst: waar ze in de zip zitten en hoe hoog ze in Word staan. */
  function beeldenIn(node, rels) {
    const uit = [];
    const omvang = node.getElementsByTagNameNS('*', 'extent')[0];
    const hoogte = omvang ? Number(omvang.getAttribute('cy')) / 360000 : 0;   // in cm
    for (const blip of node.getElementsByTagNameNS('*', 'blip')) {
      const pad = rels[blip.getAttributeNS(R, 'embed')];
      if (pad) uit.push({ pad, hoogte });
    }
    for (const oud of node.getElementsByTagNameNS('*', 'imagedata')) {
      const pad = rels[oud.getAttributeNS(R, 'id')];
      if (pad) uit.push({ pad, hoogte: 0 });
    }
    return uit;
  }

  /* Eén alinea: de tekst, de beelden, of ze in een opsomming staat, en hoe ze opgemaakt is. */
  function leesAlinea(p, rels) {
    let tekst = '';
    let vetteTekens = 0;
    let grootte = 0;
    const beelden = [];
    const loop = (node, vet, punten) => {
      for (const k of node.children) {
        const n = k.localName;
        if (n === 'r') {
          const opmaak = eerste(k, 'rPr');
          const b = opmaak && eerste(opmaak, 'b');
          const sz = opmaak && eerste(opmaak, 'sz');
          loop(k, !!b && waarde(b) !== '0' && waarde(b) !== 'false', sz ? Number(waarde(sz)) : 0);
        } else if (n === 't') {
          tekst += k.textContent;
          if (k.textContent.trim()) { if (vet) vetteTekens += k.textContent.length; grootte = Math.max(grootte, punten); }
        } else if (n === 'tab') tekst += '\t';
        else if (n === 'br' || n === 'cr') tekst += '\n';
        else if (n === 'noBreakHyphen') tekst += '-';
        else if (n === 'drawing' || n === 'pict' || n === 'object') beelden.push(...beeldenIn(k, rels));
        else if (n === 'AlternateContent') {
          const keuze = eerste(k, 'Choice') || eerste(k, 'Fallback');   // anders komt hetzelfde beeld twee keer mee
          if (keuze) loop(keuze, vet, punten);
        } else if (n !== 'pPr' && n !== 'rPr' && n !== 'instrText' && n !== 'del') loop(k, vet, punten);
      }
    };
    loop(p, false, 0);
    const eigenschappen = eerste(p, 'pPr');
    const nummering = eigenschappen && eerste(eigenschappen, 'numPr');
    const lijst = !!nummering && waarde(eerste(nummering, 'numId')) !== '0';
    const schoneTekst = tekst.replace(/[ \t ]+/g, ' ').trim();
    return {
      tekst: schoneTekst,
      ruw: tekst,                       // met de oorspronkelijke witruimte, voor titels die naast elkaar staan
      beelden,
      lijst,
      niveau: lijst ? Number(waarde(eerste(nummering, 'ilvl'))) || 0 : 0,
      vet: schoneTekst.length > 0 && vetteTekens >= schoneTekst.replace(/ /g, '').length * 0.6,
      grootte,                          // in halve punten, zoals Word ze bewaart
      stijl: waarde(eigenschappen && eerste(eigenschappen, 'pStyle')) || '',
    };
  }

  /* Het document als rijen: elke tabelrij is een rij cellen, elke losse alinea een rij met één cel. */
  function rijenVan(houder, rels, uit) {
    for (const k of houder.children) {
      if (k.localName === 'tbl') {
        for (const tr of kinderen(k, 'tr')) {
          const cellen = [];
          const verzamel = (node) => {
            for (const c of node.children) {
              if (c.localName === 'tc') cellen.push([...c.getElementsByTagNameNS(W, 'p')].map((p) => leesAlinea(p, rels)));
              else if (c.localName === 'sdt' && eerste(c, 'sdtContent')) verzamel(eerste(c, 'sdtContent'));
            }
          };
          verzamel(tr);
          uit.push(cellen);
        }
      } else if (k.localName === 'p') uit.push([[leesAlinea(k, rels)]]);
      else if (k.localName === 'sdt' && eerste(k, 'sdtContent')) rijenVan(eerste(k, 'sdtContent'), rels, uit);
    }
    return uit;
  }

  /* ---------- tekst opschonen ---------- */

  const EIGENNAMEN = { ehbo: 'EHBO', pbm: 'PBM', aed: 'AED', mcbride: 'McBride', westlandia: 'Westlandia' };

  /* TEKST IN HOOFDLETTERS wordt gewone tekst met een hoofdletter vooraan. */
  function zinVorm(t) {
    if (t.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 4 || t !== t.toUpperCase()) return t;
    return t.toLowerCase()
      .replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (alles, voor, letter) => voor + letter.toUpperCase())
      .replace(/[a-zà-ÿ]+/gi, (woord) => EIGENNAMEN[woord.toLowerCase()] || woord);
  }
  const hoofdletter = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const zonderDubbelpunt = (t) => t.replace(/\s*:\s*$/, '');

  /* 20/11/2026 -> 2026-11-20; geeft '' als het geen geldige datum is. */
  function datum(t) {
    const m = /^(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{2}|\d{4})$/.exec(t.trim());
    if (!m) return '';
    const jaar = Number(m[3].length === 2 ? '20' + m[3] : m[3]);
    const maand = Number(m[2]);
    const dag = Number(m[1]);
    if (jaar < 1990 || jaar > 2100 || maand < 1 || maand > 12 || dag < 1 || dag > 31) return '';
    return jaar + '-' + String(maand).padStart(2, '0') + '-' + String(dag).padStart(2, '0');
  }

  /* ---------- de kop ---------- */

  const KOPVELDEN = [
    ['auteur', /^auteur\b/i, 'Auteur'],
    ['eigenaar', /^eigenaar\b/i, 'Eigenaar'],
    ['goedgekeurdDoor', /^goedgekeurd\s+door\b/i, 'Goedgekeurd door'],
    ['geldigVanaf', /^geldig\s+vanaf\b/i, 'Geldig vanaf'],
    ['geldigVoor', /^geldig\s+voor\b/i, 'Geldig voor'],
    ['toepassingsgebied', /^toepassingsgebied\b/i, 'Toepassingsgebied'],
    ['doelstelling', /^doelstelling(en)?\b/i, 'Doelstelling'],
    ['versie', /^versie\b/i, 'Versie'],
    ['datum', /^datum\b/i, 'Datum'],
  ];
  const isCode = (t) => /^[A-Za-z0-9]{2,}([_-][A-Za-z0-9]+)+$/.test(t) && /\d/.test(t);
  const isDatum = (t) => /^\d{1,2}\s*[\/.-]\s*\d{1,2}\s*[\/.-]\s*\d{2,4}$/.test(t);

  const hoortBijKop = (cel) => cel.some((a) => KOPVELDEN.some(([, patroon]) => patroon.test(a.tekst)) || isCode(a.tekst));

  function leesKop(rijen, verslag) {
    const kop = { soort: 'Veiligheidsinstructiekaart' };
    const ruw = {};
    const titels = [];
    for (const cel of rijen.flat()) {
      let veld = null;
      for (const a of cel) {
        if (!a.tekst) continue;
        const gevonden = KOPVELDEN.find(([, patroon]) => patroon.test(a.tekst));
        if (gevonden) {
          veld = gevonden[0];
          ruw[veld] = (a.tekst.replace(gevonden[1], '').replace(/^\s*:\s*/, '')).trim();
        } else if (veld) ruw[veld] = (ruw[veld] + ' ' + a.tekst).trim();
        else if (isCode(a.tekst)) kop.code = kop.code || a.tekst;
        else if (isDatum(a.tekst)) ruw.datum = ruw.datum || a.tekst;
        else titels.push(a.tekst);
      }
    }
    kop.titel = zinVorm(titels.sort((a, b) => b.length - a.length)[0] || '');
    for (const [veld, , naam] of KOPVELDEN) {
      const w = ruw[veld];
      if (!w) continue;
      if (veld === 'datum' || veld === 'geldigVanaf') {
        kop[veld] = datum(w);
        if (!kop[veld]) verslag.letOp.push(naam + ': “' + w + '” is geen geldige datum. Vul ze zelf in.');
      } else kop[veld] = veld === 'doelstelling' ? hoofdletter(w) : w;
    }
    verslag.velden = Object.keys(kop).filter((k) => k !== 'soort' && kop[k]).length;
    return kop;
  }

  /* ---------- de vensters ---------- */

  /* Een rij die alleen titels bevat: kort, vet of groot, zonder opsomming of beeld. */
  function isTitel(cel) {
    if (cel.length !== 1) return false;
    const a = cel[0];
    return !a.beelden.length && !a.lijst && a.tekst.length <= 90 &&
      (a.vet || a.grootte >= 28 || /^(kop|heading|titel|title)/i.test(a.stijl));
  }

  /* Rijen -> secties: een titel met de inhoud die erbij hoort. Twee titels naast elkaar met twee cellen
     eronder worden een linker- en een rechtervenster. */
  function maakSecties(rijen) {
    const secties = [];
    let titels = [];
    const zonderInhoud = () => { for (const t of titels) secties.push({ titel: t, alineas: [], breedte: 'vol' }); };
    for (const rij of rijen) {
      const cellen = rij.map((cel) => cel.filter((a) => a.tekst || a.beelden.length)).filter((cel) => cel.length);
      if (!cellen.length) continue;
      if (cellen.every(isTitel)) {
        zonderInhoud();
        titels = cellen.flatMap((cel) => cel[0].ruw.split(/\s{3,}|\t+/).map((t) => t.trim()).filter(Boolean));
        continue;
      }
      if (!titels.length) {
        const vorige = secties[secties.length - 1];
        if (vorige && vorige.breedte === 'vol') vorige.alineas.push(...cellen.flat());
        else secties.push({ titel: '', alineas: cellen.flat(), breedte: 'vol' });
        continue;
      }
      const n = Math.min(titels.length, cellen.length);
      for (let i = 0; i < n; i++) {
        const laatste = i === n - 1;
        secties.push({
          titel: laatste ? titels.slice(i).join(' / ') : titels[i],
          alineas: laatste ? cellen.slice(i).flat() : cellen[i],
          breedte: n === 2 ? (i ? 'rechts' : 'links') : 'vol',
        });
      }
      titels = [];
    }
    zonderInhoud();
    return secties;
  }

  function kleurVoor(titel) {
    if (/bescherm|pbm|draagplicht/i.test(titel)) return 'gebod';
    if (/verbod|verboden|niet toegelaten/i.test(titel)) return 'verbod';
    if (/aandacht|gevaar|risico|opgelet|let op|opletten/i.test(titel)) return 'gevaar';
    if (/ehbo|eerste hulp|nood|brand|evacuatie/i.test(titel)) return 'ehbo';
    return 'info';
  }

  /* Woorden waaraan een beschermingsmiddel herkend wordt; het meest specifieke eerst. */
  const BESCHERMING = [
    [/gelaats(masker|scherm)|gezichtsscherm|gelaatsbescherming/i, 'M013'],
    [/las(masker|helm|kap|bril)/i, 'M019'],
    [/(stof|mond)masker|mondneusmasker/i, 'M016'],
    [/adem(halings)?bescherming|gasmasker|ademhalingsmasker/i, 'M017'],
    [/veiligheidsbril|oogbescherming|spatbril|\bbril\b/i, 'M004'],
    [/gehoorbescherming|oordop|oorkap|oorbescherm/i, 'M003'],
    [/handschoen/i, 'M009'],
    [/\b(veiligheids|werk)?(schoen|laars|laarzen)/i, 'M008'],
    [/schort|voorschoot/i, 'M026'],
    [/helm/i, 'M014'],
    [/fluo|signalisatie|hesje/i, 'M015'],
    [/harnas|valbeveiliging|valbescherming/i, 'M018'],
    [/werkkledij|werkkleding|kledij|kleding|overall|werkpak/i, 'M010'],
    [/masker/i, 'M016'],
  ];
  const pictoVoor = (tekst) => (BESCHERMING.find(([patroon]) => patroon.test(tekst)) || [])[1];

  async function maakVensters(sectie, beeld, verslag) {
    const titel = zinVorm(zonderDubbelpunt(sectie.titel));
    const basis = { titel, soort: kleurVoor(titel), breedte: sectie.breedte };
    const alineas = sectie.alineas;
    const heeftLijst = alineas.some((a) => a.lijst);

    /* Een korte regel met een dubbelpunt vóór de opsomming ("Draagplicht:") wordt het kopje van het venster. */
    let inleiding = '';
    const eersteTekst = alineas.find((a) => a.tekst);
    if (heeftLijst && eersteTekst && !eersteTekst.lijst && /:\s*$/.test(eersteTekst.tekst) && eersteTekst.tekst.length <= 40) {
      inleiding = zinVorm(zonderDubbelpunt(eersteTekst.tekst));
    }

    /* Beschermingsmiddelen worden pictogrammen, als de opsomming herkend wordt. */
    const regels = alineas.filter((a) => a.tekst && a !== (inleiding ? eersteTekst : null));
    if (basis.soort === 'gebod' && regels.some((a) => a.niveau === 0 && pictoVoor(a.tekst))) {
      const items = [];
      for (const a of regels) {
        const tekst = zinVorm(a.tekst).replace(/\s*!+$/, '');
        if (a.lijst && a.niveau > 0 && items.length) items[items.length - 1].noot = [items[items.length - 1].noot, tekst].filter(Boolean).join(' ');
        else items.push({ picto: pictoVoor(a.tekst) || 'M001', label: tekst, noot: '' });
      }
      const herkend = items.filter((i) => i.picto !== 'M001').length;
      verslag.letOp.push('“' + titel + '”: ' + herkend + ' van de ' + items.length + ' regels kregen een pictogram' +
        (herkend < items.length ? '; de andere staan er met het algemene gebodsteken, kies daar zelf een pictogram.' : '.'));
      const vensters = [{ ...basis, type: 'pictogrammen', inleiding, items }];
      const beelden = (await Promise.all(alineas.flatMap((a) => a.beelden).map(beeld))).filter(Boolean);
      if (beelden.length) {
        vensters.push({ ...basis, titel: titel + ': beelden uit Word', type: 'punten', items: [{ tekst: '', beelden: beelden.map((b) => ({ ...b, grootte: 'klein' })) }] });
        verslag.letOp.push('“' + titel + '”: de ' + beelden.length + ' afbeeldingen uit Word staan in een apart venster eronder. Verwijder het als de pictogrammen volstaan.');
      }
      return vensters;
    }

    /* Anders: punten. Een beeld hoort bij het punt erboven; gewone tekst tussen opsommingstekens wordt losse tekst. */
    const items = [];
    const laatstePunt = () => { for (let i = items.length - 1; i >= 0; i--) if (!items[i].los) return items[i]; return null; };
    for (const a of alineas) {
      if (inleiding && a === eersteTekst) {
        if (a.beelden.length) items.push({ tekst: '', beelden: (await Promise.all(a.beelden.map(beeld))).filter(Boolean) });
        continue;
      }
      const beelden = (await Promise.all(a.beelden.map(beeld))).filter(Boolean);
      let tekst = zinVorm(a.tekst);
      if (titel && tekst.toLowerCase().startsWith(titel.toLowerCase() + ':')) tekst = tekst.slice(titel.length + 1).trim();   // "EHBO: spoel ..." onder de titel EHBO
      tekst = hoofdletter(zonderDubbelpunt(tekst));
      if (!tekst) {
        const punt = laatstePunt();
        if (punt) punt.beelden.push(...beelden); else if (beelden.length) items.push({ tekst: '', beelden });
      } else if (a.lijst && a.niveau > 0 && laatstePunt()) {
        const punt = laatstePunt();
        punt.tekst += '\n' + tekst;
        punt.beelden.push(...beelden);
      } else if (heeftLijst && !a.lijst && !beelden.length) items.push({ los: true, tekst });
      else items.push({ tekst, beelden });
    }
    return [{ ...basis, type: 'punten', inleiding, items: items.filter((i) => i.los || i.tekst || i.beelden.length) }];
  }

  /* ---------- beelden omzetten ---------- */

  /* Word bewaart geplakte schermafbeeldingen vaak als emf. Zit daar gewoon een rasterbeeld in,
     dan halen we dat eruit; een emf met een tekening kan een browser niet tonen. */
  function rasterUitEmf(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 16 || dv.getUint32(0, true) !== 1) return null;
    let beste = null;
    for (let p = 0; p + 8 <= bytes.length;) {
      const soort = dv.getUint32(p, true);
      const lengte = dv.getUint32(p + 4, true);
      if (lengte < 8 || p + lengte > bytes.length) break;
      const basis = soort === 81 || soort === 80 ? 48 : soort === 76 || soort === 77 ? 84 : 0;
      if (basis && basis + 16 <= lengte) {
        const kopPlaats = dv.getUint32(p + basis, true);
        const kopLengte = dv.getUint32(p + basis + 4, true);
        const puntenPlaats = dv.getUint32(p + basis + 8, true);
        const puntenLengte = dv.getUint32(p + basis + 12, true);
        if (kopLengte >= 40 && puntenLengte && puntenPlaats + puntenLengte <= lengte && (!beste || puntenLengte > beste.punten.length)) {
          beste = { kop: bytes.subarray(p + kopPlaats, p + kopPlaats + kopLengte), punten: bytes.subarray(p + puntenPlaats, p + puntenPlaats + puntenLengte) };
        }
      }
      p += lengte;
    }
    if (!beste) return null;
    const kop = new DataView(beste.kop.buffer, beste.kop.byteOffset, beste.kop.byteLength);
    const b = kop.getInt32(4, true);
    const hRuw = kop.getInt32(8, true);
    const h = Math.abs(hRuw);
    const diepte = kop.getUint16(14, true);
    const compressie = kop.getUint32(16, true);
    const rijLengte = Math.floor((diepte * b + 31) / 32) * 4;
    if ((diepte !== 24 && diepte !== 32) || (compressie !== 0 && compressie !== 3) || b <= 0 || !h || b * h > 40e6 || beste.punten.length < rijLengte * h) return null;
    const doek = document.createElement('canvas');
    doek.width = b;
    doek.height = h;
    const ctx = doek.getContext('2d');
    const beeld = ctx.createImageData(b, h);
    const stap = diepte / 8;
    for (let y = 0; y < h; y++) {
      const rij = (hRuw > 0 ? h - 1 - y : y) * rijLengte;   // een positieve hoogte betekent: onderste rij eerst
      for (let x = 0; x < b; x++) {
        const i = rij + x * stap;
        const o = (y * b + x) * 4;
        beeld.data[o] = beste.punten[i + 2];
        beeld.data[o + 1] = beste.punten[i + 1];
        beeld.data[o + 2] = beste.punten[i];
        beeld.data[o + 3] = 255;
      }
    }
    ctx.putImageData(beeld, 0, 0);
    return new Promise((klaar) => doek.toBlob(klaar, 'image/png'));
  }

  const SOORTEN = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };

  /* ---------- het geheel ---------- */

  /* buffer: de inhoud van het .docx-bestand. maakBeeld(blob, naam) verkleint een beeld en geeft het
     terug als ingesloten beeld. Geeft { kaart, verslag } terug. */
  async function importeer(buffer, maakBeeld) {
    const zip = openZip(buffer);
    const inhoud = await zip.lees('word/document.xml');
    if (!inhoud) throw new Error('geen Word-document');
    const verslag = { velden: 0, vensters: 0, beelden: 0, letOp: [] };

    const rels = {};
    const relaties = await zip.lees('word/_rels/document.xml.rels');
    if (relaties) {
      for (const r of xml(relaties).getElementsByTagName('Relationship')) {
        const doel = r.getAttribute('Target') || '';
        rels[r.getAttribute('Id')] = doel.startsWith('/') ? doel.slice(1) : 'word/' + doel.replace(/^\.\//, '');
      }
    }

    const lichaam = xml(inhoud).getElementsByTagNameNS(W, 'body')[0];
    if (!lichaam) throw new Error('leeg Word-document');
    const rijen = rijenVan(lichaam, rels, []);

    /* De kop: alle rijen tot en met de laatste (van de eerste twaalf) waarin een kopveld of de code staat.
       Staat de kop in de koptekst van Word, dan lezen we die erbij. */
    let kopEinde = -1;
    rijen.slice(0, 12).forEach((rij, i) => { if (rij.some(hoortBijKop)) kopEinde = i; });
    const kopRijen = rijen.slice(0, kopEinde + 1);
    for (const naam of zip.namen.filter((n) => /^word\/header\d*\.xml$/.test(n))) {
      const deel = xml(await zip.lees(naam)).documentElement;
      kopRijen.push(...rijenVan(deel, {}, []));
    }
    const kop = leesKop(kopRijen, verslag);

    const gezien = new Map();
    const beeld = (b) => {
      if (!gezien.has(b.pad)) {
        gezien.set(b.pad, (async () => {
          const naam = b.pad.split('/').pop();
          const extensie = naam.split('.').pop().toLowerCase();
          const bytes = await zip.lees(b.pad);
          let blob = null;
          if (bytes && SOORTEN[extensie]) blob = new Blob([bytes], { type: SOORTEN[extensie] });
          else if (bytes && extensie === 'emf') blob = await rasterUitEmf(bytes);
          try {
            if (!blob) throw new Error('niet leesbaar');
            return await maakBeeld(blob, naam);
          } catch (fout) {
            verslag.letOp.push('Een afbeelding (' + naam + ') kon niet overgenomen worden. Voeg ze zelf toe als foto.');
            return null;
          }
        })());
      }
      return gezien.get(b.pad).then((src) => {
        if (!src) return null;
        verslag.beelden++;
        return { src, alt: '', grootte: b.hoogte && b.hoogte < 2.4 ? 'klein' : b.hoogte && b.hoogte > 3.3 ? 'groot' : 'middel', bijschrift: '' };
      });
    };

    const vensters = [];
    for (const sectie of maakSecties(rijen.slice(kopEinde + 1))) vensters.push(...await maakVensters(sectie, beeld, verslag));
    verslag.vensters = vensters.length;
    if (kopEinde < 0) verslag.letOp.push('De kop van de kaart werd niet herkend. Vul titel, code en de andere velden zelf in.');
    if (!vensters.length) verslag.letOp.push('Er werd geen inhoud gevonden onder de kop.');
    return { kaart: { schema: 1, kop, vensters }, verslag };
  }

  return importeer;
})();
