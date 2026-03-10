/**
 * DMN JSON-skjema — Validerer beslutningstabeller ved lasting.
 *
 * Sikrer at alle tabeller har korrekt struktur før de brukes
 * til kliniske beslutninger. Dette er et kjøretids-sikkerhetsnett.
 */

/** @type {import('../types/clinical').DMNTable} */

export interface ValidationError {
  tableId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Valider strukturen til én DMN-tabell.
 * Returnerer en array med valideringsfeil (tom = gyldig).
 */
export function validateDMNTable(table: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!table || typeof table !== 'object') {
    return [{ tableId: 'unknown', field: 'root', message: 'Tabell er ikke et objekt', severity: 'error' }];
  }

  const t = table as Record<string, unknown>;
  const id = typeof t.id === 'string' ? t.id : 'unknown';

  // Påkrevde felt
  if (!t.id || typeof t.id !== 'string') {
    errors.push({ tableId: id, field: 'id', message: 'Mangler id (string)', severity: 'error' });
  }
  if (!t.name || typeof t.name !== 'string') {
    errors.push({ tableId: id, field: 'name', message: 'Mangler name (string)', severity: 'error' });
  }
  if (!['FIRST', 'PRIORITY', 'COLLECT', 'RULE ORDER'].includes(t.hitPolicy as string)) {
    errors.push({ tableId: id, field: 'hitPolicy', message: `Ugyldig hitPolicy: ${t.hitPolicy}. Må være FIRST, PRIORITY, COLLECT eller RULE ORDER`, severity: 'error' });
  }

  // Regler
  if (!Array.isArray(t.rules)) {
    errors.push({ tableId: id, field: 'rules', message: 'rules må være en array', severity: 'error' });
  } else {
    const ruleIds = new Set<string>();
    for (let i = 0; i < t.rules.length; i++) {
      const rule = t.rules[i] as Record<string, unknown>;
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
      }
      if (!rule.outputs || typeof rule.outputs !== 'object' || Array.isArray(rule.outputs)) {
        errors.push({ tableId: id, field: `rules[${i}].outputs`, message: 'Regel mangler outputs (objekt)', severity: 'error' });
      }

      // Valider betingelsesverdier
      if (rule.conditions && typeof rule.conditions === 'object') {
        for (const [key, val] of Object.entries(rule.conditions as Record<string, unknown>)) {
          const condErrors = validateConditionValue(val, id, `rules[${i}].conditions.${key}`);
          errors.push(...condErrors);
        }
      }

      // PRIORITY-tabeller bør ha prioritet
      if (t.hitPolicy === 'PRIORITY' && (rule.priority == null || typeof rule.priority !== 'number')) {
        errors.push({ tableId: id, field: `rules[${i}].priority`, message: `Regel ${rule.id} mangler priority (tall) i PRIORITY-tabell`, severity: 'warning' });
      }
    }
  }

  // Inputs & outputs (valgfritt men anbefalt)
  if (!Array.isArray(t.inputs)) {
    errors.push({ tableId: id, field: 'inputs', message: 'Mangler inputs array', severity: 'warning' });
  }
  if (!Array.isArray(t.outputs)) {
    errors.push({ tableId: id, field: 'outputs', message: 'Mangler outputs array', severity: 'warning' });
  }

  return errors;
}

function validateConditionValue(val: unknown, tableId: string, path: string): ValidationError[] {
  if (val === null || val === undefined) return [];
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return [];
  if (Array.isArray(val)) {
    const errors: ValidationError[] = [];
    for (let i = 0; i < val.length; i++) {
      errors.push(...validateConditionValue(val[i], tableId, `${path}[${i}]`));
    }
    return errors;
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const validKeys = new Set(['not', 'gte', 'gt', 'lte', 'lt']);
    for (const key of Object.keys(obj)) {
      if (!validKeys.has(key)) {
        return [{ tableId, field: path, message: `Ukjent condition-operator: ${key}. Gyldige: not, gte, gt, lte, lt`, severity: 'error' }];
      }
    }
    if ('not' in obj) {
      return validateConditionValue(obj.not, tableId, `${path}.not`);
    }
    for (const key of ['gte', 'gt', 'lte', 'lt']) {
      if (key in obj && typeof obj[key] !== 'number') {
        return [{ tableId, field: `${path}.${key}`, message: `${key} må være et tall, fikk ${typeof obj[key]}`, severity: 'error' }];
      }
    }
    return [];
  }
  return [{ tableId, field: path, message: `Ugyldig condition-type: ${typeof val}`, severity: 'error' }];
}

/**
 * Valider alle tabeller i en samling.
 */
export function validateAllTables(tables: Record<string, unknown>): { valid: boolean; errors: ValidationError[] } {
  const allErrors: ValidationError[] = [];
  for (const [id, table] of Object.entries(tables)) {
    const errors = validateDMNTable(table);
    allErrors.push(...errors);
  }
  return {
    valid: allErrors.filter((e) => e.severity === 'error').length === 0,
    errors: allErrors,
  };
}
