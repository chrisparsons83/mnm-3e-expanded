const fs = require('fs-extra');
const csv = require('csv-parser');
const path = require('path');

const EXTRAS = require('./extras');
const FLAWS = require('./flaws');

// M&M 3e French System Translation Mappings
const translationMap = {
  type: {
    'power': 'pouvoir',
    'advantage': 'talent'
  },
  action: {
    'standard': 'simple',
    'move': 'mouvement',
    'free': 'libre',
    'reaction': 'reaction',
    'none': 'aucune'
  },
  range: {
    'personal': 'personnelle',
    'close': 'contact',
    'ranged': 'distance',
    'perception': 'perception',
    'rank': 'rang'
  },
  duration: {
    'instant': 'instantane',
    'sustained': 'prolonge',
    'continuous': 'continu',
    'concentration': 'concentration',
    'permanent': 'permanent'
  }
};

const distDir = path.join(__dirname, '../mnm-3e-expanded/packs');

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) return resolve([]);
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '')
      }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

function sanitizeText(text) {
  if (!text) return "";
  return text
    .replace(/\?\?\?s/g, "'s")
    .replace(/\?\?\?t/g, "'t")
    .replace(/\?\?\?re/g, "'re")
    .replace(/\?\?\?ve/g, "'ve")
    .replace(/\?\?\? /g, "— ")
    .replace(/ \?\?\?/g, " —")
    .replace(/\?\?\?/g, "—")
    .replace(/â€“/g, "—")
    .replace(/â€¢/g, "•")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€\?/g, '"')
    .replace(/Â/g, "")
    .replace(/\s\s+/g, ' ')
    .trim();
}

