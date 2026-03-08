import { describe, it, expect } from 'vitest';
import {
  buildPatientBundle,
  buildPrimaryCancerCondition,
  buildTumorMarkerTests,
  buildECOGStatus,
  BREAST_CANCER_CODES,
} from '../src/fhir/mCodeProfiles.js';

describe('mCODE FHIR Profiles', () => {
  describe('buildPrimaryCancerCondition', () => {
    it('should create a valid Condition resource', () => {
      const condition = buildPrimaryCancerCondition('patient-1', {
        stage: 'IV',
        erStatus: true,
        metastatic: true,
      });

      expect(condition.resourceType).toBe('Condition');
      expect(condition.subject.reference).toBe('Patient/patient-1');
      expect(condition.code.coding[0].code).toBe('C50');
    });

    it('should include metastatic extension', () => {
      const condition = buildPrimaryCancerCondition('p1', { metastatic: true });
      const ext = condition.extension[0];
      expect(ext.valueCodeableConcept.coding[0].code).toBe('14799000');
    });
  });

  describe('buildTumorMarkerTests', () => {
    it('should create observations for all markers', () => {
      const obs = buildTumorMarkerTests('p1', {
        erStatus: true,
        prStatus: true,
        her2Status: false,
        ki67: 25,
      });

      expect(obs).toHaveLength(4);
      expect(obs.every((o) => o.resourceType === 'Observation')).toBe(true);
    });

    it('should handle partial data', () => {
      const obs = buildTumorMarkerTests('p1', { erStatus: true });
      expect(obs).toHaveLength(1);
    });

    it('should set Ki-67 as quantity', () => {
      const obs = buildTumorMarkerTests('p1', { ki67: 30 });
      expect(obs[0].valueQuantity.value).toBe(30);
      expect(obs[0].valueQuantity.unit).toBe('%');
    });
  });

  describe('buildECOGStatus', () => {
    it('should create ECOG observation', () => {
      const ecog = buildECOGStatus('p1', 1);
      expect(ecog.resourceType).toBe('Observation');
      expect(ecog.valueInteger).toBe(1);
      expect(ecog.code.coding[0].code).toBe('89247-1');
    });
  });

  describe('buildPatientBundle', () => {
    it('should create a complete FHIR Bundle', () => {
      const bundle = buildPatientBundle({
        patientId: 'test-1',
        name: 'Test Pasient',
        birthDate: '1960-01-01',
        gender: 'female',
        erStatus: true,
        prStatus: true,
        her2Status: false,
        ki67: 20,
        ecogScore: 1,
        metastatic: true,
        menopausalStatus: 'post',
      });

      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('collection');
      // Patient + Condition + 4 tumor markers + ECOG = 7
      expect(bundle.entry.length).toBe(7);
      expect(bundle._clinicalContext.menopausalStatus).toBe('post');
    });

    it('should include clinical context for DMN input', () => {
      const bundle = buildPatientBundle({
        patientId: 'test-2',
        erStatus: true,
        her2Status: false,
        cardiacRisk: 'high',
        needMonotherapy: true,
      });

      expect(bundle._clinicalContext.cardiacRisk).toBe('high');
      expect(bundle._clinicalContext.needMonotherapy).toBe(true);
    });
  });
});
