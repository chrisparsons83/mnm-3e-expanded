const API = '/api';

const state = {
  pack: null,
  entries: [],
  selected: null,
};

// DOM refs
const packList = document.getElementById('pack-list');
const searchInput = document.getElementById('search');
const btnNew = document.getElementById('btn-new');
const entryList = document.getElementById('entry-list');
const listEmpty = document.getElementById('list-empty');
const editPlaceholder = document.getElementById('edit-placeholder');
const editForm = document.getElementById('edit-form');
const editTitle = document.getElementById('edit-title');

// Metadata
const fName = document.getElementById('f-name');
const fType = document.getElementById('f-type');
const fImg = document.getElementById('f-img');

// System Core
const fSysType = document.getElementById('f-sys-type');
const fRang = document.getElementById('f-rang');
const fEditCheck = document.getElementById('f-edit');

// Power Specifics
const fPRank = document.getElementById('f-p-rank');
const fPCost = document.getElementById('f-p-cost');
const fPSpecial = document.getElementById('f-p-special');
const fPAction = document.getElementById('f-p-action');
const fPRange = document.getElementById('f-p-range');
const fPDuration = document.getElementById('f-p-duration');
const fPMechanics = document.getElementById('f-p-mechanics');
const fPEffetsPrincipaux = document.getElementById('f-p-effets-principaux');

// Equipment Specifics
const fECost = document.getElementById('f-e-cost');
const fEProtection = document.getElementById('f-e-protection');
const fEGroup = document.getElementById('f-e-group');

// Modifier Specifics
const fCoutFixe = document.getElementById('f-cout-fixe');
const fCoutRang = document.getElementById('f-cout-rang');
const fCoutValue = document.getElementById('f-cout-value');

const btnSave = document.getElementById('btn-save');
const btnDelete = document.getElementById('btn-delete');
const saveStatus = document.getElementById('save-status');

// Quill WYSIWYG
const quill = new Quill('#f-description', {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  },
});

async function loadPacks() {
  try {
    const res = await fetch(`${API}/packs`);
    const { packs } = await res.json();
    packList.innerHTML = '';
    for (const pack of packs) {
      const btn = document.createElement('button');
      btn.className = 'pack-btn';
      btn.textContent = pack.charAt(0).toUpperCase() + pack.slice(1);
      btn.dataset.pack = pack;
      btn.addEventListener('click', () => selectPack(pack));
      packList.appendChild(btn);
    }
  } catch (e) {
    console.error('Connection failed');
  }
}

async function selectPack(pack) {
  state.pack = pack;
  state.selected = null;

  document.querySelectorAll('.pack-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pack === pack);
  });

  editForm.style.display = 'none';
  editPlaceholder.style.display = '';

  const isPower = pack === 'powers';
  const isEq = ['equipment', 'vehicles', 'headquarters'].includes(pack);
  const isModifier = ['extras', 'flaws'].includes(pack);
  const isAdv = pack === 'advantages';

  document.querySelectorAll('.power-only').forEach(el => el.style.display = isPower ? '' : 'none');
  document.querySelectorAll('.eq-only').forEach(el => el.style.display = isEq ? '' : 'none');
  document.querySelectorAll('.modifier-only').forEach(el => el.style.display = isModifier ? '' : 'none');
  document.querySelectorAll('.json-only').forEach(el => el.style.display = (isAdv || isModifier) ? '' : 'none');

  document.getElementById('desc-label').textContent = isAdv ? 'Notes' : 'Description';

  try {
    const res = await fetch(`${API}/packs/${pack}`);
    state.entries = await res.json();
  } catch (err) {
    state.entries = [];
  }

  searchInput.value = '';
  renderList();
}

function renderList() {
  const query = searchInput.value.toLowerCase();
  const filtered = state.entries.filter(e =>
    (e.name || '').toLowerCase().includes(query)
  );

  entryList.innerHTML = '';

  if (filtered.length === 0) {
    listEmpty.style.display = '';
    listEmpty.textContent = state.pack ? 'No entries found' : 'Select a pack';
    return;
  }

  listEmpty.style.display = 'none';

  for (const entry of filtered) {
    const li = document.createElement('li');
    li.textContent = entry.name;
    li.dataset.id = entry._id;
    if (state.selected && state.selected._id === entry._id) li.classList.add('selected');
    li.addEventListener('click', () => selectEntry(entry));
    entryList.appendChild(li);
  }
}

