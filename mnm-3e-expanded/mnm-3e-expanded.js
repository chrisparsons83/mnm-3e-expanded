console.log('%c M&M 3E EXPANDED | SYSTEM HIJACK ACTIVE (V3.3.64) ', 'background: #800080; color: #fff; font-weight: bold;');

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
 * The core logic to override Power and Equipment PP/EP totals.
 */
function applyExpandedLogic(actor) {
  if (actor.type !== 'personnage') return;

  const powers = actor.items.filter(i => i.type === 'pouvoir');
  const equipment = actor.items.filter(i => i.type === 'equipement');

  // --- 1. POWER ARRAY LOGIC ---
  const pArrays = {};
  powers.forEach(p => {
    const link = p.system.link;
    if (link) {
      const parent = actor.items.get(link) || powers.find(i => i.name === link);
      if (parent) {
        const pId = parent._id;
        if (!pArrays[pId]) pArrays[pId] = [pId];
        if (!pArrays[pId].includes(p._id)) pArrays[pId].push(p._id);
      }
    }
  });

  const pArrayMetadata = {};
  for (const pId in pArrays) {
    let maxCost = 0;
    let bearerId = pId;
    pArrays[pId].forEach(id => {
      const item = actor.items.get(id);
      if (!item) return;
      const full = calculatePowerCost(item);
      if (full > maxCost) { maxCost = full; bearerId = id; }
    });
    pArrayMetadata[pId] = { max: maxCost, bearer: bearerId };
  }

  let totalPowerPP = 0;
  let totalEquipmentEP = 0;

  // Process Equipment first to establish base EP
  equipment.forEach(e => {
    totalEquipmentEP += (parseInt(e.system.cout) || 0);
  });

  powers.forEach(item => {
    const flags = item.flags['mnm-3e-expanded'] || {};
    const full = calculatePowerCost(item);
    let target = full;

    // Check if it's an EP Power (on equipment)
    if (flags.costAsEP && flags.parentEquipmentId) {
      // This power contributes to EP, not PP
      totalEquipmentEP += full;
      target = 0; // Does not cost PP
    } else {
      // Standard Power Array Logic
      const link = item.system.link;
      const parent = link ? (actor.items.get(link) || powers.find(i => i.name === link)) : null;
      const parentId = pArrays[item._id] ? item._id : (parent ? parent._id : null);

      if (parentId && pArrayMetadata[parentId]) {
        const meta = pArrayMetadata[parentId];
        target = (item._id === meta.bearer) ? meta.max : 0;
      }
      totalPowerPP += target;
    }

    // Override the value in the actor's current data structure
    item.system.cout.total = target;
    item.system.cout.totalTheorique = target;
    if (target === 0) item.system.cout.parrangtotal = "0";
  });

  // --- 2. EQUIPMENT ARRAY LOGIC (Utility Belts etc) ---
  const eArrays = {};
  equipment.forEach(e => {
    const link = e.flags['mnm-3e-expanded']?.link;
    if (link) {
      const parent = actor.items.get(link) || equipment.find(i => i.name === link);
      if (parent) {
        const pId = parent._id;
        if (!eArrays[pId]) eArrays[pId] = [pId];
        if (!eArrays[pId].includes(e._id)) eArrays[pId].push(e._id);
      }
    }
  });

  const eArrayMetadata = {};
  for (const pId in eArrays) {
    let maxCost = 0;
    let bearerId = pId;
    eArrays[pId].forEach(id => {
      const item = actor.items.get(id);
      if (!item) return;
      const cost = parseInt(item.system.cout) || 0;
      if (cost > maxCost) { maxCost = cost; bearerId = id; }
    });
    eArrayMetadata[pId] = { max: maxCost, bearer: bearerId };
  }

  // Recalculate totalEquipmentEP with array discounts
  totalEquipmentEP = 0;
  equipment.forEach(item => {
    const baseCost = parseInt(item.system.cout) || 0;
    let target = baseCost;
    const link = item.flags['mnm-3e-expanded']?.link;
    const parent = link ? (actor.items.get(link) || equipment.find(i => i.name === link)) : null;
    const parentId = eArrays[item._id] ? item._id : (parent ? parent._id : null);

    if (parentId && eArrayMetadata[parentId]) {
      const meta = eArrayMetadata[parentId];
      target = (item._id === meta.bearer) ? meta.max : 1;
    }
    item.system.derivedCout = target;
    totalEquipmentEP += target;
  });

  // Add the costs of powers marked as EP
  powers.forEach(p => {
    const flags = p.flags['mnm-3e-expanded'] || {};
    if (flags.costAsEP && flags.parentEquipmentId) {
      totalEquipmentEP += calculatePowerCost(p);
    }
  });

  // 4. Update top-level pools
  if (actor.system?.pp) {
    actor.system.pp.pouvoirs = totalPowerPP;
    const pp = actor.system.pp;
    const newUsed = (pp.caracteristiques || 0) + totalPowerPP + (pp.talents || 0) + (pp.competences || 0) + (pp.defenses || 0) + (pp.divers || 0);
    actor.system.pp.used = newUsed;
  }
  if (actor.system?.ptsEquipements) {
    actor.system.ptsEquipements.use = totalEquipmentEP;
  }
}

