const fs = require('fs-extra');
const csv = require('csv-parser');
const path = require('path');

const EXTRAS = require('./extras');
const FLAWS = require('./flaws');

// System Constants for Metadata
const SYSTEM_ID = "mutants-and-masterminds-3e";
const SYSTEM_VER = "1.39.13";
const CORE_VER = "13.350";

// M&M 3e French System Translation Mappings
const translationMap = {
  type: {
    'power': 'pouvoir',
    'advantage': 'talent',
    'attack': 'pouvoir',
    'defense': 'pouvoir'
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

function getBaseMetadata(id) {
  return {
    "_id": id || Math.random().toString(36).substring(2, 18),
    "ownership": { "default": 0 },
    "_stats": {
      "compendiumSource": null,
      "duplicateSource": null,
      "exportSource": null,
      "coreVersion": CORE_VER,
      "systemId": SYSTEM_ID,
      "systemVersion": SYSTEM_VER
    }
  };
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

    let fullDescription = `<h3>Description</h3><p>${row.Description || row.description || row.DESCRIPTION || ''}</p>`;
    if (row.Mechanics || row.mechanics || row.MECHANICS) fullDescription += `<h3>Mechanics</h3><p>${row.Mechanics || row.mechanics || row.MECHANICS}</p>`;

    const action = (row.Action || row.action || row.ACTION || 'standard').trim().toLowerCase();
    const range = (row.Range || row.range || row.RANGE || 'close').trim().toLowerCase();
    const duration = (row.Duration || row.duration || row.DURATION || 'instant').trim().toLowerCase();
    const type = (row.Power || row.power || row.POWER || 'power').trim().toLowerCase();

    const extrasText = (row.Extras || row.extras || row.EXTRAS || '');
    const extrasObject = {};
    if (extrasText) {
      const extraNames = extrasText.split(',').map(e => e.trim());
      let count = 1;
      for (const extraName of extraNames) {
        const masterExtra = Object.keys(EXTRAS).find(k => k.toLowerCase() === extraName.toLowerCase());
        if (masterExtra) {
          extrasObject[count] = JSON.parse(JSON.stringify(EXTRAS[masterExtra]));
          extrasObject[count].details = true;
          count++;
        }
      }
    }

    const flawsObject = {};
    const flawsText = (row.Flaws || row.flaws || row.FLAWS || '');
    if (flawsText) {
      const flawNames = flawsText.split(',').map(f => f.trim());
      let count = 1;
      for (const flawName of flawNames) {
        const masterFlaw = Object.keys(FLAWS).find(k => k.toLowerCase() === flawName.toLowerCase());
        if (masterFlaw) {
          flawsObject[count] = JSON.parse(JSON.stringify(FLAWS[masterFlaw]));
          flawsObject[count].details = true;
          count++;
        }
      }
    }

    // DYNAMIC POWER TYPE (Fixes transfer issue)
    let systemType = 'generaux';
    const lowerName = name.toLowerCase();
    const attackPowers = ['blast', 'affliction', 'damage', 'dazzle', 'nullify', 'mind control', 'strike', 'trip', 'weaken'];
    
    if (attackPowers.some(p => lowerName.includes(p)) || row.Power.toLowerCase() === 'attack') {
      systemType = 'attaque';
    }

    // DYNAMIC COST CALCULATION (Fixes character sheet rejection)
    const baseRank = parseInt(row.Rank || row.rank || row.RANK) || 1;
    const baseCostPerRank = parseInt(row.Cost || row.cost || row.COST) || 1;
    
    // Calculate modifier impact
    let modCostPerRank = 0;
    let flatCost = 0;
    
    Object.values(extrasObject).forEach(e => {
      if (e.data.cout.rang) modCostPerRank += e.data.cout.value;
      if (e.data.cout.fixe) flatCost += e.data.cout.value;
    });
    
    Object.values(flawsObject).forEach(f => {
      if (f.data.cout.rang) modCostPerRank += f.data.cout.value;
      if (f.data.cout.fixe) flatCost += f.data.cout.value;
    });

    const finalCostPerRank = Math.max(1, baseCostPerRank + modCostPerRank);
    const finalTotal = (finalCostPerRank * baseRank) + flatCost;

    const powerItem = {
      ...getBaseMetadata(),
      name: name,
      type: translationMap.type[type] || 'pouvoir',
      img: `systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg`,
      system: {
        activate: true,
        special: translationMap.action[action] || 'simple',
        type: systemType,
        action: translationMap.action[action] || 'simple',
        portee: translationMap.range[range] || 'contact',
        duree: translationMap.duration[duration] || 'instantane',
        effets: fullDescription,
        notes: row.Description || '',
        extras: extrasObject,
        defauts: flawsObject,
        cout: {
          rang: baseRank,
          parrang: baseCostPerRank,
          total: finalTotal, // Forced calculation
          rangDyn: 0,
          rangDynMax: 0,
          divers: 0,
          modrang: modCostPerRank,
          modfixe: flatCost,
          totalTheorique: finalTotal,
          parrangtotal: finalCostPerRank.toString() // String required by system
        }
      }
    };
    items.push(JSON.stringify(powerItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
  console.log(`Successfully built powers.db with ${items.length} items.`);
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
    const modKey = row.ModKey || row.modkey;
    const modValue = row.ModValue || row.modvalue;

    if (modKey && modValue) {
      effects.push({
        ...getBaseMetadata("eff" + Math.random().toString(36).substring(2, 10)),
        name: `${name} Bonus`,
        changes: [{ key: modKey, mode: 2, value: modValue.toString(), priority: 20 }],
        disabled: false,
        transfer: true,
        icon: 'systems/mutants-and-masterminds-3e/assets/icons/talent.svg',
        type: 'base'
      });
    }

    const advantageItem = {
      ...getBaseMetadata(),
      name: name,
      type: 'talent',
      img: 'systems/mutants-and-masterminds-3e/assets/icons/talent.svg',
      system: {
        description: `<p>${row.Description || ''}</p>`,
        equipement: false,
        rang: parseInt(row.Ranks || row.ranks) || 1,
        edit: true,
        listEffectsVariantes: {}
      },
      effects: effects
    };
    items.push(JSON.stringify(advantageItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
  console.log(`Successfully built advantages.db with ${items.length} items.`);
}

async function buildModifiers(dataMap, fileName, subType) {
  const outFile = path.join(distDir, fileName);
  const items = [];

  for (const key in dataMap) {
    const mod = dataMap[key];
    const modItem = {
      ...getBaseMetadata(),
      name: mod.name,
      type: 'modificateur', // Professional Modifier type
      img: `systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg`,
      system: {
        type: subType, // "extra" or "defaut"
        description: mod.data.description,
        notes: mod.data.description,
        cout: {
          fixe: mod.data.cout.fixe,
          rang: mod.data.cout.rang,
          value: mod.data.cout.value
        }
      }
    };
    items.push(JSON.stringify(modItem));
  }
  await fs.writeFile(outFile, items.join('\n'));
  console.log(`Successfully built ${fileName} with ${items.length} items.`);
}

async function main() {
  await fs.ensureDir(distDir);
  await buildPowers();
  await buildAdvantages();
  await buildModifiers(EXTRAS, 'extras.db', 'extra');
  await buildModifiers(FLAWS, 'flaws.db', 'defaut');
}

main().catch(err => console.error(err));
