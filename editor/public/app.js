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
const fName = document.getElementById('f-name');
const fType = document.getElementById('f-type');
const fImg = document.getElementById('f-img');
const fSysType = document.getElementById('f-sys-type');
const fRang = document.getElementById('f-rang');
const fEditCheck = document.getElementById('f-edit');
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
}

function isAdvantagesPack() {
  return state.pack === 'advantages';
}

async function selectPack(pack) {
  state.pack = pack;
  state.selected = null;

  document.querySelectorAll('.pack-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pack === pack);
  });

  editForm.style.display = 'none';
  editPlaceholder.style.display = '';

  // Toggle modifier-only fields
  const isAdv = pack === 'advantages';
  document.querySelectorAll('.modifier-only').forEach(el => {
    el.style.display = isAdv ? 'none' : '';
  });
  document.getElementById('desc-label').textContent = isAdv ? 'Notes' : 'Description';

  try {
    const res = await fetch(`${API}/packs/${pack}`);
    state.entries = await res.json();
  } catch (err) {
    state.entries = [];
    console.error('Failed to load pack:', err);
  }

  searchInput.value = '';
  renderList();
}

function renderList() {
  const query = searchInput.value.toLowerCase();
  const filtered = state.entries.filter(e =>
    e.name.toLowerCase().includes(query)
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
    if (state.selected && state.selected._id === entry._id) {
      li.classList.add('selected');
    }
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
  fRang.value = sys.rang ?? 1;
  fEditCheck.checked = !!sys.edit;
  fCoutFixe.checked = !!cout.fixe;
  fCoutRang.checked = !!cout.rang;
  fCoutValue.value = cout.value ?? 1;

  quill.clipboard.dangerouslyPasteHTML((isAdvantagesPack() ? sys.notes : sys.description) || '');

  editForm.style.display = '';
  editPlaceholder.style.display = 'none';
}

async function saveEntry() {
  if (!state.selected || !state.pack) return;

  let system;
  if (isAdvantagesPack()) {
    system = {
      notes: quill.root.innerHTML,
      rang: parseInt(fRang.value, 10) || 0,
    };
  } else {
    system = {
      type: fSysType.value.trim(),
      description: quill.root.innerHTML,
      rang: parseInt(fRang.value, 10) || 0,
      edit: fEditCheck.checked,
      cout: {
        fixe: fCoutFixe.checked,
        rang: fCoutRang.checked,
        value: parseInt(fCoutValue.value, 10) || 0,
      },
    };
  }

  const updated = {
    ...state.selected,
    name: fName.value.trim(),
    type: fType.value.trim(),
    img: fImg.value.trim(),
    system,
  };

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
    state.selected = saved;

    state.entries.sort((a, b) => a.name.localeCompare(b.name));

    editTitle.textContent = saved.name;
    renderList();

    saveStatus.classList.add('visible');
    setTimeout(() => saveStatus.classList.remove('visible'), 2000);
  } catch (err) {
    alert('Save failed: ' + err.message);
  }
}

async function newEntry() {
  if (!state.pack) return;

  let defaults;
  if (isAdvantagesPack()) {
    defaults = {
      name: 'New Advantage',
      type: 'talent',
      img: 'systems/mutants-and-masterminds-3e/assets/icons/talent.svg',
      system: { notes: '', rang: 1 },
      effects: [],
      flags: {},
    };
  } else {
    defaults = {
      name: 'New Entry',
      type: 'modificateur',
      img: 'systems/mutants-and-masterminds-3e/assets/icons/pouvoir.svg',
      system: {
        type: state.pack === 'extras' ? 'extra' : 'defaut',
        description: '',
        rang: 1,
        edit: true,
        cout: { fixe: false, rang: true, value: 1 },
      },
    };
  }

  try {
    const res = await fetch(`${API}/packs/${state.pack}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaults),
    });
    if (!res.ok) throw new Error(await res.text());
    const entry = await res.json();
    state.entries.push(entry);
    state.entries.sort((a, b) => a.name.localeCompare(b.name));
    renderList();
    selectEntry(entry);
  } catch (err) {
    alert('Failed to create entry: ' + err.message);
  }
}

async function deleteEntry() {
  if (!state.selected || !state.pack) return;
  if (!confirm(`Delete "${state.selected.name}"?`)) return;

  try {
    const res = await fetch(`${API}/packs/${state.pack}/${state.selected._id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());

    state.entries = state.entries.filter(e => e._id !== state.selected._id);
    state.selected = null;

    editForm.style.display = 'none';
    editPlaceholder.style.display = '';

    renderList();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

// Event listeners
searchInput.addEventListener('input', renderList);
btnNew.addEventListener('click', newEntry);
btnSave.addEventListener('click', saveEntry);
btnDelete.addEventListener('click', deleteEntry);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveEntry();
  }
});

// Init
loadPacks();
