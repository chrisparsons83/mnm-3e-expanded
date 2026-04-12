console.log('%c M&M 3E EXPANDED | SYSTEM HIJACK ACTIVE (V3.4.36) ', 'background: #800080; color: #fff; font-weight: bold;');

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

  const allItems = actor.items;
  const powers = allItems.filter(i => i.type === 'pouvoir');
  const equipment = allItems.filter(i => i.type === 'equipement');

  // --- 1. IDENTIFY POWER GROUPS (Arrays) ---
  const ppArrays = {};
  const epArrays = {};
  const ppPowers = [];
  const epPowers = [];

  powers.forEach(p => {
    const costAsEP = p.getFlag('mnm-3e-expanded', 'costAsEP');
    const link = p.system.link;
    const parent = link ? (actor.items.get(link) || actor.items.find(i => i.name === link)) : null;
    const parentEqId = (costAsEP && p.getFlag('mnm-3e-expanded', 'parentEquipmentId')) || (parent && parent.type === 'equipement' ? parent.id : null);

    if (parentEqId) {
      if (!epArrays[parentEqId]) epArrays[parentEqId] = [];
      epArrays[parentEqId].push(p);
      epPowers.push(p);
    } else {
      const parentPowerId = (parent && parent.type === 'pouvoir') ? parent.id : null;
      if (parentPowerId) {
        if (!ppArrays[parentPowerId]) ppArrays[parentPowerId] = [parentPowerId];
        if (!ppArrays[parentPowerId].includes(p.id)) ppArrays[parentPowerId].push(p.id);
      }
      ppPowers.push(p);
    }
  });

  powers.forEach(p => {
    if (!epPowers.includes(p) && ppArrays[p.id] && !ppArrays[p.id].includes(p.id)) {
      ppArrays[p.id].push(p.id);
    }
  });

  // --- 2. CALCULATE POWER COSTS ---
  let totalPowerPP = 0;
  let totalEquipmentEP = 0;

  const processArray = (itemIdsOrDocs, isEP) => {
    let maxCost = 0;
    let bearerId = null;
    const docs = itemIdsOrDocs.map(idOrDoc => (typeof idOrDoc === 'string') ? actor.items.get(idOrDoc) : idOrDoc).filter(d => !!d);
    
    docs.forEach(d => {
      const full = calculatePowerCost(d);
      if (full > maxCost) { maxCost = full; bearerId = d.id; }
    });
    if (!bearerId && docs.length > 0) bearerId = docs[0].id;

    let arraySum = 0;
    docs.forEach(d => {
      const isBearer = d.id === bearerId;
      const target = isBearer ? maxCost : 1;
      
      d.system.cout.total = target;
      d.system.cout.totalTheorique = calculatePowerCost(d);
      if (!isBearer) d.system.cout.parrangtotal = "1 (AE)";
      arraySum += target;
    });
    return arraySum;
  };

  const processedPpIds = new Set();
  for (const rootId in ppArrays) {
    totalPowerPP += processArray(ppArrays[rootId], false);
    ppArrays[rootId].forEach(id => processedPpIds.add(id));
  }
  ppPowers.forEach(p => {
    if (!processedPpIds.has(p.id)) {
      const full = calculatePowerCost(p);
      p.system.cout.total = full;
      p.system.cout.totalTheorique = full;
      totalPowerPP += full;
    }
  });

  // Create a map to store EP contributions from powers per equipment
  const powerContributions = {};
  for (const eqId in epArrays) {
    const sum = processArray(epArrays[eqId], true);
    powerContributions[eqId] = sum;
  }

  // --- 3. EQUIPMENT COST LOGIC ---
  const equipmentArrays = {};
  equipment.forEach(e => {
    const link = e.getFlag('mnm-3e-expanded', 'link');
    const parent = link ? (actor.items.get(link) || equipment.find(i => i.name === link)) : null;
    if (parent && parent.type === 'equipement') {
      if (!equipmentArrays[parent.id]) equipmentArrays[parent.id] = [parent.id];
      if (!equipmentArrays[parent.id].includes(e.id)) equipmentArrays[parent.id].push(e.id);
    }
  });

  const processedEqIds = new Set();
  for (const rootId in equipmentArrays) {
    let maxC = 0;
    let bId = null;
    const docs = equipmentArrays[rootId].map(id => actor.items.get(id)).filter(d => !!d);
    docs.forEach(d => {
      const c = parseInt(d.system.cout) || 0;
      if (c > maxC) { maxC = c; bId = d.id; }
    });

    docs.forEach(d => {
      const baseCost = parseInt(d.system.cout) || 0;
      const arrayContribution = (d.id === bId) ? maxC : 1;
      const finalCout = arrayContribution + (powerContributions[d.id] || 0);
      d.system.derivedCout = finalCout;
      // Do NOT set d.system.cout — the system's #_equipment() has already locked
      // ptsEquipements.use from the stored cout value. Inflating cout here would
      // cause double-counting in renderItemSheet (totalEP = inflated_cout + arrayEP).
      totalEquipmentEP += finalCout;
      processedEqIds.add(d.id);
    });
  }

  equipment.forEach(e => {
    if (!processedEqIds.has(e.id)) {
      const baseCost = parseInt(e.system.cout) || 0;
      const finalCout = baseCost + (powerContributions[e.id] || 0);
      e.system.derivedCout = finalCout;
      // Do NOT set e.system.cout — see note above.
      totalEquipmentEP += finalCout;
    }
  });

  // --- 4. APPLY TOTALS ---
  // The system's personnage-data-model uses Object.defineProperty to lock
  // pp.pouvoirs, pp.used, ptsEquipements.use, and ptsEquipements.max as
  // non-writable/non-configurable. Direct assignment silently fails.
  // Instead we store our computed values as non-persisted actor properties
  // for renderActorSheet to pick up and display via HTML updates.
  const systemEPCost = epPowers.reduce((acc, p) => acc + (p.system.cout?.totalTheorique || 0), 0);
  actor._mnmExpandedPP = totalPowerPP;
  actor._mnmExpandedEP = totalEquipmentEP;
  actor._mnmSystemEPCost = systemEPCost;
}

