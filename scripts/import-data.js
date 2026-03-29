const fs = require('fs-extra');
const path = require('path');

const packsDir = path.join(__dirname, '../mnm-3e-expanded/packs');

// Corrected Cost Calculation Logic
function calculatePowerCost(power) {
  if (!power.system || !power.system.cout) return power;

  let baseRank = power.system.cout.rang || 1;
  let baseCostPerRank = power.system.cout.parrang || 1;
  let modCostPerRank = 0;
  let flatModTotal = 0;
  
  // 1. Calculate per-rank modifiers from Extras
  if (power.system.extras) {
    for (let extra of Object.values(power.system.extras)) {
      if (extra.data && extra.data.cout) {
        if (extra.data.cout.rang && !extra.data.cout.fixe) {
          // Per Rank of Power (+1 per rank)
          modCostPerRank += extra.data.cout.value;
        } else if (extra.data.cout.fixe) {
          // Flat cost (Simple Flat OR Flat per Modifier Rank)
          if (extra.data.cout.rang) {
            flatModTotal += (extra.rang || 1) * extra.data.cout.value;
          } else {
            flatModTotal += extra.data.cout.value;
          }
        }
      }
    }
  }

  // 2. Calculate per-rank modifiers from Flaws
  if (power.system.defauts) {
    for (let flaw of Object.values(power.system.defauts)) {
      if (flaw.data && flaw.data.cout) {
        if (flaw.data.cout.rang && !flaw.data.cout.fixe) {
          // Per Rank of Power (-1 per rank)
          modCostPerRank -= flaw.data.cout.value;
        } else if (flaw.data.cout.fixe) {
          if (flaw.name !== 'Removable' && flaw.name !== 'Easily Removable') {
             if (flaw.data.cout.rang) {
               // Flat per rank of the modifier (Check Required, etc.)
               flatModTotal -= (flaw.rang || 1) * flaw.data.cout.value;
             } else {
               // Simple flat cost
               flatModTotal -= flaw.data.cout.value;
             }
          }
        }
      }
    }
  }

  // 3. Determine Cost Per Rank (Fractional Logic)
  let netCostPerRank = baseCostPerRank + modCostPerRank;
  let totalRankCost = 0;
  let displayCostPerRank = "";

  if (netCostPerRank > 0) {
    totalRankCost = netCostPerRank * baseRank;
    displayCostPerRank = netCostPerRank.toString();
  } else {
    // Fractional cost logic: 0 -> 1/2, -1 -> 1/3, -2 -> 1/4, etc.
    let ranksPerPoint = 2 - netCostPerRank;
    totalRankCost = Math.ceil(baseRank / ranksPerPoint);
    displayCostPerRank = `1/${ranksPerPoint}`;
  }

  // 4. Apply Flat Modifiers (like Removable)
  let finalTotal = totalRankCost;
  
  if (power.system.defauts) {
    for (let flaw of Object.values(power.system.defauts)) {
      if (flaw.name === 'Removable') {
        finalTotal -= Math.floor(finalTotal / 5) * 1;
      } else if (flaw.name === 'Easily Removable') {
        finalTotal -= Math.floor(finalTotal / 5) * 2;
      }
    }
  }
  
  finalTotal += flatModTotal;

  power.system.cout.total = Math.max(1, finalTotal);
  power.system.cout.modrang = modCostPerRank;
  power.system.cout.modfixe = flatModTotal;
  power.system.cout.parrangtotal = displayCostPerRank;
  
  return power;
}

async function importData() {
  const compendiumPath = path.join(__dirname, '../compendium.json');
  if (!await fs.pathExists(compendiumPath)) {
    console.error('compendium.json not found. Please run export-data.js first.');
    return;
  }

  const data = await fs.readJson(compendiumPath);
  
  for (const [key, items] of Object.entries(data)) {
    const processedItems = items.map(item => {
      if (key === 'powers') {
        // Create a new item object that omits 'extras' and 'defauts'
        const processedItem = { ...item };
        if (processedItem.system) {
          delete processedItem.system.extras;
          delete processedItem.system.defauts;
        }
        return calculatePowerCost(processedItem);
      }
      return item;
    });

    const ldj = processedItems.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile(path.join(packsDir, `${key}.db`), ldj);
  }
  console.log('Imported and recalculated costs from compendium.json using updated math.');
}

importData();
