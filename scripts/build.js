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

    let fullDescription = `<h3>Description</h3><p>${sanitizeText(row.Description || row.description)}</p>`;
    if (row.Mechanics || row.mechanics || row.MECHANICS) fullDescription += `<h3>Mechanics</h3><p>${sanitizeText(row.Mechanics || row.mechanics || row.MECHANICS)}</p>`;

    const action = (row.Action || row.action || row.ACTION || 'standard').trim().toLowerCase();
    const range = (row.Range || row.range || row.RANGE || 'close').trim().toLowerCase();
    const duration = (row.Duration || row.duration || row.DURATION || 'instant').trim().toLowerCase();
    const type = (row.Power || row.power || row.POWER || 'power').trim().toLowerCase();

    const baseRank = parseInt(row.Rank || row.rank || row.RANK) || 1;
    const baseCostPerRank = parseInt(row.Cost || row.cost || row.COST) || 1;
    let modCostPerRank = 0;
    let flatCost = 0;
    let extrasList = [];
    let flawsList = [];

    const extrasText = (row.Extras || row.extras || row.EXTRAS || '');
    const extrasObject = {};
    if (extrasText) {
      const extraNames = extrasText.split(',').map(e => e.trim());
      let count = 1;
      for (const extraName of extraNames) {
        const masterExtra = Object.keys(EXTRAS).find(k => k.toLowerCase() === extraName.toLowerCase());
        if (masterExtra) {
          const mod = EXTRAS[masterExtra];
          if (mod.data.cout.rang) modCostPerRank += mod.data.cout.value;
          if (mod.data.cout.fixe) flatCost += mod.data.cout.value;
          extrasList.push(`${mod.name} (+${mod.data.cout.value})`);
          extrasObject[count] = { name: mod.name, data: { description: mod.data.description, cout: mod.data.cout } };
          count++;
        }
      }
    }

    const flawsText = (row.Flaws || row.flaws || row.FLAWS || '');
    const flawsObject = {};
    if (flawsText) {
      const flawNames = flawsText.split(',').map(f => f.trim());
      let count = 1;
      for (const flawName of flawNames) {
        const masterFlaw = Object.keys(FLAWS).find(k => k.toLowerCase() === flawName.toLowerCase());
        if (masterFlaw) {
          const mod = FLAWS[masterFlaw];
          modCostPerRank += mod.data.cout.rang ? mod.data.cout.value : 0;
          flatCost += mod.data.cout.fixe ? mod.data.cout.value : 0;
          flawsList.push(`${mod.name} (${mod.data.cout.value})`);
          flawsObject[count] = { name: mod.name, data: { description: mod.data.description, cout: mod.data.cout } };
          count++;
        }
      }
    }

    const finalCostPerRank = Math.max(1, baseCostPerRank + modCostPerRank);
    const finalTotal = (finalCostPerRank * baseRank) + flatCost;

    let recipe = `<b>[ POWER SETUP RECIPE ]</b><br/>`;
    recipe += `&bull; <b>Rank:</b> Set Rank to <b>${baseRank}</b><br/>`;
    recipe += `&bull; <b>Action:</b> Select <b>${action.toUpperCase()}</b><br/>`;
    recipe += `&bull; <b>Range:</b> Select <b>${range.toUpperCase()}</b><br/>`;
    recipe += `&bull; <b>Duration:</b> Select <b>${duration.toUpperCase()}</b><br/>`;
    recipe += `&bull; <b>PP/Rank Ratio:</b> Select <b>${finalCostPerRank}:1</b><br/>`;
    recipe += `<b>TARGET TOTAL COST: ${finalTotal} PP</b><br/><hr/>`;

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
      "img": `systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg`,
      "system": {
        "activate": true,
        "special": translationMap.action[action] || 'simple',
        "type": systemType,
        "action": translationMap.action[action] || 'simple',
        "portee": translationMap.range[range] || 'contact',
        "duree": translationMap.duration[duration] || 'instantane',
        "description": recipe + fullDescription,
        "notes": recipe + sanitizeText(row.Description || row.description),
        "extras": extrasObject,
        "defauts": flawsObject,
        "cout": {
          "rang": baseRank,
          "parrang": baseCostPerRank,
          "total": finalTotal,
          "rangDyn": 0, "rangDynMax": 0, "divers": 0, "modrang": modCostPerRank, "modfixe": flatCost, "totalTheorique": finalTotal, "parrangtotal": "0"
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

    const effects = [];
    if (row.ModKey && row.ModValue) {
      effects.push({
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
        "description": `<p>${sanitizeText(row.Description || row.description)}</p>`,
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
  console.log(`Successfully built equipment.db with ${allItems.length} items.`);
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
      "img": `systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg`,
      "system": {
        "type": subType,
        "description": sanitizeText(mod.data.description),
        "cout": { "fixe": mod.data.cout.fixe, "rang": mod.data.cout.rang, "value": mod.data.cout.value }
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
  await buildModifiers(EXTRAS, 'extras.db', 'extra');
  await buildModifiers(FLAWS, 'flaws.db', 'defaut');
}

main().catch(err => console.error(err));