function selectEntry(entry) {
  state.selected = entry;
  document.querySelectorAll('#entry-list li').forEach(li => {
    li.classList.toggle('selected', li.dataset.id === entry._id);
  });

  const sys = entry.system || {};
  const cout = sys.cout || {};

  editTitle.textContent = entry.name;
  fName.value = entry.name || '';
  fType.value = entry.type || '';
  fImg.value = entry.img || '';

  fSysType.value = sys.type || '';
  fRang.value = sys.rang || (typeof sys.rang === 'number' ? sys.rang : '');
  fEditCheck.checked = !!sys.edit;

  // Power mapping
  fPRank.value = cout.rang || '';
  fPCost.value = cout.parrang || '';
  fPSpecial.value = sys.special || '';
  fPAction.value = sys.action || '';
  fPRange.value = sys.portee || '';
  fPDuration.value = sys.duree || '';
  fPMechanics.value = sys.effets || '';
  fPEffetsPrincipaux.value = sys.effetsprincipaux || '';
  
  // Equipment mapping
  fECost.value = typeof sys.cout === 'number' ? sys.cout : (cout.total || '');
  fEProtection.value = sys.protection || '';
  fEGroup.value = entry.flags?.['mnm-3e-expanded']?.link || '';

  // Modifier mapping
  fCoutFixe.checked = !!cout.fixe;
  fCoutRang.checked = !!cout.rang;
  fCoutValue.value = cout.value || 0;

  quill.clipboard.dangerouslyPasteHTML((state.pack === 'advantages' ? sys.notes : sys.description) || '');

  editForm.style.display = '';
  editPlaceholder.style.display = 'none';
}

async function saveEntry() {
  if (!state.selected || !state.pack) return;

  const updated = JSON.parse(JSON.stringify(state.selected));
  updated.name = fName.value.trim();
  updated.type = fType.value.trim();
  updated.img = fImg.value.trim();

  if (!updated.system) updated.system = {};
  const sys = updated.system;

  sys.type = fSysType.value.trim();

  if (state.pack === 'powers') {
    if (!sys.cout) sys.cout = {};
    sys.special = fPSpecial.value.trim();
    sys.action = fPAction.value.trim();
    sys.portee = fPRange.value.trim();
    sys.duree = fPDuration.value.trim();
    sys.effets = fPMechanics.value.trim();
    sys.effetsprincipaux = fPEffetsPrincipaux.value.trim();
    sys.cout.rang = parseInt(fPRank.value) || 1;
    sys.cout.parrang = parseInt(fPCost.value) || 1;
    sys.description = quill.root.innerHTML;
  } else if (['extras', 'flaws'].includes(state.pack)) {
    sys.rang = parseInt(fRang.value) || 1;
    sys.edit = fEditCheck.checked;
    sys.cout = {
      fixe: fCoutFixe.checked,
      rang: fCoutRang.checked,
      value: parseInt(fCoutValue.value) || 0
    };
    sys.description = quill.root.innerHTML;
  } else if (state.pack === 'advantages') {
    sys.notes = quill.root.innerHTML;
    sys.description = quill.root.innerHTML;
    sys.rang = parseInt(fRang.value) || 1;
  } else {
    // Equipment, Vehicles, Headquarters
    sys.cout = parseInt(fECost.value) || 0;
    sys.protection = parseInt(fEProtection.value) || 0;
    sys.description = quill.root.innerHTML;
    if (!updated.flags) updated.flags = {};
    if (!updated.flags['mnm-3e-expanded']) updated.flags['mnm-3e-expanded'] = {};
    updated.flags['mnm-3e-expanded'].link = fEGroup.value.trim();
  }

  try {
    const res = await fetch(`${API}/packs/${state.pack}/${state.selected._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) throw new Error(await res.text());
    
    const saved = await res.json();
    const idx = state.entries.findIndex(e => e._id === saved._id);
    if (idx !== -1) state.entries[idx] = saved;
    renderList();
    saveStatus.classList.add('visible');
    setTimeout(() => saveStatus.classList.remove('visible'), 2000);
  } catch (err) {
    alert('Save failed: ' + err.message);
  }
}

async function newEntry() {
  if (!state.pack) return;
  const payload = {
    name: 'New Entry',
    type: state.pack === 'powers' ? 'pouvoir' : (state.pack === 'advantages' ? 'talent' : 'equipement'),
    system: { 
      type: '',
      description: '', 
      cout: state.pack === 'powers' ? { rang: 1, parrang: 1 } : 1 
    },
    flags: {}
  };

  try {
    const res = await fetch(`${API}/packs/${state.pack}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const entry = await res.json();
    state.entries.push(entry);
    renderList();
    selectEntry(entry);
  } catch (err) {
    alert('Failed to create entry');
  }
}

async function deleteEntry() {
  if (!state.selected || !state.pack) return;
  if (!confirm(`Delete "${state.selected.name}"?`)) return;
  try {
    const res = await fetch(`${API}/packs/${state.pack}/${state.selected._id}`, { method: 'DELETE' });
    if (res.ok) {
      state.entries = state.entries.filter(e => e._id !== state.selected._id);
      state.selected = null;
      editForm.style.display = 'none';
      editPlaceholder.style.display = '';
      renderList();
    }
  } catch (err) {
    alert('Delete failed');
  }
}

searchInput.addEventListener('input', renderList);
btnNew.addEventListener('click', newEntry);
btnSave.addEventListener('click', saveEntry);
btnDelete.addEventListener('click', deleteEntry);
loadPacks();
