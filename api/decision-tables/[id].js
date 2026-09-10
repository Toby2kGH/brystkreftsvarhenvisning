import { ALL_DECISION_TABLES } from '../../src/dmn/decisionTables.js';

export default function handler(req, res) {
  const { id } = req.query;
  const table = ALL_DECISION_TABLES[id];
  if (!table) return res.status(404).json({ error: 'Beslutningstabel ikke funnet' });
  res.json(table);
}
