import { ALL_DECISION_TABLES } from '../../src/dmn/decisionTables.js';

export default function handler(_req, res) {
  res.json(Object.values(ALL_DECISION_TABLES));
}
