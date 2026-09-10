export default function handler(_req, res) {
  res.json({ hasModifications: false, totalModifiedTables: 0, modifiedTables: [] });
}
