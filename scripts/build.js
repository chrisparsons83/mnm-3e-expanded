const fs = require('fs-extra');
const csv = require('csv-parser');
const path = require('path');

const EXTRAS = require('./extras.json');
const FLAWS = require('./flaws.json');

const translationMap = {
  type: { 'power': 'pouvoir', 'advantage': 'talent' },
  action: { 'standard': 'simple', 'move': 'mouvement', 'free': 'libre', 'reaction': 'reaction', 'none': 'aucune' },
  range: { 'personal': 'personnelle', 'close': 'contact', 'ranged': 'distance', 'perception': 'perception', 'rank': 'rang' },
  duration: { 'instant': 'instantane', 'sustained': 'prolonge', 'continuous': 'continu', 'concentration': 'concentration', 'permanent': 'permanent' }
};

const distDir = path.join(__dirname, '../mnm-3e-expanded/packs');

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) return resolve([]);
    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '') }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

function sanitizeText(text) {
  if (!text) return "";
  return text.replace(/\?\?\?s/g, "'s").replace(/\?\?\?t/g, "'t").replace(/\?\?\?re/g, "'re").replace(/\?\?\?ve/g, "'ve").replace(/\?\?\? /g, "— ").replace(/ \?\?\?/g, " —").replace(/\?\?\?/g, "—").replace(/â€“/g, "—").replace(/â€¢/g, "•").replace(/â€™/g, "'").replace(/â€œ/g, '"').replace(/â€\?/g, '"').replace(/Â/g, "").replace(/\s\s+/g, ' ').trim();
}

function createId() {
  return Math.random().toString(36).substring(2, 18);
}

async function savePack(packName, documents) {
  const outFile = path.join(distDir, `${packName}.db`);
  const lines = documents.map(d => JSON.stringify(d));
  await fs.writeFile(outFile, lines.join('\n'));
}

async function buildPowers() {
  const rows = await readCsv(path.join(__dirname, '../1st Powers Input.csv'));
  const items = rows.map(row => {
    const rawName = row.Name || row.name || row.NAME;
    if (!rawName) return null;
    const name = rawName.trim();
    const action = (row.Action || 'standard').trim().toLowerCase();
    const range = (row.Range || 'close').trim().toLowerCase();
    const duration = (row.Duration || 'instant').trim().toLowerCase();
    const baseRank = parseInt(row.Rank) || 1;
    const baseCostPerRank = parseInt(row.Cost) || 1;
    
    // Map CSV Type to system.type
    const rawType = (row.Power || row.power || row.TYPE || 'General').trim().toLowerCase();
    const mechanics = (row.Mechanics || '').toLowerCase();
    const description = (row.Description || '').toLowerCase();
    
    let systemType = 'generaux';
    if (rawType === 'attack' || mechanics.includes('attack check') || mechanics.includes('resistance check')) systemType = 'attaque';
    else if (rawType === 'movement') systemType = 'mouvement';
    else if (rawType === 'sensory') systemType = 'sensoriel';
    else if (rawType === 'defense') systemType = 'defensif';
    else if (rawType === 'control') systemType = 'generaux';

    const translatedAction = translationMap.action[action] || 'simple';

    return {
      "_id": createId(),
      "name": name,
      "type": "pouvoir",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg",
      "system": {
        "type": systemType,
        "activate": true,
        "special": translatedAction,
        "action": translatedAction,
        "portee": translationMap.range[range] || 'contact',
        "duree": translationMap.duration[duration] || 'instantane',
        "notes": `<p>${sanitizeText(row.Description)}</p>`,
        "description": `<p>${sanitizeText(row.Description)}</p>`,
        "effets": sanitizeText(row.Mechanics) ? `<p>${sanitizeText(row.Mechanics).toUpperCase()}</p>` : "",
        "effetsprincipaux": sanitizeText(row.Mechanics) ? `<p>${sanitizeText(row.Mechanics).toUpperCase()}</p>` : "",
        "link": "",
        "descripteurs": {},
        "extras": {},
        "defauts": {},
        "effectsVarianteSelected": "",
        "listEffectsVariantes": {},
        "edit": false,
        "carac": 0,
        "cout": { 
          "rang": baseRank, 
          "parrang": baseCostPerRank, 
          "total": baseRank * baseCostPerRank,
          "rangDyn": 0,
          "rangDynMax": 0,
          "divers": 0,
          "modrang": 0,
          "modfixe": 0,
          "totalTheorique": baseRank * baseCostPerRank,
          "parrangtotal": baseCostPerRank.toString()
        }
      },
      "effects": [],
      "folder": null,
      "sort": 0,
      "flags": {},
      "_stats": {
        "systemId": "mutants-and-masterminds-3e",
        "systemVersion": "1.39.13",
        "coreVersion": "12"
      }
    };
  }).filter(Boolean);
  await savePack('powers', items);
}

