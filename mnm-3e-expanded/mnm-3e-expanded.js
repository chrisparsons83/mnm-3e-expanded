console.log('%c M&M 3E EXPANDED | SYSTEM HIJACK ACTIVE (V3.3.56) ', 'background: #800080; color: #fff; font-weight: bold;');

/**
 * Calculates the theoretical full cost of a power based on M&M 3e rules.
 */
function calculatePowerCost(item) {
  const c = item.system?.cout || {};
  const r = c.rang || 0;
  const pr = c.parrang || 0;
  const mr = c.modrang || 0;
  const fc = c.modfixe || 0;
  const d = c.divers || 0;
  const net = pr + mr;
  
  if (net > 0) return Math.max(1, (net * r) + fc + d);
  const ranksPerPoint = 2 - net;
  return Math.max(1, Math.ceil(r / ranksPerPoint) + fc + d);
}

/**
 * The core logic to override Power PP totals.
 * This is run every time the actor data is prepared.
 */
function applyExpandedLogic(actor) {
  if (actor.type !== 'personnage') return;

  const powers = actor.items.filter(i => i.type === 'pouvoir');
  if (powers.length === 0) return;

  // 1. Map out Arrays
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

  // 2. Identify Bearers and Max Costs
  const arrayMetadata = {};
  for (const pId in arrays) {
    let maxCost = 0;
    let bearerId = pId;
    
    arrays[pId].forEach(id => {
      const item = actor.items.get(id);
      if (!item) return;
      const full = calculatePowerCost(item);
      if (full > maxCost) {
        maxCost = full;
        bearerId = id;
      }
    });
    arrayMetadata[pId] = { max: maxCost, bearer: bearerId };
  }

  // 3. Force values in memory for rendering
  let totalPowerPP = 0;
  powers.forEach(item => {
    const full = calculatePowerCost(item);
    let target = full;

    const link = item.system.link;
    const parent = link ? (actor.items.get(link) || powers.find(i => i.name === link)) : null;
    const parentId = arrays[item._id] ? item._id : (parent ? parent._id : null);

    if (parentId && arrayMetadata[parentId]) {
      const meta = arrayMetadata[parentId];
      target = (item._id === meta.bearer) ? meta.max : 0;
    }

    // Override the value in the actor's current data structure
    item.system.cout.total = target;
    item.system.cout.totalTheorique = target;
    if (target === 0) item.system.cout.parrangtotal = "0";
    
    totalPowerPP += target;
  });

  // 4. Override top-level actor PP pool
  if (actor.system?.pp) {
    actor.system.pp.pouvoirs = totalPowerPP;
    const pp = actor.system.pp;
    const newTotal = (pp.caracteristiques || 0) + totalPowerPP + (pp.talents || 0) + (pp.competences || 0) + (pp.defenses || 0) + (pp.divers || 0);
    actor.system.pp.total = newTotal;
    actor.system.pp.used = newTotal;
  }
}

// HIJACK: Inject our logic into the Actor's calculation process
Hooks.once('init', () => {
  const originalPrepareDerivedData = CONFIG.Actor.documentClass.prototype.prepareDerivedData;
  CONFIG.Actor.documentClass.prototype.prepareDerivedData = function() {
    // Run the system's standard math first
    originalPrepareDerivedData.call(this);
    // Then immediately overwrite it with our corrected math
    applyExpandedLogic(this);
  };
});

// Structural Healing (Database-level fixes for malformed items)
async function structuralFixes(actor) {
  if (!actor.isOwner || actor._fixing) return;
  const updates = [];
  for (let item of actor.items) {
    if (item.type === 'pouvoir') {
      let needsUpdate = false;
      const update = { _id: item._id };
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
      if (needsUpdate) updates.push(update);
    }
  }
  if (updates.length > 0) {
    actor._fixing = true;
    await actor.updateEmbeddedDocuments('Item', updates);
    delete actor._fixing;
  }
}

Hooks.on('renderActorSheet', (app, html, data) => {
  const actor = data.actor || app.actor;
  if (actor) structuralFixes(actor);
});

// Drag and Drop Logic
Hooks.on('renderActorSheet', (app, html, data) => {
  const actor = data.actor || app.actor;
  if (!actor || actor.type !== 'personnage') return;

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
      const updates = SortingHelpers.performIntegerSort(sourceItem, { target: targetItem, siblings: siblings, sortKey: 'sort' });
      const updateData = updates.map(u => ({ _id: u.target._id, sort: u.update.sort }));
      await actor.updateEmbeddedDocuments('Item', updateData);
    });
  }
});
