/**
 * DMN-tabellvalidering (JavaScript-versjon for runtime-bruk).
 *
 * Validerer struktur, betingelser, duplikater og påkrevde felt.
 * Kalles ved import, lasting og tabellendring.
 */

/**
 * Valider strukturen til én DMN-tabell.
 * @param {unknown} table
 * @returns {{ tableId: string, field: string, message: string, severity: 'error' | 'warning' }[]}
 */
export function validateDMNTable(table) {
  const errors = [];
  if (!table || typeof table !== 'object') {
    return [{ tableId: 'unknown', field: 'root', message: 'Tabell er ikke et objekt', severity: 'error' }];
  }

  const id = typeof table.id === 'string' ? table.id : 'unknown';

  // Påkrevde felt
  if (!table.id || typeof table.id !== 'string') {
    errors.push({ tableId: id, field: 'id', message: 'Mangler id (string)', severity: 'error' });
  }
  if (!table.name || typeof table.name !== 'string') {
    errors.push({ tableId: id, field: 'name', message: 'Mangler name (string)', severity: 'error' });
  }
  if (!['FIRST', 'PRIORITY', 'COLLECT', 'RULE ORDER'].includes(table.hitPolicy)) {
    errors.push({ tableId: id, field: 'hitPolicy', message: `Ugyldig hitPolicy: ${table.hitPolicy}. Må være FIRST, PRIORITY, COLLECT eller RULE ORDER`, severity: 'error' });
  }

  // Regler
  if (!Array.isArray(table.rules)) {
    errors.push({ tableId: id, field: 'rules', message: 'rules må være en array', severity: 'error' });
  } else {
    const ruleIds = new Set();
    for (let i = 0; i < table.rules.length; i++) {
      const rule = table.rules[i];
      if (!rule || typeof rule !== 'object') {
        errors.push({ tableId: id, field: `rules[${i}]`, message: 'Regel er ikke et objekt', severity: 'error' });
        continue;
      }
      if (!rule.id || typeof rule.id !== 'string') {
        errors.push({ tableId: id, field: `rules[${i}].id`, message: 'Regel mangler id', severity: 'error' });
      } else {
        if (ruleIds.has(rule.id)) {
          errors.push({ tableId: id, field: `rules[${i}].id`, message: `Duplikat regel-id: ${rule.id}`, severity: 'error' });
        }
        ruleIds.add(rule.id);
      }
      if (!rule.conditions || typeof rule.conditions !== 'object' || Array.isArray(rule.conditions)) {
        errors.push({ tableId: id, field: `rules[${i}].conditions`, message: 'Regel mangler conditions (objekt)', severity: 'error' });
      } else {
        // Valider betingelsesverdier
        for (const [key, val] of Object.entries(rule.conditions)) {
          errors.push(...validateConditionValue(val, id, `rules[${i}].conditions.${key}`));
        }
      }
      if (!rule.outputs || typeof rule.outputs !== 'object' || Array.isArray(rule.outputs)) {
        errors.push({ tableId: id, field: `rules[${i}].outputs`, message: 'Regel mangler outputs (objekt)', severity: 'error' });
      }

      // PRIORITY-tabeller bør ha prioritet
      if (table.hitPolicy === 'PRIORITY' && (rule.priority == null || typeof rule.priority !== 'number')) {
        errors.push({ tableId: id, field: `rules[${i}].priority`, message: `Regel ${rule.id} mangler priority (tall) i PRIORITY-tabell`, severity: 'warning' });
      }
    }
  }

  return errors;
}

function validateConditionValue(val, tableId, path) {
  if (val === null || val === undefined) return [];
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return [];
  if (Array.isArray(val)) {
    const errors = [];
    for (let i = 0; i < val.length; i++) {
      errors.push(...validateConditionValue(val[i], tableId, `${path}[${i}]`));
    }
    return errors;
  }
  if (typeof val === 'object') {
    const validKeys = new Set(['not', 'gte', 'gt', 'lte', 'lt']);
    for (const key of Object.keys(val)) {
      if (!validKeys.has(key)) {
        return [{ tableId, field: path, message: `Ukjent condition-operator: ${key}. Gyldige: not, gte, gt, lte, lt`, severity: 'error' }];
      }
    }
    if ('not' in val) {
      return validateConditionValue(val.not, tableId, `${path}.not`);
    }
    for (const key of ['gte', 'gt', 'lte', 'lt']) {
      if (key in val && typeof val[key] !== 'number') {
        return [{ tableId, field: `${path}.${key}`, message: `${key} må være et tall, fikk ${typeof val[key]}`, severity: 'error' }];
      }
    }
    return [];
  }
  return [{ tableId, field: path, message: `Ugyldig condition-type: ${typeof val}`, severity: 'error' }];
}

/**
 * Valider alle tabeller i en samling.
 */
export function validateAllTables(tables) {
  const allErrors = [];
  for (const [id, table] of Object.entries(tables)) {
    allErrors.push(...validateDMNTable(table));
  }
  return {
    valid: allErrors.filter((e) => e.severity === 'error').length === 0,
    errors: allErrors,
  };
}
