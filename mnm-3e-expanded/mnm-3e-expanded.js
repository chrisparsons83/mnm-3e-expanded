console.error("M&M 3E EXPANDED | SCRIPT LOADED (ERROR LOG FOR VISIBILITY)");
console.log('%c M&M 3E EXPANDED | SCRIPT LOADED ', 'background: #444; color: #fff; font-weight: bold; padding: 2px 5px;');

// Self-Healing Logic: Fixes legacy data structures on the fly
async function healActorData(actor) {
  if (!actor.isOwner || actor._healing) return;
  
  const powers = actor.items.filter(i => i.type === 'pouvoir');
  if (powers.length === 0) return;

  // Group powers by array (link can be ID or Name)
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

  const updates = [];
  const pwrUpdates = {};
  let newPowerSum = 0;
  const debugData = [];

  for (let item of actor.items) {
    if (item.type === 'pouvoir') {
      const update = { _id: item._id };
      let needsUpdate = false;

      // Calculation
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
        updates.push(update);
        pwrUpdates[`system.pwr.${item._id}.cout.total`] = targetCost;
        pwrUpdates[`system.pwr.${item._id}.cout.totalTheorique`] = theoriqueCost;
      }
    }
  }

  const pp = actor.system.pp || {};
  const currentTotalSpent = (pp.caracteristiques || 0) + newPowerSum + (pp.talents || 0) + (pp.competences || 0) + (pp.defenses || 0) + (pp.divers || 0);

  // ALWAYS Log something when render fires to confirm hook is active
  console.group(`M&M 3E EXPANDED | RENDER ${actor.name.toUpperCase()}`);
  console.log(`Current Powers Total: ${pp.pouvoirs} | Calculated Sum: ${newPowerSum}`);
  if (updates.length > 0) console.table(debugData);
  console.groupEnd();

  if (updates.length > 0 || pp.pouvoirs !== newPowerSum || pp.total !== currentTotalSpent) {
    actor._healing = true;
    try {
      ui.notifications.info(`M&M 3e Expanded: Syncing PP costs for ${actor.name}`);
      
      if (updates.length > 0) await actor.updateEmbeddedDocuments('Item', updates);
      
      // Delay actor update slightly to beat derived data recalculation
      setTimeout(async () => {
        await actor.update({
          ...pwrUpdates,
          'system.pp.pouvoirs': newPowerSum,
          'system.pp.total': currentTotalSpent,
          'system.pp.used': currentTotalSpent
        });
        delete actor._healing;
      }, 200);
    } catch (err) {
      console.error("M&M 3e Expanded | Self-Healing Error:", err);
      delete actor._healing;
    }
  }
}

Hooks.on('renderActorSheet', (app, html, data) => {
  const actor = data.actor || app.actor;
  if (!actor || actor.type !== 'personnage') return;
  console.error("M&M 3E EXPANDED | RENDER HOOK FIRED FOR " + actor.name);
  healActorData(actor);
});
