console.warn("M&M 3e Expanded | Script Initializing...");

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

  for (let item of actor.items) {
    if (item.type === 'pouvoir') {
      const update = { _id: item._id };
      let needsUpdate = false;

      // Structural fixes (arrays to objects)
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
      // theoriqueCost is what the base system uses to compute pp.pouvoirs (via totalTheorique).
      // For array non-bearers this must be 0 so the derived PP total is correct.
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
          const mr = mc.rang || 0;
          const mf = mnet > 0 ? (mnet * mr + (mc.modfixe || 0) + (mc.divers || 0)) : (Math.ceil(mr / (2 - mnet)) + (mc.modfixe || 0) + (mc.divers || 0));
          if (mf > best) { best = mf; bearerId = id; }
        });
        const isBearer = (item._id === bearerId);
        // Bearer pays the array cost (most expensive member); all others cost 0.
        targetCost = isBearer ? arrayMaxCosts[parentId] : 0;
        // totalTheorique must also be 0 for non-bearers so the base system's
        // prepareDerivedData() calculates pp.pouvoirs correctly.
        theoriqueCost = isBearer ? arrayMaxCosts[parentId] : 0;
        if (!isBearer) displayCostPerRank = "0";
      }

      newPowerSum += targetCost;

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

  if (updates.length > 0 || pp.pouvoirs !== newPowerSum || pp.total !== currentTotalSpent) {
    actor._healing = true;
    try {
      console.group(`M&M 3e Expanded | Self-Healing: ${actor.name}`);
      console.log(`Powers: ${powers.length} | New PP Sum: ${newPowerSum} | Spent: ${currentTotalSpent}`);
      if (updates.length > 0) console.log(`Items Updated: ${updates.length}`);
      console.groupEnd();

      if (updates.length > 0) await actor.updateEmbeddedDocuments('Item', updates);
      await actor.update({
        ...pwrUpdates,
        'system.pp.pouvoirs': newPowerSum,
        'system.pp.total': currentTotalSpent,
        'system.pp.used': currentTotalSpent
      });
    } catch (err) {
      console.error("M&M 3e Expanded | Self-Healing Error:", err);
    } finally {
      delete actor._healing;
    }
  }
}

Hooks.once('ready', () => {
  console.log("M&M 3e Expanded | Ready and Listening");
});

Hooks.on('renderActorSheet', (app, html, data) => {
  const actor = data.actor || app.actor;
  if (!actor || actor.type !== 'personnage') return;

  // Run self-healing
  healActorData(actor);

  // --- Drag and Drop Sorting for Powers ---
  const powerList = html.find('.pouvoir-list, .item-list');
  const powers = powerList.find('.item.pouvoir, .pouvoir-item');

  if (powers.length > 0) {
    powers.attr('draggable', true);

    powers.on('dragstart', (ev) => {
      const li = ev.currentTarget;
      ev.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'Item',
        uuid: actor.items.get(li.dataset.itemId).uuid,
        sort: parseInt(li.dataset.sort || 0)
      }));
    });

    powerList.on('drop', async (ev) => {
      const dragData = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
      if (dragData.type !== 'Item') return;

      const targetLi = $(ev.target).closest('.item');
      if (!targetLi.length) return;

      const targetId = targetLi.data('itemId');
      const sourceId = dragData.uuid.split('.').pop();
      if (targetId === sourceId) return;

      const siblings = actor.items.filter(i => i.type === 'pouvoir');
      const sourceItem = actor.items.get(sourceId);
      const targetItem = actor.items.get(targetId);

      if (!sourceItem || !targetItem) return;

      const updates = SortingHelpers.performIntegerSort(sourceItem, {
        target: targetItem,
        siblings: siblings,
        sortKey: 'sort'
      });

      const updateData = updates.map(u => ({
        _id: u.target._id,
        sort: u.update.sort
      }));

      await actor.updateEmbeddedDocuments('Item', updateData);
    });
  }
});

Hooks.on('renderItemSheet', (app, html, data) => {
  const item = data.item || app.item;
  if (!item || item.type !== 'pouvoir') return;

  // --- Drag and Drop Sorting for Modifiers ---
  const modifiers = html.find('.extras-list .item, .flaws-list .item, .modifier-item');
  if (modifiers.length > 0) {
    modifiers.attr('draggable', true);

    modifiers.on('dragstart', (ev) => {
      const li = ev.currentTarget;
      ev.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
        index: li.dataset.index,
        type: li.closest('.extras-list').length ? 'extras' : 'defauts'
      }));
    });

    html.find('.extras-list, .flaws-list').on('drop', async (ev) => {
      const dragData = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
      const dropType = ev.currentTarget.classList.contains('extras-list') ? 'extras' : 'defauts';
      
      if (dragData.type !== dropType) return;

      const targetLi = $(ev.target).closest('.item, .modifier-item');
      if (!targetLi.length) return;

      const oldIndex = parseInt(dragData.index);
      const newIndex = parseInt(targetLi.data('index'));
      if (oldIndex === newIndex) return;

      const list = duplicate(item.system[dropType]);
      const entries = Object.entries(list).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
      
      const [moved] = entries.splice(oldIndex - 1, 1);
      entries.splice(newIndex - 1, 0, moved);

      const newList = {};
      entries.forEach((entry, i) => {
        newList[i + 1] = entry[1];
      });

      await item.update({ [`system.${dropType}`]: newList });
    });
  }
});
