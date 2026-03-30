const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(express.json());

const PACKS_DIR = path.join(__dirname, '../mnm-3e-expanded/packs');
const SCRIPTS_DIR = path.join(__dirname, '../scripts');
const PACKS = ['extras', 'flaws', 'advantages'];

const readPack = async (pack) => {
  const content = await fs.readFile(path.join(SCRIPTS_DIR, `${pack}.json`), 'utf8');
  return JSON.parse(content);
};

const writePack = async (pack, items) => {
  await fs.writeFile(path.join(SCRIPTS_DIR, `${pack}.json`), JSON.stringify(items, null, 2));
  await fs.writeFile(path.join(PACKS_DIR, `${pack}.db`), items.map(i => JSON.stringify(i)).join('\n') + '\n');
};

const newId = () => Math.random().toString(36).slice(2, 13);

app.get('/api/packs', (req, res) => {
  res.json({ packs: PACKS });
});

app.get('/api/packs/:pack', async (req, res) => {
  const { pack } = req.params;
  if (!PACKS.includes(pack)) return res.status(400).json({ error: 'Unknown pack' });
  try {
    const items = await readPack(pack);
    items.sort((a, b) => a.name.localeCompare(b.name));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/packs/:pack/:id', async (req, res) => {
  const { pack, id } = req.params;
  if (!PACKS.includes(pack)) return res.status(400).json({ error: 'Unknown pack' });
  try {
    const items = await readPack(pack);
    const idx = items.findIndex(i => i._id === id);
    if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
    items[idx] = req.body;
    await writePack(pack, items);
    res.json(items[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packs/:pack', async (req, res) => {
  const { pack } = req.params;
  if (!PACKS.includes(pack)) return res.status(400).json({ error: 'Unknown pack' });
  try {
    const items = await readPack(pack);
    const entry = { _id: newId(), ...req.body };
    if (!entry._id) entry._id = newId();
    items.push(entry);
    await writePack(pack, items);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/packs/:pack/:id', async (req, res) => {
  const { pack, id } = req.params;
  if (!PACKS.includes(pack)) return res.status(400).json({ error: 'Unknown pack' });
  try {
    const items = await readPack(pack);
    const filtered = items.filter(i => i._id !== id);
    if (filtered.length === items.length) return res.status(404).json({ error: 'Entry not found' });
    await writePack(pack, filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Editor running at http://localhost:${PORT}`));
