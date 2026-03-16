const fs = require('fs-extra');
const csv = require('csv-parser');
const path = require('path');

// M&M 3e French System Translation Mappings
const translationMap = {
  type: {
    'power': 'pouvoir',
    'advantage': 'avantage',
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
    'ranged': 'a distance',
    'perception': 'perception',
    'rank': 'rang'
  },
  duration: {
    'instant': 'instantane',
    'sustained': 'maintenu',
    'continuous': 'continu',
    'concentration': 'concentration',
    'permanent': 'permanent'
  }
};

async function build() {
  const csvFile = path.join(__dirname, '../1st Powers Input.csv');
  const distDir = path.join(__dirname, '../packs');
  const outFile = path.join(distDir, 'powers.db');

  // Ensure output directory exists
  await fs.ensureDir(distDir);

  const items = [];

  const readCsv = () => {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(csvFile)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '')
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  };

  const rows = await readCsv();
  if (rows.length > 0) {
    console.log('First row data keys:', Object.keys(rows[0]));
    console.log('First row name value:', rows[0].Name || rows[0].name);
  }

  for (const row of rows) {
    const name = row.Name || row.name;
    if (!name) continue;

    // Build the description from multiple columns
    let fullDescription = `<h3>Description</h3><p>${row.Description || row.description || ''}</p>`;
    if (row.Mechanics || row.mechanics) fullDescription += `<h3>Mechanics</h3><p>${row.Mechanics || row.mechanics}</p>`;
    if (row.Extras || row.extras) fullDescription += `<h3>Extras</h3><p>${row.Extras || row.extras}</p>`;
    if (row.Flaws || row.flaws) fullDescription += `<h3>Flaws</h3><p>${row.Flaws || row.flaws}</p>`;

    const action = (row.Action || row.action || 'standard').trim().toLowerCase();
    const range = (row.Range || row.range || 'close').trim().toLowerCase();
    const duration = (row.Duration || row.duration || 'instant').trim().toLowerCase();
    const type = (row.Power || row.power || 'power').trim().toLowerCase();

    const foundryItem = {
      name: name,
      type: translationMap.type[type] || 'pouvoir',
      img: `systems/mutants-and-masterminds-3e/assets/icons/${translationMap.type[type] || 'pouvoir'}.svg`,
      system: {
        activate: true,
        special: translationMap.action[action] || action,
        type: 'attaque',
        action: translationMap.action[action] || action,
        portee: translationMap.range[range] || range,
        duree: translationMap.duration[duration] || duration,
        effets: fullDescription,
        notes: row.Description || row.description || '',
        cout: {
          rang: parseInt(row.Rank || row.rank) || 0,
          parrang: parseInt(row.Cost || row.cost) || 1,
          total: (parseInt(row.Rank || row.rank) || 0) * (parseInt(row.Cost || row.cost) || 1)
        }
      },
      _id: Math.random().toString(36).substring(2, 18)
    };

    items.push(JSON.stringify(foundryItem));
  }

  await fs.writeFile(outFile, items.join('\n'));
  console.log(`Successfully built powers.db with ${items.length} items from CSV.`);
}

build().catch(err => console.error(err));
