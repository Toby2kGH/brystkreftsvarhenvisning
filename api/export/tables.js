import { ALL_DECISION_TABLES } from '../../src/dmn/decisionTables.js';

export default function handler(_req, res) {
  res.json({
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    tables: ALL_DECISION_TABLES,
  });
}
