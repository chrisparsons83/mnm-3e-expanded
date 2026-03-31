const fs = require('fs-extra');
const path = require('path');

const jsonPath = path.join(__dirname, 'advantages.json');

async function fixAdvantages() {
  const advantages = await fs.readJson(jsonPath);
  
  const fixed = advantages.map(adv => {
    if (adv.system) {
      const descText = adv.system.notes || (typeof adv.system.description === 'string' ? adv.system.description : (adv.system.description?.value || ''));
      
      // Both as plain strings
      adv.system.notes = descText;
      adv.system.description = descText;
    }
    return adv;
  });
  
  await fs.writeJson(jsonPath, fixed, { spaces: 2 });
  console.log(`Updated ${fixed.length} advantages to have system.description and system.notes as strings.`);
}

fixAdvantages();