async function buildAdvantages() {
  const rows = await readCsv(path.join(__dirname, '../Advantages.csv'));
  const items = rows.map(row => {
    const name = (row.Name || "").trim();
    if (!name) return null;
    return {
      "_id": createId(),
      "name": name,
      "type": "talent",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/talent.svg",
      "system": { "description": `<p>${sanitizeText(row.Description)}</p>`, "rang": parseInt(row.Ranks) || 1 },
      "effects": [],
      "flags": {}
    };
  }).filter(Boolean);
  await savePack('advantages', items);
}

async function buildEquipment() {
  const categories = ['melee', 'ranged', 'armor', 'utility'];
  const allDocs = [];
  for (const cat of categories) {
    const rows = await readCsv(path.join(__dirname, `../src/equipment/${cat}/${cat}.csv`));
    for (const row of rows) {
      const name = (row.Name || "").trim();
      if (!name) continue;
      allDocs.push({
        "_id": createId(),
        "name": name,
        "type": "equipement",
        "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
        "system": { "description": `<p>${row.Notes || ''}</p>`, "cout": parseInt(row.Cost) || 1 },
        "effects": [],
        "flags": {}
      });
    }
  }
  await savePack('equipment', allDocs);
}

async function buildVehicles() {
  const rows = await readCsv(path.join(__dirname, '../src/vehicles/vehicles.csv'));
  const allDocs = [];
  for (const row of rows) {
    const name = (row.Name || "").trim();
    if (!name) continue;
    allDocs.push({
      "_id": createId(),
      "name": name,
      "type": "equipement",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
      "system": { "description": `<p>${row.Notes || ''}</p>`, "cout": parseInt(row.Cost) || 1 },
      "effects": [],
      "flags": {}
    });
  }
  await savePack('vehicles', allDocs);
}

async function buildHeadquarters() {
  const rows = await readCsv(path.join(__dirname, '../src/headquarters/headquarters.csv'));
  const allDocs = [];
  for (const row of rows) {
    const name = (row.Name || "").trim();
    if (!name) continue;
    allDocs.push({
      "_id": createId(),
      "name": name,
      "type": "equipement",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
      "system": { "description": `<p>${row.Notes || ''}</p>`, "cout": parseInt(row.Cost) || 1 },
      "effects": [],
      "flags": {}
    });
  }
  await savePack('headquarters', allDocs);
}

async function buildModifiers(items, fileName) {
  const outFile = path.join(distDir, fileName);
  await fs.writeFile(outFile, items.map(i => JSON.stringify(i)).join('\n'));
}

async function main() {
  await fs.ensureDir(distDir);
  await buildPowers();
  await buildAdvantages();
  await buildEquipment();
  await buildVehicles();
  await buildHeadquarters();
  await buildModifiers(EXTRAS, 'extras.db');
  await buildModifiers(FLAWS, 'flaws.db');
  console.log("Build Complete: Reorganized Extras and Flaws.");
}

main().catch(err => console.error(err));
