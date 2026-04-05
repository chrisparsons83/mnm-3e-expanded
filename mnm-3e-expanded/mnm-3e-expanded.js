console.error("M&M 3E EXPANDED | SCRIPT LOADED (V3.3.55)");

// Self-Healing Logic: Fixes legacy data structures and calculates PP costs
async function healActorData(actor) {
  if (!actor.isOwner || actor._healing) return;
  
  const powers = actor.items.filter(i => i.type === 'pouvoir');
  const talents = actor.items.filter(i => i.type === 'talent');

  // Group powers by array
  const arrays = {};
  powers.forEach(p => {
    const link = p.system.link;
    if (link) {
      const parent = actor.items.get(link) || powers.find(i => i.name === link);
      if (parent) {
        const pId = parent._id;
        if (!arrays[pId]) arrays[pId] = [pId];
        if (!arrays[pId].includes(p._id)) arrays[pId].push(p._id);
      }
    }
  });

  // Calculate costs and identify bearers
  const arrayMaxCosts = {};
  for (const parentId in arrays) {
    let max = 0;
    arrays[parentId].forEach(id => {
      const item = actor.items.get(id);
      if (!item) return;
      const c = item.system.cout || {};
      const r = c.rang || 0;
      const pr = c.parrang || 0;
      const mr = c.modrang || 0;
      const fc = c.modfixe || 0;
      const d = c.divers || 0;
      const net = pr + mr;
      const full = net > 0 ? (net * r + fc + d) : (Math.ceil(r / (2 - net)) + fc + d);
      if (full > max) max = full;
    });
    arrayMaxCosts[parentId] = Math.max(1, max);
  }

  const itemUpdates = [];
  const pwrUpdates = {};
  let newPowerSum = 0;
  const debugData = [];

  // Process Powers
  for (let item of powers) {
    const update = { _id: item._id };
    let needsUpdate = false;

    // Structural Fixes
    if (Array.isArray(item.system.extras)) {
      const obj = {};
      item.system.extras.forEach((e, i) => { if (e) obj[i + 1] = e; });
      update['system.extras'] = obj;
      needsUpdate = true;
    }
    if (Array.isArray(item.system.defauts)) {
      const obj = {};
      item.system.defauts.forEach((f, i) => { if (f) obj[i + 1] = f; });
      update['system.defauts'] = obj;
      needsUpdate = true;
    }

    // Cost Calculation
    const c = item.system.cout || {};
    const r = c.rang || 0;
    const pr = c.parrang || 0;
    const mr = c.modrang || 0;
    const fc = c.modfixe || 0;
    const d = c.divers || 0;
    const net = pr + mr;
    
    let fullCost = net > 0 ? (net * r + fc + d) : (Math.ceil(r / (2 - net)) + fc + d);
    fullCost = Math.max(1, fullCost);

    let targetCost = fullCost;
    let theoriqueCost = fullCost;
    let displayCostPerRank = net > 0 ? net.toString() : `1/${2 - net}`;

    // Array logic
    const link = item.system.link;
    const parent = link ? (actor.items.get(link) || powers.find(i => i.name === link)) : null;
    const parentId = arrays[item._id] ? item._id : (parent ? parent._id : null);

    if (parentId && arrays[parentId]) {
      const members = arrays[parentId];
      let bearerId = parentId;
      let best = -1;
      members.forEach(id => {
        const m = actor.items.get(id);
        const mc = m.system.cout || {};
        const mnet = (mc.parrang || 0) + (mc.modrang || 0);
        const m_rank = mc.rang || 0;
        const mf = mnet > 0 ? (mnet * m_rank + (mc.modfixe || 0) + (mc.divers || 0)) : (Math.ceil(m_rank / (2 - mnet)) + (mc.modfixe || 0) + (mc.divers || 0));
        if (mf > best) { best = mf; bearerId = id; }
      });
      const isBearer = (item._id === bearerId);
      targetCost = isBearer ? arrayMaxCosts[parentId] : 0;
      theoriqueCost = isBearer ? arrayMaxCosts[parentId] : 0;
      if (!isBearer) displayCostPerRank = "0";
    }

    newPowerSum += targetCost;
    debugData.push({ Name: item.name, Cost: targetCost, Theorique: theoriqueCost });

    if (c.total !== targetCost) { update['system.cout.total'] = targetCost; needsUpdate = true; }
    if (c.totalTheorique !== theoriqueCost) { update['system.cout.totalTheorique'] = theoriqueCost; needsUpdate = true; }
    if (c.parrangtotal !== displayCostPerRank) { update['system.cout.parrangtotal'] = displayCostPerRank; needsUpdate = true; }

    if (needsUpdate) {
      itemUpdates.push(update);
      pwrUpdates[`system.pwr.${item._id}.cout.total`] = targetCost;
      pwrUpdates[`system.pwr.${item._id}.cout.totalTheorique`] = theoriqueCost;
    }
  }

  const pp = actor.system.pp || {};
  const currentTotalSpent = (pp.caracteristiques || 0) + newPowerSum + (pp.talents || 0) + (pp.competences || 0) + (pp.defenses || 0) + (pp.divers || 0);

  // LOG MATH
  console.group(`M&M 3E EXPANDED | HEALING CALCULATION: ${actor.name}`);
  console.table(debugData);
  console.log(`Summary | Powers: ${newPowerSum} | Total Spent: ${currentTotalSpent}`);
  console.groupEnd();

  // Update Actor UI Instance immediately
  actor.system.pp.pouvoirs = newPowerSum;
  actor.system.pp.total = currentTotalSpent;
  actor.system.pp.used = currentTotalSpent;

  if (itemUpdates.length > 0 || pp.pouvoirs !== newPowerSum) {
    actor._healing = true;
    try {
      if (itemUpdates.length > 0) await actor.updateEmbeddedDocuments('Item', itemUpdates);
      
      const doSync = async () => {
        await actor.update({
          ...pwrUpdates,
          'system.pp.pouvoirs': newPowerSum,
          'system.pp.total': currentTotalSpent,
          'system.pp.used': currentTotalSpent
        });
      };

      setTimeout(async () => { await doSync(); delete actor._healing; }, 500);
      setTimeout(async () => { await doSync(); }, 2000); // Safety sync
    } catch (err) {
      console.error("M&M 3e Expanded | Self-Healing Error:", err);
      delete actor._healing;
    }
  }
}

// Hooks for Sheets
Hooks.on('renderActorSheet', (app, html, data) => {
  const actor = data.actor || app.actor;
  if (!actor || actor.type !== 'personnage') return;
  console.log("M&M 3E EXPANDED | RENDER ACTOR:", actor.name);
  healActorData(actor);
});