// Rename Equipment Tab on Character Sheet and Update Array Labels
Hooks.on('renderActorSheet', (app, html, data) => {
  console.debug("M&M 3e Expanded | Rendering Actor Sheet:", app.actor.name); // fix 4: was console.log
  const actor = app.actor;

  // Fix EP display — the system locks ptsEquipements.use via Object.defineProperty
  // before our applyExpandedLogic runs, so it only reflects base equipment costs.
  // We stored our computed total in actor._mnmExpandedEP; update the HTML here.
  if (actor._mnmExpandedEP !== undefined) {
    const totalEP = actor._mnmExpandedEP;
    const maxEP = actor.system.ptsEquipements.max;
    const epScoreSpan = html.find('.lEquipements .score').first();
    if (epScoreSpan.length) {
      // fix 6: check the replacement actually found the pattern before committing
      const rawText = epScoreSpan.text();
      const updatedText = rawText.replace(/:\s*\d+\s*\//, `: ${totalEP} /`);
      if (updatedText !== rawText) {
        epScoreSpan.text(updatedText);
      } else {
        console.warn('M&M 3e Expanded | Could not update EP score display - unexpected format:', rawText);
      }
      epScoreSpan.toggleClass('red', totalEP > maxEP);
    }
  }

  // Fix PP display — system locks pp.pouvoirs and pp.used the same way, counting
  // all pouvoirs including those flagged costAsEP. Subtract the EP power costs.
  // fix 7: condition was `&& actor._mnmSystemEPCost` which is correct (skip when 0),
  // but removed the redundant `actor._mnmExpandedPP !== undefined` check since
  // both properties are always set together by applyExpandedLogic.
  if (actor._mnmSystemEPCost) {
    const systemEPCost = actor._mnmSystemEPCost;
    const ppDetails = html.find('.totalpp details');
    // pp.pouvoirs is the 2nd .line inside details (after caracteristiques).
    // fix 2: validate the value matches what we expect before modifying, so a
    // template reorder doesn't silently corrupt the wrong field.
    const ppPouvoirsSpan = ppDetails.find('.line').eq(1).find('.score');
    if (ppPouvoirsSpan.length && parseInt(ppPouvoirsSpan.text()) === actor.system.pp.pouvoirs) {
      ppPouvoirsSpan.text(actor.system.pp.pouvoirs - systemEPCost);
    } else if (ppPouvoirsSpan.length) {
      console.warn('M&M 3e Expanded | PP pouvoirs span did not match expected value, skipping correction');
    }
    // pp.used is in the <summary>
    const ppUsedSpan = ppDetails.find('summary .score');
    if (ppUsedSpan.length) {
      const correctedUsed = (parseInt(ppUsedSpan.text()) || 0) - systemEPCost;
      ppUsedSpan.text(correctedUsed);
      ppUsedSpan.toggleClass('red', correctedUsed > (actor.system.pp.total || 0));
    }
  }

  // 1. Rename Navigation Tab
  const eqTab = html.find('.tabs .item[data-tab="equipement"]');
  if (eqTab.length) {
    eqTab.text("Equipement & Arrays");
  }

  // 2. Rename Section Headers
  html.find('.tab[data-tab="equipement"] .items-header .item-name, .tab[data-tab="equipement"] h3, .tab[data-tab="equipement"] h4').each((i, el) => {
    if ($(el).text().trim() === "Equipement") {
      $(el).text("Equipement & Arrays");
    }
  });

  // 3. Rename Array Headers
  // fix 5: pre-compute the set of EP-array root power names once (O(n)) so the
  // DOM loop below can do O(1) lookups instead of calling actor.items.some() for
  // every matching element (previously O(n²)).
  const epArrayRootNames = new Set();
  actor.items.forEach(pwr => {
    if (pwr.type !== 'pouvoir') return;
    if (!pwr.getFlag('mnm-3e-expanded', 'parentEquipmentId')) return;
    const link = pwr.system.link;
    const linkedItem = link ? actor.items.get(link) : null;
    if (linkedItem?.type === 'pouvoir') {
      epArrayRootNames.add(linkedItem.name); // this power is an AE; root is the linked power
    } else {
      epArrayRootNames.add(pwr.name);        // this power is itself the root
    }
  });

  html.find('.item-name.item-header, .item-name, h4, h3').each((i, el) => {
    const text = $(el).text().trim();
    if (text.startsWith("Array:")) {
      const arrayName = text.replace("Array:", "").trim();
      if (epArrayRootNames.has(arrayName)) {
        $(el).html($(el).html().replace("Array:", "EQ Array:"));
      }
    }
  });

  // 4. Update individual power/equipment costs and labels
  html.find('.item').each((i, el) => {
    const itemId = $(el).data('item-id') || $(el).attr('data-item-id');
    const item = actor.items.get(itemId);
    if (!item) return;

    if (item.type === 'pouvoir') {
      const costAsEP = item.getFlag('mnm-3e-expanded', 'costAsEP');
      const link = item.system.link;
      const parent = link ? (actor.items.get(link) || actor.items.find(it => it.name === link)) : null;
      const isOnEquipment = (costAsEP && item.getFlag('mnm-3e-expanded', 'parentEquipmentId')) || (parent && parent.type === 'equipement');
      
      if (isOnEquipment) {
        // Change "Total" text anywhere in this item row to "EP Cost"
        $(el).find('*').contents().filter(function() {
          return this.nodeType === 3 && /Total:?/i.test(this.nodeValue);
        }).each(function() {
          this.nodeValue = this.nodeValue.replace(/Total/i, "EP Cost");
        });
      }
    } else if (item.type === 'equipement' && item.system.derivedCout !== undefined) {
      // Force equipment display cost
      const costBox = $(el).find('.item-detail.item-cout, .item-cout, [data-property="system.cout"]');
      if (costBox.length) {
        costBox.contents().filter(function() {
          return this.nodeType === 3 && this.nodeValue.trim() !== "";
        }).first().each(function() {
          this.nodeValue = item.system.derivedCout;
        });
      }
    }
  });
});

// HIJACK
Hooks.once('init', () => {
  const originalPrepareDerivedData = CONFIG.Actor.documentClass.prototype.prepareDerivedData;
  CONFIG.Actor.documentClass.prototype.prepareDerivedData = function() {
    originalPrepareDerivedData.call(this);
    applyExpandedLogic(this);
  };
});

// Item Sheet Refresh Hijack
Hooks.on('renderItemSheet', (app, html, data) => {
  console.debug("M&M 3e Expanded | Rendering Item Sheet:", app.item.name, "Type:", app.item.type); // fix 4: was console.log
  const item = app.item;

  if (item.type === 'pouvoir' && item.actor) {
    const costAsEP = item.getFlag('mnm-3e-expanded', 'costAsEP');
    const link = item.system.link;
    const parent = link ? (item.actor.items.get(link) || item.actor.items.find(i => i.name === link)) : null;
    const isOnEquipment = (costAsEP && item.getFlag('mnm-3e-expanded', 'parentEquipmentId')) || (parent && parent.type === 'equipement');

    if (isOnEquipment) {
      // Force UI to show total points from our logic
      const totalBox = html.find('input[name="system.cout.total"], [data-property="system.cout.total"]');
      if (totalBox.length) {
        if (totalBox.is('input')) totalBox.val(item.system.cout.total);
        else totalBox.text(item.system.cout.total);
      }

      // Aggressive Label Rename
      html.find('label, .label, .item-label').each((i, el) => {
        if (/Total:?/i.test($(el).text())) {
          $(el).text($(el).text().replace(/Total/i, "EP Cost"));
        }
      });
    }
  }

  // fix 1: the original code had two separate equipment blocks with linkedPowers
  // computed twice and actor looked up twice. The early-return guard between them
  // (if item.type !== 'equipement') meant the second block was only reachable for
  // equipment, but the first block also ran for equipment — so both ran but with
  // redundant lookups. Merged into one block with a single early-return guard.
  if (item.type !== 'equipement') return;

  const actor = item.actor;
  if (!actor) return;

  // Compute linked powers once; used for both cost display and power list below.
  const linkedPowers = actor.items.filter(i => {
    if (i.type !== 'pouvoir') return false;
    const parentFlag = i.getFlag('mnm-3e-expanded', 'parentEquipmentId');
    const link = i.system.link;
    return parentFlag === item.id || link === item.id || link === item.name;
  });

  // Inject cost breakdown when there are linked powers
  if (linkedPowers.length > 0) {
    let maxC = 0;
    linkedPowers.forEach(p => {
      const c = calculatePowerCost(p);
      if (c > maxC) maxC = c;
    });
    const arrayEP = maxC + (linkedPowers.length - 1);
    // Use the stored source value as base cost so we never double-count the
    // power array EP that applyExpandedLogic already folds into derivedCout.
    const baseCost = parseInt(item._source?.system?.cout ?? item.system.cout) || 0;
    const totalEP = baseCost + arrayEP;

    const costInput = html.find('input[name="system.cout"], [data-property="system.cout"]');
    if (costInput.length) {
      const group = costInput.closest('.form-group, .item-prop');
      group.find('label').text("Base Cost");

      if (!html.find('.mnm-injected-cost').length) {
        const arrayHtml = `
          <div class="form-group mnm-injected-cost">
            <label>Power Array EP</label>
            <span style="flex: 1; text-align: right; padding-right: 5px;">${arrayEP}</span>
          </div>
          <div class="form-group mnm-injected-cost" style="font-weight: bold; border-top: 1px solid #7a7971; padding-top: 5px;">
            <label>Total EP Cost</label>
            <span style="flex: 1; text-align: right; padding-right: 5px;">${totalEP}</span>
          </div>
        `;
        group.after(arrayHtml);
      }
    }
  }

  // Inject power list and drop zone
  const injectionPoint = html.find('.sheet-body');
  if (injectionPoint.find('.mnm-expanded-powers-section').length) return;

  const powersHtml = `
    <div class="mnm-expanded-powers-section" style="margin-top: 10px; border-top: 1px solid #7a7971; padding-top: 10px;">
      <h3 style="border: none;">Equipment Power Array</h3>
      <div class="power-drop-zone" style="border: 2px dashed #7a7971; border-radius: 5px; padding: 15px; margin-bottom: 10px; text-align: center; background: rgba(0,0,0,0.05); transition: background 0.2s;">
        <i class="fas fa-plus"></i> Drop Powers Here
      </div>
      <ul class="linked-powers-list" style="list-style: none; padding: 0; margin: 0;">
        ${linkedPowers.map(p => `
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 5px 10px; border: 1px solid #ccc; border-radius: 3px; margin-bottom: 5px; background: #eee;">
            <span style="font-weight: bold;">${p.name} <span style="font-weight: normal; font-style: italic;">(${p.system.cout.total} EP)</span></span>
            <a class="remove-power" title="Unlink Power" data-power-id="${p.id}" style="color: #800;"><i class="fas fa-trash"></i></a>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  if (injectionPoint.length) {
    injectionPoint.append(powersHtml);
  } else {
    html.append(powersHtml);
  }

  const dropZone = html.find('.power-drop-zone')[0];
  if (!dropZone) return;

  // Native Listeners for better reliability
  dropZone.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.dataTransfer.dropEffect = "link";
    ev.currentTarget.style.background = 'rgba(0,0,0,0.15)';
  });

  dropZone.addEventListener('dragleave', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.currentTarget.style.background = 'rgba(0,0,0,0.05)';
  });

  dropZone.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    ev.currentTarget.style.background = 'rgba(0,0,0,0.05)';

    try {
      const rawData = ev.dataTransfer.getData('text/plain');
      if (!rawData) return;

      const dragData = JSON.parse(rawData);

      const itemUuid = dragData.uuid;
      if (!itemUuid) {
        ui.notifications.warn("Could not identify dragged item.");
        return;
      }

      const droppedItem = await fromUuid(itemUuid);
      // fix 3: fromUuid() can return null (invalid/missing UUID)
      if (!droppedItem) {
        ui.notifications.warn("Could not find the dropped item.");
        return;
      }
      const doc = droppedItem.document ?? droppedItem;
      const validTypes = ['pouvoir', 'extra', 'defaut'];

      if (!doc || !validTypes.includes(doc.type)) {
        ui.notifications.warn("Only Powers, Extras, or Flaws can be added to Equipment.");
        return;
      }

      console.debug("M&M 3e Expanded | Linking:", doc.name, "to Equipment:", item.name, "ID:", item.id); // fix 4

      const updateData = {
        "system.link": item.id,
        "flags.mnm-3e-expanded.costAsEP": true,
        "flags.mnm-3e-expanded.parentEquipmentId": item.id
      };

      if (doc.isEmbedded && doc.actor === actor) {
        await doc.update(updateData);
      } else {
        const itemData = doc.toObject();
        itemData.system.link = item.id;
        itemData.flags = itemData.flags || {};
        itemData.flags['mnm-3e-expanded'] = {
          costAsEP: true,
          parentEquipmentId: item.id
        };
        await actor.createEmbeddedDocuments("Item", [itemData]);
      }

      ui.notifications.info(`Linked ${doc.name} to ${item.name}`);
      app.render();
    } catch (err) {
      console.error("M&M 3e Expanded | Drop Error:", err);
      ui.notifications.error("Failed to link item. See console.");
    }
  });

  html.find('.remove-power').on('click', async (ev) => {
    const pId = ev.currentTarget.dataset.powerId;
    const power = actor.items.get(pId);
    if (power) {
      await power.update({
        'system.link': null,
        'flags.mnm-3e-expanded.costAsEP': false,
        'flags.mnm-3e-expanded.parentEquipmentId': null
      });
      ui.notifications.info(`Unlinked ${power.name} from equipment.`);
      app.render();
    }
  });
});
