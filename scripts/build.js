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

const packsDir = path.join(__dirname, '../mnm-3e-expanded/packs');

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

/**
 * Modern LevelDB Folder Document
 */
function getFolderDoc(name, folderId) {
  return {
    "name": name,
    "type": "Item",
    "_id": folderId,
    "folder": null,
    "sort": 0,
    "sorting": "a",
    "color": null,
    "flags": {}
  };
}

/**
 * Saves a pack in LevelDB source format (directory of JSONs)
 */
async function savePack(packName, documents) {
  const packPath = path.join(packsDir, packName);
  const sourcePath = path.join(packPath, '_source');
  
  // Clean old files
  if (fs.existsSync(path.join(packsDir, `${packName}.db`))) {
    await fs.remove(path.join(packsDir, `${packName}.db`));
  }
  await fs.remove(packPath);
  await fs.ensureDir(sourcePath);

  for (const doc of documents) {
    const fileName = `${doc.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${doc._id}.json`;
    await fs.writeJson(path.join(sourcePath, fileName), doc, { spaces: 2 });
  }
}

/**
 * Saves a pack in legacy NeDB format (single .db file)
 */
async function saveLegacyPack(packName, documents) {
  const outFile = path.join(packsDir, `${packName}.db`);
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
    
    return {
      "_id": createId(),
      "name": name,
      "type": "pouvoir",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg",
      "system": {
        "action": translationMap.action[action] || 'simple',
        "portee": translationMap.range[range] || 'contact',
        "duree": translationMap.duration[duration] || 'instantane',
        "notes": `<p>${sanitizeText(row.Description)}</p>`,
        "effets": sanitizeText(row.Mechanics) ? `<p>${sanitizeText(row.Mechanics).toUpperCase()}</p>` : "",
        "cout": { "rang": baseRank, "parrang": baseCostPerRank, "total": baseRank * baseCostPerRank }
      },
      "effects": [],
      "flags": {}
    };
  }).filter(Boolean);
  await saveLegacyPack('powers', items);
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
  await saveLegacyPack('advantages', items);
}

async function buildEquipment() {
  const categories = ['melee', 'ranged', 'armor', 'utility'];
  const folderMap = {};
  const allDocs = [];

  for (const cat of categories) {
    const rows = await readCsv(path.join(__dirname, `../src/equipment/${cat}/${cat}.csv`));
    for (const row of rows) {
      const name = (row.Name || "").trim();
      if (!name) continue;
      const type = (row.Type || "General").trim();
      if (!folderMap[type]) {
        const fId = createId();
        folderMap[type] = fId;
        allDocs.push(getFolderDoc(type, fId));
      }
      allDocs.push({
        "_id": createId(),
        "name": name,
        "type": "equipement",
        "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
        "folder": folderMap[type],
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
  const folderMap = {};
  const allDocs = [];
  for (const row of rows) {
    const name = (row.Name || "").trim();
    if (!name) continue;
    const cat = (row.Category || "Other").trim();
    if (!folderMap[cat]) {
      const fId = createId();
      folderMap[cat] = fId;
      allDocs.push(getFolderDoc(cat, fId));
    }
    allDocs.push({
      "_id": createId(),
      "name": name,
      "type": "equipement",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
      "folder": folderMap[cat],
      "system": { "description": `<p>${row.Notes || ''}</p>`, "cout": parseInt(row.Cost) || 1 },
      "effects": [],
      "flags": {}
    });
  }
  await savePack('vehicles', allDocs);
}

async function buildHeadquarters() {
  const rows = await readCsv(path.join(__dirname, '../src/headquarters/headquarters.csv'));
  const hqFolderId = createId();
  const allDocs = [getFolderDoc("Bases & Strongholds", hqFolderId)];
  for (const row of rows) {
    const name = (row.Name || "").trim();
    if (!name) continue;
    allDocs.push({
      "_id": createId(),
      "name": name,
      "type": "equipement",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
      "folder": hqFolderId,
      "system": { "description": `<p>${row.Notes || ''}</p>`, "cout": parseInt(row.Cost) || 1 },
      "effects": [],
      "flags": {}
    });
  }
  await savePack('headquarters', allDocs);
}

async function main() {
  await fs.ensureDir(packsDir);
  await buildPowers();
  await buildAdvantages();
  await buildEquipment();
  await buildVehicles();
  await buildHeadquarters();
  console.log("Build Complete: Equipment, Vehicles, and HQ migrated to LevelDB folders.");
}

main().catch(err => console.error(err));
