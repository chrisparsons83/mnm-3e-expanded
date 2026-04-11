const fs = require('fs-extra');
const path = require('path');

const distDir = path.join(__dirname, '../mnm-3e-expanded/packs');
const compendiumPath = path.join(__dirname, '../compendium.json');

// Corrected Cost Calculation Logic (Standard M&M 3e)
function calculatePowerCost(power) {
  if (!power.system || !power.system.cout) return power;
  if (power.type === 'talent') return power;

  let baseRank = power.system.cout.rang || 1;
  let baseCostPerRank = power.system.cout.parrang || 1;
  let modCostPerRank = 0;
  let flatModTotal = 0;
  
  if (power.system.extras) {
    for (let extra of Object.values(power.system.extras)) {
      if (extra.data && extra.data.cout) {
        if (extra.data.cout.rang && !extra.data.cout.fixe) modCostPerRank += extra.data.cout.value;
        else if (extra.data.cout.fixe) flatModTotal += (extra.data.cout.rang ? (extra.rang || 1) : 1) * extra.data.cout.value;
      }
    }
  }

  if (power.system.defauts) {
    for (let flaw of Object.values(power.system.defauts)) {
      if (flaw.data && flaw.data.cout) {
        if (flaw.data.cout.rang && !flaw.data.cout.fixe) modCostPerRank -= flaw.data.cout.value;
        else if (flaw.data.cout.fixe) {
          if (flaw.name !== 'Removable' && flaw.name !== 'Easily Removable') {
            flatModTotal -= (flaw.data.cout.rang ? (flaw.rang || 1) : 1) * flaw.data.cout.value;
          }
        }
      }
    }
  }

  let netCostPerRank = baseCostPerRank + modCostPerRank;
  let totalRankCost = 0;
  let displayCostPerRank = "";

  if (netCostPerRank > 0) {
    totalRankCost = netCostPerRank * baseRank;
    displayCostPerRank = netCostPerRank.toString();
  } else {
    let ranksPerPoint = 2 - netCostPerRank;
    totalRankCost = Math.ceil(baseRank / ranksPerPoint);
    displayCostPerRank = `1/${ranksPerPoint}`;
  }

  let finalTotal = totalRankCost;
  if (power.system.defauts) {
    for (let flaw of Object.values(power.system.defauts)) {
      if (flaw.name === 'Removable') finalTotal -= Math.floor(finalTotal / 5) * 1;
      else if (flaw.name === 'Easily Removable') finalTotal -= Math.floor(finalTotal / 5) * 2;
    }
  }
  finalTotal += flatModTotal;

  power.system.cout.total = Math.max(1, finalTotal);
  power.system.cout.totalTheorique = Math.max(1, finalTotal);
  power.system.cout.modrang = modCostPerRank;
  power.system.cout.modfixe = flatModTotal;
  power.system.cout.parrangtotal = displayCostPerRank;
  
  return power;
}

async function build() {
  if (!await fs.pathExists(compendiumPath)) {
    console.error('compendium.json not found!');
    return;
  }

  const data = await fs.readJson(compendiumPath);
  await fs.ensureDir(distDir);

  for (const [key, items] of Object.entries(data)) {
    const processedItems = items.map(item => {
      if (key === 'powers') {
        // Clear Extras and Flaws as requested
        if (item.system) {
          item.system.extras = {};
          item.system.defauts = {};
        }
        return calculatePowerCost(item);
      }
      return item;
    });

    const ldj = processedItems.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile(path.join(distDir, `${key}.db`), ldj);
    console.log(`Pack built: ${key} (${items.length} items)`);
  }
  console.log('Build Complete: All compendiums synchronized from compendium.json.');
}

build().catch(err => console.error(err));
