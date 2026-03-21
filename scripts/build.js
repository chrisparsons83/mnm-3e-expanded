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

    const action = (row.Action || row.action || row.ACTION || 'standard').trim();
    const range = (row.Range || row.range || row.RANGE || 'close').trim();
    const duration = (row.Duration || row.duration || row.DURATION || 'instant').trim();

    // DYNAMIC COST CALCULATION (For the Summary)
    const baseRank = parseInt(row.Rank || row.rank || row.RANK) || 1;
    const baseCostPerRank = parseInt(row.Cost || row.cost || row.COST) || 1;
    let modCostPerRank = 0;
    let flatCost = 0;
    let extrasList = [];
    let flawsList = [];

    const extrasText = (row.Extras || row.extras || row.EXTRAS || '');
    if (extrasText) {
      const extraNames = extrasText.split(',').map(e => e.trim());
      for (const extraName of extraNames) {
        const masterExtra = Object.keys(EXTRAS).find(k => k.toLowerCase() === extraName.toLowerCase());
        if (masterExtra) {
          const mod = EXTRAS[masterExtra];
          if (mod.data.cout.rang) modCostPerRank += mod.data.cout.value;
          if (mod.data.cout.fixe) flatCost += mod.data.cout.value;
          extrasList.push(`${mod.name} (+${mod.data.cout.value})`);
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
          if (mod.data.cout.rang) modCostPerRank += mod.data.cout.value;
          if (mod.data.cout.fixe) flatCost += mod.data.cout.value;
          flawsList.push(`${mod.name} (${mod.data.cout.value})`);
        }
      }
    }

    const finalCostPerRank = Math.max(1, baseCostPerRank + modCostPerRank);
    const finalTotal = (finalCostPerRank * baseRank) + flatCost;

    // BUILD FINAL RECIPE SUMMARY (High-Visibility HTML)
    let recipe = `<b>[ POWER SETUP RECIPE ]</b><br/>`;
    recipe += `&bull; <b>Rank:</b> Set Rank to <b>${baseRank}</b><br/>`;
    recipe += `&bull; <b>Action:</b> Select <b>${action.toUpperCase()}</b><br/>`;
    recipe += `&bull; <b>Range:</b> Select <b>${range.toUpperCase()}</b><br/>`;
    recipe += `&bull; <b>Duration:</b> Select <b>${duration.toUpperCase()}</b><br/>`;
    recipe += `&bull; <b>PP/Rank Ratio:</b> Select <b>${finalCostPerRank}:1</b><br/>`;
    if (extrasList.length) recipe += `&bull; <b>Extras to Include:</b> ${extrasList.join(', ')}<br/>`;
    if (flawsList.length) recipe += `&bull; <b>Flaws to Include:</b> ${flawsList.join(', ')}<br/>`;
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
        "type": systemType,
        "description": recipe + fullDescription,
        "cout": {
          "rang": baseRank,
          "parrang": baseCostPerRank,
          "total": finalTotal,
          "rangDyn": 0,
          "rangDynMax": 0,
          "divers": 0,
          "modrang": modCostPerRank,
          "modfixe": flatCost,
          "totalTheorique": finalTotal,
          "parrangtotal": "0"
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
        "name": `${name} Bonus`,
        "changes": [{ "key": modKey, "mode": 2, "value": modValue.toString(), "priority": 20 }],
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
        "description": `<p>${row.Description || ''}</p>`,
        "rang": parseInt(row.Ranks || row.ranks) || 1
      },
      "effects": effects
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

    // BUILD MODIFIER SUMMARY (Visible at top of description)
    const costType = mod.data.cout.rang ? "PER RANK" : "FLAT (Fixed)";
    const costValue = mod.data.cout.value >= 0 ? `+${mod.data.cout.value}` : mod.data.cout.value;
    let modSummary = `<b>[ MODIFIER TYPE: ${subType.toUpperCase()} ]</b><br/>`;
    modSummary += `&bull; <b>Cost Type:</b> ${costType}<br/>`;
    modSummary += `&bull; <b>Cost Value:</b> ${costValue}<br/><hr/>`;

    const modItem = {
      "_id": Math.random().toString(36).substring(2, 18),
      "name": mod.name,
      "type": 'modificateur',
      "img": `systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg`,
      "system": {
        "type": subType,
        "description": modSummary + mod.data.description,
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
  console.log(`Successfully built ${fileName} with ${items.length} items.`);
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
  await buildModifiers(EXTRAS, 'extras.db', 'extra');
  await buildModifiers(FLAWS, 'flaws.db', 'defaut');
}
main().catch(err => console.error(err));