// HIJACK: Inject our logic into the Actor's calculation process
Hooks.once('init', () => {
  const originalPrepareDerivedData = CONFIG.Actor.documentClass.prototype.prepareDerivedData;
  CONFIG.Actor.documentClass.prototype.prepareDerivedData = function() {
    originalPrepareDerivedData.call(this);
    applyExpandedLogic(this);
  };
});

// UI Injection for Equipment Cards
Hooks.on('renderItemSheet', (app, html, data) => {
  const item = app.item;
  if (item.type !== 'equipement') return;

  // Create the "Linked Powers" section
  const actor = item.actor;
  if (!actor) return;

  const linkedPowers = actor.items.filter(i => 
    i.type === 'pouvoir' && i.flags['mnm-3e-expanded']?.parentEquipmentId === item._id
  );

  let powersHtml = `
    <div class="mnm-expanded-powers-section">
      <h3>Powers on Equipment</h3>
      <div class="power-drop-zone" style="border: 2px dashed #ccc; padding: 10px; margin-bottom: 10px; text-align: center;">
        Drop Powers Here to add to Equipment
      </div>
      <ul class="linked-powers-list" style="list-style: none; padding: 0;">
        ${linkedPowers.map(p => `
          <li style="display: flex; justify-content: space-between; padding: 5px; border-bottom: 1px solid #eee;">
            <span>${p.name} (${calculatePowerCost(p)} EP)</span>
            <a class="remove-power" data-power-id="${p._id}"><i class="fas fa-trash"></i></a>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  html.find('.sheet-body').prepend(powersHtml);

  // Handle Drag & Drop
  html.find('.power-drop-zone').on('drop', async (ev) => {
    const dragData = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
    if (dragData.type !== 'Item') return;
    const power = actor.items.get(dragData.uuid.split('.').pop());
    if (!power || power.type !== 'pouvoir') return;

    await power.update({
      'flags.mnm-3e-expanded.costAsEP': true,
      'flags.mnm-3e-expanded.parentEquipmentId': item._id
    });
    ui.notifications.info(`Linked ${power.name} to ${item.name}`);
  });

  // Handle Removal
  html.find('.remove-power').on('click', async (ev) => {
    const pId = ev.currentTarget.dataset.powerId;
    const power = actor.items.get(pId);
    if (power) {
      await power.update({
        'flags.mnm-3e-expanded.costAsEP': false,
        'flags.mnm-3e-expanded.parentEquipmentId': null
      });
    }
  });
});

// Drag and Drop Logic for Powers on Actor Sheet
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
  }
});