async function buildPowers() {
  const csvFile = path.join(__dirname, '../1st Powers Input.csv');
  const outFile = path.join(distDir, 'powers.db');
  const rows = await readCsv(csvFile);
  const items = [];

  for (const row of rows) {
    const rawName = row.Name || row.name || row.NAME;
    if (!rawName || rawName.trim() === '') continue;
    const name = rawName.trim();

    const cleanDesc = sanitizeText(row.Description || row.description);
    const cleanMech = sanitizeText(row.Mechanics || row.mechanics);

    const action = (row.Action || row.action || row.ACTION || 'standard').trim().toLowerCase();
    const range = (row.Range || row.range || row.RANGE || 'close').trim().toLowerCase();
    const duration = (row.Duration || row.duration || row.DURATION || 'instant').trim().toLowerCase();

    const baseRank = parseInt(row.Rank || row.rank || row.RANK) || 1;
    const baseCostPerRank = parseInt(row.Cost || row.cost || row.COST) || 1;
    let modCostPerRank = 0;
    let flatCost = 0;

    const extrasText = (row.Extras || row.extras || row.EXTRAS || '');
    if (extrasText) {
      const extraNames = extrasText.split(',').map(e => e.trim());
      for (const extraName of extraNames) {
        const masterExtra = Object.keys(EXTRAS).find(k => k.toLowerCase() === extraName.toLowerCase());
        if (masterExtra) {
          const mod = EXTRAS[masterExtra];
          if (mod.data.cout.rang) modCostPerRank += mod.data.cout.value;
          if (mod.data.cout.fixe) flatCost += mod.data.cout.value;
        }
      }
    }

    const flawsText = (row.Flaws || row.flaws || row.FLAWS || '');
    if (flawsText) {
      const flawNames = flawsText.split(',').map(f => f.trim());
      for (const flawName of flawNames) {
        const masterFlaw = Object.keys(FLAWS).find(k => k.toLowerCase() === flawName.toLowerCase());
        if (masterFlaw) {
          const mod = FLAWS[masterFlaw];
          if (mod.data.cout.rang) modCostPerRank -= mod.data.cout.value;
          if (mod.data.cout.fixe) flatCost -= mod.data.cout.value;
        }
      }
    }

    const finalCostPerRank = Math.max(1, baseCostPerRank + modCostPerRank);
    const finalTotal = Math.max(1, (finalCostPerRank * baseRank) + flatCost);

    // HIGH FIDELITY FORMATTING
    const headerInfo = `<p>Action: ${action.charAt(0).toUpperCase() + action.slice(1)} &bull; Range: ${range.charAt(0).toUpperCase() + range.slice(1)}<br>Duration: ${duration.charAt(0).toUpperCase() + duration.slice(1)} &bull; Cost: ${finalCostPerRank} point${finalCostPerRank > 1 ? 's' : ''} per rank</p>`;
    
    const notesHtml = headerInfo + `<p>${cleanDesc}</p>`;
    const effectsHtml = cleanMech ? `<p>${cleanMech.toUpperCase()}</p>` : "";

    let systemType = 'generaux';
    const lowerName = name.toLowerCase();
    const attackPowers = ['blast', 'affliction', 'damage', 'dazzle', 'nullify', 'mind control', 'strike', 'trip', 'weaken'];
    if (attackPowers.some(p => lowerName.includes(p)) || (row.Power && row.Power.toLowerCase() === 'attack')) {
      systemType = 'attaque';
    }

    const powerItem = {
      "_id": Math.random().toString(36).substring(2, 18),
      "name": name,
      "type": "pouvoir",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg",
      "system": {
        "type": systemType,
        "activate": true,
        "special": "simple", // Force Standard Effect
        "action": translationMap.action[action] || 'simple',
        "portee": translationMap.range[range] || 'contact',
        "duree": translationMap.duration[duration] || 'instantane',
        "effetsprincipaux": "",
        "effets": effectsHtml,
        "notes": notesHtml,
        "cout": {
          "rang": baseRank,
          "parrang": baseCostPerRank,
          "total": finalTotal,
          "totalTheorique": finalTotal,
          "modrang": modCostPerRank,
          "modfixe": flatCost,
          "parrangtotal": "0"
        }
      },
      "effects": [],
      "flags": {}
    };
    items.push(JSON.stringify(powerItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
}

async function buildAdvantages() {
  const csvFile = path.join(__dirname, '../Advantages.csv');
  const outFile = path.join(distDir, 'advantages.db');
  const rows = await readCsv(csvFile);
  const items = [];

  for (const row of rows) {
    const name = (row.Name || row.name || "").trim();
    if (!name) continue;

    const cleanDesc = sanitizeText(row.Description || row.description);

    const effects = [];
    if (row.ModKey && row.ModValue) {
      effects.push({
        "_id": "eff" + Math.random().toString(36).substring(2, 10),
        "name": `${name} Bonus`,
        "changes": [{ "key": row.ModKey, "mode": 2, "value": row.ModValue.toString(), "priority": 20 }],
        "disabled": false,
        "transfer": true,
        "icon": 'systems/mutants-and-masterminds-3e/assets/icons/talent.svg'
      });
    }

    const advantageItem = {
      "_id": Math.random().toString(36).substring(2, 18),
      "name": name,
      "type": 'talent',
      "img": 'systems/mutants-and-masterminds-3e/assets/icons/talent.svg',
      "system": {
        "description": `<p>${cleanDesc}</p>`,
        "rang": parseInt(row.Ranks || row.ranks) || 1
      },
      "effects": effects,
      "flags": {}
    };
    items.push(JSON.stringify(advantageItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
}

async function buildEquipment() {
  const categories = ['melee', 'ranged', 'armor', 'utility'];
  const outFile = path.join(distDir, 'equipment.db');
  let allItems = [];

  for (const cat of categories) {
    const csvFile = path.join(__dirname, `../src/equipment/${cat}/${cat}.csv`);
    const rows = await readCsv(csvFile);

    for (const row of rows) {
      const name = (row.Name || row.name || "").trim();
      if (!name) continue;

      const effects = [];
      const modKey = row.ModKey || row.modkey;
      const modValue = row.ModValue || row.modvalue;

      if (modKey && modValue) {
        effects.push({
          "_id": "eff" + Math.random().toString(36).substring(2, 10),
          "name": `${name} Bonus`,
          "changes": [{ "key": modKey, "mode": 2, "value": modValue.toString(), "priority": 20 }],
          "disabled": false,
          "transfer": true,
          "icon": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg"
        });
      }

      let gearInfo = `<b>[ EQUIPMENT SPECS ]</b><br/>`;
      gearInfo += `&bull; <b>Type:</b> ${row.Type}<br/>`;
      gearInfo += `&bull; <b>EP Cost:</b> ${row.Cost}<br/>`;
      if (row.Damage) gearInfo += `&bull; <b>Damage:</b> ${row.Damage}<br/>`;
      if (row.Critical) gearInfo += `&bull; <b>Critical:</b> ${row.Critical}<br/>`;
      if (row.Protection) gearInfo += `&bull; <b>Protection:</b> ${row.Protection}<br/>`;
      if (row.Range) gearInfo += `&bull; <b>Range:</b> ${row.Range}<br/>`;
      gearInfo += `<hr/>`;

      const gearItem = {
        "_id": Math.random().toString(36).substring(2, 18),
        "name": name,
        "type": "equipement",
        "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
        "system": {
          "description": gearInfo + `<p>${row.Notes || ''}</p>`,
          "cout": parseInt(row.Cost) || 1
        },
        "effects": effects,
        "flags": {}
      };
      allItems.push(JSON.stringify(gearItem));
    }
  }
  await fs.writeFile(outFile, allItems.join('\n'));
}

async function buildVehicles() {
  const csvFile = path.join(__dirname, '../src/vehicles/vehicles.csv');
  const outFile = path.join(distDir, 'vehicles.db');
  const rows = await readCsv(csvFile);
  const items = [];

  for (const row of rows) {
    const name = (row.Name || row.name || "").trim();
    if (!name) continue;

    let vehicleInfo = `<b>[ VEHICLE SPECS ]</b><br/>`;
    vehicleInfo += `&bull; <b>Size:</b> ${row.Size}<br/>`;
    vehicleInfo += `&bull; <b>Strength:</b> ${row.Strength}<br/>`;
    vehicleInfo += `&bull; <b>Speed:</b> ${row.Speed}<br/>`;
    vehicleInfo += `&bull; <b>Defense:</b> ${row.Defense}<br/>`;
    vehicleInfo += `&bull; <b>Toughness:</b> ${row.Toughness}<br/>`;
    vehicleInfo += `<hr/>`;

    const vehicleItem = {
      "_id": Math.random().toString(36).substring(2, 18),
      "name": name,
      "type": "equipement",
      "img": "systems/mutants-and-masterminds-3e/assets/icons/equipement.svg",
      "system": {
        "description": vehicleInfo + `<p>${row.Notes || ''}</p>`,
        "cout": parseInt(row.Cost) || 1
      },
      "effects": [],
      "flags": {}
    };
    items.push(JSON.stringify(vehicleItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
}

async function buildModifiers(dataMap, fileName, subType) {
  const outFile = path.join(distDir, fileName);
  const items = [];

  for (const key in dataMap) {
    const mod = dataMap[key];
    const modItem = {
      "_id": Math.random().toString(36).substring(2, 18),
      "name": mod.name,
      "type": 'modificateur',
      "img": "systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg",
      "system": {
        "type": subType,
        "description": sanitizeText(mod.data.description),
        "cout": {
          "fixe": mod.data.cout.fixe,
          "rang": mod.data.cout.rang,
          "value": mod.data.cout.value
        }
      }
    };
    items.push(JSON.stringify(modItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
}

async function updateVersion() {
  const manifestPath = path.join(__dirname, '../mnm-3e-expanded/module.json');
  const manifest = await fs.readJson(manifestPath);
  const versionParts = manifest.version.split('.');
  versionParts[2] = parseInt(versionParts[2]) + 1;
  manifest.version = versionParts.join('.');
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  console.log(`Auto-incremented version to ${manifest.version}`);
}

async function main() {
  await fs.ensureDir(distDir);
  await updateVersion();
  await buildPowers();
  await buildAdvantages();
  await buildEquipment();
  await buildVehicles();
  await buildModifiers(EXTRAS, 'extras.db', 'extra');
  await buildModifiers(FLAWS, 'flaws.db', 'defaut');
}

main().catch(err => console.error(err));
