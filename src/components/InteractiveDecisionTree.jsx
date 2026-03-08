import React, { useState, useCallback } from 'react';
import {
  HER2_DETERMINATION_TABLE,
  CHEMO_PATHWAY_TABLE,
  CDK46_DECISION_TABLE,
  ENDOCRINE_THERAPY_TABLE,
  ZOMETA_TABLE,
  RADIATION_TABLE,
  HRPOS_HER2POS_TABLE,
  HRNEG_HER2POS_TABLE,
  TN_TABLE,
  NEOADJUVANT_TABLE,
} from '../dmn/decisionTables.js';

/**
 * Interactive Decision Tree — click through nodes to explore the clinical logic.
 *
 * Models the actual clinical decision flow as an explorable tree.
 * Each node presents a choice, and clicking navigates deeper.
 */

// ============================================================
// Tree definition — each node has a question and choices
// ============================================================

const TREE = {
  id: 'root',
  label: 'Brystkreft Beslutningstre',
  question: 'Hvilken behandlingsmodus?',
  icon: '🏥',
  children: [
    {
      id: 'neoadjuvant',
      label: 'Neoadjuvant',
      question: 'Hvilken biologisk undergruppe?',
      description: 'Behandling FØR kirurgi — for store/lokalavanserte tumorer',
      icon: '⏩',
      tableRef: 'neoadjuvant',
      children: [
        { id: 'neo-hrpos-her2neg', label: 'HR+HER2-', leaf: true, tableRef: 'neoadjuvant', ruleFilter: 'NEO1', description: 'EC ×4 → Taxan + endokrinterapi postoperativt' },
        { id: 'neo-hrpos-her2pos', label: 'HR+HER2+', leaf: true, tableRef: 'neoadjuvant', ruleFilter: 'NEO2', description: 'EC ×4 → Taxan + HP (dobbel HER2-blokade)' },
        { id: 'neo-hrneg-her2pos', label: 'HR-HER2+', leaf: true, tableRef: 'neoadjuvant', ruleFilter: 'NEO3', description: 'EC ×4 → Taxan + HP' },
        { id: 'neo-tn', label: 'TN', leaf: true, tableRef: 'neoadjuvant', ruleFilter: 'NEO4', description: 'Pembrolizumab + Karboplatin/Taxan → EC (KEYNOTE-522)' },
      ],
    },
    {
      id: 'adjuvant',
      label: 'Adjuvant',
      question: 'Steg 1: Bestem HER2-status',
      description: 'Behandling ETTER kirurgi',
      icon: '💊',
      children: [
        {
          id: 'her2-determination',
          label: 'HER2-bestemmelse',
          question: 'HER2 IHC-resultat?',
          description: 'Bestem HER2-status basert på IHC og evt. SISH',
          icon: '🔬',
          tableRef: 'her2',
          children: [
            { id: 'her2-3plus', label: 'IHC 3+', leaf: true, tableRef: 'her2', ruleFilter: 'H1', description: 'HER2-positiv (overekspresjon bekreftet)', resultColor: 'positive' },
            { id: 'her2-0', label: 'IHC 0', leaf: true, tableRef: 'her2', ruleFilter: 'H2', description: 'HER2-negativ', resultColor: 'negative' },
            { id: 'her2-1plus', label: 'IHC 1+', leaf: true, tableRef: 'her2', ruleFilter: 'H3', description: 'HER2-negativ (lav ekspresjon)', resultColor: 'negative' },
            {
              id: 'her2-2plus',
              label: 'IHC 2+',
              question: 'SISH/ISH-resultat?',
              description: 'Ekvivokal — krever SISH for avklaring',
              icon: '🧬',
              children: [
                { id: 'her2-2plus-pos', label: 'SISH positiv', leaf: true, tableRef: 'her2', ruleFilter: 'H4', description: 'HER2-positiv (amplifisert)', resultColor: 'positive' },
                { id: 'her2-2plus-neg', label: 'SISH negativ', leaf: true, tableRef: 'her2', ruleFilter: 'H5', description: 'HER2-negativ (ikke amplifisert)', resultColor: 'negative' },
                { id: 'her2-2plus-none', label: 'Ikke utført', leaf: true, tableRef: 'her2', ruleFilter: 'H6', description: 'Ekvivokal — SISH kreves', resultColor: 'equivocal' },
              ],
            },
          ],
        },
        {
          id: 'biogroup',
          label: 'Biologisk undergruppe',
          question: 'Hvilken biologisk undergruppe?',
          description: 'Basert på HR/HER2-status → behandlingsvei',
          icon: '🧪',
          children: [
            {
              id: 'hrpos-her2neg',
              label: 'HR+HER2-',
              question: 'Behandlingsvalg for HR+HER2-',
              description: 'Luminal — hormonreseptorpositiv, HER2-negativ',
              icon: '💜',
              children: [
                {
                  id: 'hrpos-her2neg-chemo',
                  label: 'Kjemoterapi',
                  question: 'N-stadium?',
                  description: 'Kjemoterapibeslutning basert på N-stadium, gentest og grad',
                  icon: '💉',
                  tableRef: 'chemo',
                  children: [
                    {
                      id: 'chemo-n2n3',
                      label: 'N2/N3 (≥4 knuter)',
                      leaf: true,
                      tableRef: 'chemo',
                      ruleFilter: 'CP1',
                      description: 'Alltid kjemoterapi: EC ×4 + taxan',
                      resultColor: 'positive',
                    },
                    {
                      id: 'chemo-n1',
                      label: 'N1 (1-3 knuter)',
                      question: 'Genekspresjonstest?',
                      description: 'Gentestresultat avgjør kjemoterapibehov',
                      icon: '🧬',
                      children: [
                        {
                          id: 'chemo-n1-prosigna',
                          label: 'Prosigna',
                          question: 'ROR-score?',
                          children: [
                            { id: 'chemo-n1-ror-low', label: 'ROR ≤40', leaf: true, tableRef: 'chemo', ruleFilter: 'CP2', description: 'Lav risiko → ingen kjemoterapi', resultColor: 'negative' },
                            { id: 'chemo-n1-ror-mid', label: 'ROR 41-60', leaf: true, tableRef: 'chemo', ruleFilter: 'CP3b', description: 'Intermediær → individuell vurdering', resultColor: 'equivocal' },
                            { id: 'chemo-n1-ror-high', label: 'ROR >60', leaf: true, tableRef: 'chemo', ruleFilter: 'CP3', description: 'Høy risiko → EC + taxan', resultColor: 'positive' },
                          ],
                        },
                        {
                          id: 'chemo-n1-oncotype',
                          label: 'OncotypeDX',
                          question: 'RS-score?',
                          children: [
                            { id: 'chemo-n1-rs-low', label: 'RS ≤25', leaf: true, tableRef: 'chemo', ruleFilter: 'CP4', description: 'Endokrinterapi alene (RxPONDER)', resultColor: 'negative' },
                            { id: 'chemo-n1-rs-high', label: 'RS >25', leaf: true, tableRef: 'chemo', ruleFilter: 'CP5', description: 'Kjemoterapi anbefalt', resultColor: 'positive' },
                          ],
                        },
                        {
                          id: 'chemo-n1-notest',
                          label: 'Ingen gentest',
                          question: 'Histologisk grad?',
                          children: [
                            { id: 'chemo-n1-g1', label: 'Grad 1', leaf: true, tableRef: 'chemo', ruleFilter: 'CP7', description: 'Gentest anbefales', resultColor: 'equivocal' },
                            { id: 'chemo-n1-g2', label: 'Grad 2', leaf: true, tableRef: 'chemo', ruleFilter: 'CP8', description: 'Gentest anbefales', resultColor: 'equivocal' },
                            { id: 'chemo-n1-g3', label: 'Grad 3', leaf: true, tableRef: 'chemo', ruleFilter: 'CP6', description: 'Kjemoterapi anbefalt', resultColor: 'positive' },
                          ],
                        },
                      ],
                    },
                    {
                      id: 'chemo-n0',
                      label: 'N0 (ingen knuter)',
                      question: 'Tumorstørrelse og gentest?',
                      description: 'Avhenger av tumor og risikoprofil',
                      children: [
                        { id: 'chemo-n0-small', label: '≤10mm', leaf: true, tableRef: 'chemo', ruleFilter: 'CP16', description: 'For liten for kjemoterapi', resultColor: 'negative' },
                        {
                          id: 'chemo-n0-prosigna',
                          label: 'Prosigna (>10mm)',
                          question: 'ROR-score?',
                          children: [
                            { id: 'chemo-n0-ror-low', label: 'ROR ≤40', leaf: true, tableRef: 'chemo', ruleFilter: 'CP17', description: 'Lav risiko → ingen kjemoterapi', resultColor: 'negative' },
                            { id: 'chemo-n0-ror-mid', label: 'ROR 41-60', leaf: true, tableRef: 'chemo', ruleFilter: 'CP18c', description: 'Intermediær → individuell vurdering', resultColor: 'equivocal' },
                            { id: 'chemo-n0-ror-high', label: 'ROR >60', leaf: true, tableRef: 'chemo', ruleFilter: 'CP18b', description: 'Høy risiko → EC ×4', resultColor: 'positive' },
                          ],
                        },
                        {
                          id: 'chemo-n0-notest',
                          label: 'Ingen gentest (>10mm)',
                          question: 'Histologisk grad?',
                          children: [
                            { id: 'chemo-n0-g1', label: 'Grad 1', leaf: true, tableRef: 'chemo', ruleFilter: 'CP21', description: 'Lav risiko — endokrinterapi alene', resultColor: 'negative' },
                            { id: 'chemo-n0-g2', label: 'Grad 2', leaf: true, tableRef: 'chemo', ruleFilter: 'CP24', description: 'Gentest anbefales', resultColor: 'equivocal' },
                            { id: 'chemo-n0-g3', label: 'Grad 3', leaf: true, tableRef: 'chemo', ruleFilter: 'CP22', description: 'EC ×4 anbefalt', resultColor: 'positive' },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'hrpos-her2neg-endocrine',
                  label: 'Endokrinterapi',
                  question: 'Menopausal status?',
                  description: 'Hormonterapivalg',
                  icon: '💊',
                  tableRef: 'endocrine',
                  children: [
                    { id: 'endo-post', label: 'Postmenopausal', leaf: true, tableRef: 'endocrine', ruleFilter: 'ET1', description: 'Aromatasehemmer 5 år' },
                    { id: 'endo-pre-high', label: 'Pre/peri + høyrisiko', leaf: true, tableRef: 'endocrine', ruleFilter: 'ET2', description: 'Tamoxifen + OFS 5-10 år' },
                    { id: 'endo-pre-low', label: 'Pre/peri (lav risiko)', leaf: true, tableRef: 'endocrine', ruleFilter: 'ET3', description: 'Tamoxifen 5-10 år' },
                  ],
                },
                {
                  id: 'hrpos-her2neg-cdk46',
                  label: 'CDK4/6-inhibitor',
                  question: 'T- og N-stadium?',
                  description: 'Abemaciclib vs Ribociclib (NBCG sept 2025)',
                  icon: '🎯',
                  tableRef: 'cdk46',
                  children: [
                    { id: 'cdk-t1n0', label: 'T1 N0', leaf: true, tableRef: 'cdk46', ruleFilter: 'R1', description: 'Ingen CDK4/6i (lav risiko)', resultColor: 'negative' },
                    { id: 'cdk-t2n0', label: 'T2 N0', leaf: true, tableRef: 'cdk46', ruleFilter: 'R2', description: 'Ribociclib kun ved G3/GES høy', resultColor: 'equivocal' },
                    { id: 'cdk-t1n1', label: 'T1 N1', leaf: true, tableRef: 'cdk46', ruleFilter: 'R3', description: 'Abema ved G3, Ribo ved G3/GES høy', resultColor: 'equivocal' },
                    { id: 'cdk-t2n1', label: 'T2 N1', leaf: true, tableRef: 'cdk46', ruleFilter: 'R4', description: 'Abema ved G3, Ribociclib anbefalt' },
                    { id: 'cdk-n2', label: 'N2', leaf: true, tableRef: 'cdk46', ruleFilter: 'R6', description: 'Abemaciclib FØRSTEVALG + Ribo', resultColor: 'positive' },
                    { id: 'cdk-n3', label: 'N3', leaf: true, tableRef: 'cdk46', ruleFilter: 'R8', description: 'Abemaciclib FØRSTEVALG (svært høy risiko)', resultColor: 'positive' },
                  ],
                },
              ],
            },
            {
              id: 'hrpos-her2pos',
              label: 'HR+HER2+',
              question: 'N-stadium og tumorstørrelse?',
              description: 'HER2-rettet terapi + endokrinterapi',
              icon: '🔵',
              tableRef: 'hrposHer2pos',
              children: [
                { id: 'hh-n0-small', label: 'N0, ≤20mm', leaf: true, tableRef: 'hrposHer2pos', ruleFilter: 'HH1', description: 'APT-regimet (Paklitaxel + Trastuzumab)' },
                { id: 'hh-n0-large', label: 'N0, >20mm', leaf: true, tableRef: 'hrposHer2pos', ruleFilter: 'HH2', description: 'TC ×4 + HP 1 år' },
                { id: 'hh-n1mi', label: 'N1mi', leaf: true, tableRef: 'hrposHer2pos', ruleFilter: 'HH3', description: 'TC ×4 + HP 1 år' },
                { id: 'hh-npos', label: 'N1+', leaf: true, tableRef: 'hrposHer2pos', ruleFilter: 'HH4', description: 'EC ×4 → Taxan + HP (APHINITY)' },
              ],
            },
            {
              id: 'hrneg-her2pos',
              label: 'HR-HER2+',
              question: 'N-stadium og tumorstørrelse?',
              description: 'HER2-rettet terapi uten endokrinterapi',
              icon: '🟢',
              tableRef: 'hrnegHer2pos',
              children: [
                { id: 'nh-n0-small', label: 'N0, ≤20mm', leaf: true, tableRef: 'hrnegHer2pos', ruleFilter: 'NH1', description: 'APT-regimet' },
                { id: 'nh-n0-large', label: 'N0, >20mm', leaf: true, tableRef: 'hrnegHer2pos', ruleFilter: 'NH2', description: 'TC ×4 + Trastuzumab' },
                { id: 'nh-npos', label: 'N1+', leaf: true, tableRef: 'hrnegHer2pos', ruleFilter: 'NH3', description: 'EC ×4 → Taxan + HP (APHINITY)' },
              ],
            },
            {
              id: 'tn',
              label: 'Trippel negativ',
              question: 'N-stadium og tumorstørrelse?',
              description: 'Aggressiv biologi — krever kjemoterapi',
              icon: '🔴',
              tableRef: 'tn',
              children: [
                { id: 'tn-n0-small', label: 'N0, ≤10mm', leaf: true, tableRef: 'tn', ruleFilter: 'TN1', description: 'Individuell vurdering', resultColor: 'equivocal' },
                { id: 'tn-n0', label: 'N0, >10mm', leaf: true, tableRef: 'tn', ruleFilter: 'TN2', description: 'EC ×4 + Taxan', resultColor: 'positive' },
                { id: 'tn-n1mi', label: 'N1mi', leaf: true, tableRef: 'tn', ruleFilter: 'TN3', description: 'EC ×4 + Taxan' },
                { id: 'tn-npos', label: 'N1+', leaf: true, tableRef: 'tn', ruleFilter: 'TN4', description: 'EC ×4 + Taxan ± Karboplatin + Pembrolizumab', resultColor: 'positive' },
              ],
            },
          ],
        },
        {
          id: 'radiation',
          label: 'Strålebehandling',
          question: 'Kirurgitype?',
          description: 'Gjelder alle biogrupper',
          icon: '☢️',
          tableRef: 'radiation',
          children: [
            {
              id: 'rad-bcs',
              label: 'Brystbevarende (BCS)',
              question: 'N-stadium?',
              children: [
                { id: 'rad-bcs-npos', label: 'N1+', leaf: true, tableRef: 'radiation', ruleFilter: 'RT1', description: 'Hele brystet + regionale lymfeknuter' },
                { id: 'rad-bcs-n0', label: 'N0/N1mi', leaf: true, tableRef: 'radiation', ruleFilter: 'RT2', description: 'Hele brystet (alltid ved BCS)' },
              ],
            },
            {
              id: 'rad-mast',
              label: 'Mastektomi',
              question: 'N-stadium / T-stadium?',
              children: [
                { id: 'rad-mast-n2', label: 'N2/N3', leaf: true, tableRef: 'radiation', ruleFilter: 'RT3', description: 'Brystvegg + regionale lymfeknuter' },
                { id: 'rad-mast-n1', label: 'N1', leaf: true, tableRef: 'radiation', ruleFilter: 'RT4', description: 'Brystvegg + regionale lymfeknuter' },
                { id: 'rad-mast-big', label: 'T3/T4', leaf: true, tableRef: 'radiation', ruleFilter: 'RT5', description: 'Brystvegg + regionale lymfeknuter' },
                { id: 'rad-mast-none', label: 'T1-T2 N0', leaf: true, tableRef: 'radiation', ruleFilter: 'RT6', description: 'Ikke rutinemessig anbefalt', resultColor: 'negative' },
              ],
            },
          ],
        },
        {
          id: 'zometa',
          label: 'Zoledronsyre',
          question: 'Menopausal status?',
          description: 'Bisfosfonat ved systemisk behandling',
          icon: '🦴',
          tableRef: 'zometa',
          children: [
            { id: 'zom-post', label: 'Postmenopausal', leaf: true, tableRef: 'zometa', ruleFilter: 'Z1', description: 'Zoledronsyre 4mg iv q6m × 6 (3 år)' },
            { id: 'zom-pre-ofs', label: 'Pre/peri + OFS', leaf: true, tableRef: 'zometa', ruleFilter: 'Z2', description: 'Zoledronsyre 4mg iv q6m × 6 (3 år)' },
            { id: 'zom-55', label: 'Alder ≥55', leaf: true, tableRef: 'zometa', ruleFilter: 'Z3', description: 'Zoledronsyre indisert' },
            { id: 'zom-pre-no', label: 'Pre uten OFS, <55', leaf: true, tableRef: 'zometa', ruleFilter: 'Z4', description: 'Ikke indisert', resultColor: 'negative' },
          ],
        },
      ],
    },
  ],
};

// Map tableRef strings to actual table objects
const TABLE_MAP = {
  her2: HER2_DETERMINATION_TABLE,
  chemo: CHEMO_PATHWAY_TABLE,
  cdk46: CDK46_DECISION_TABLE,
  endocrine: ENDOCRINE_THERAPY_TABLE,
  zometa: ZOMETA_TABLE,
  radiation: RADIATION_TABLE,
  hrposHer2pos: HRPOS_HER2POS_TABLE,
  hrnegHer2pos: HRNEG_HER2POS_TABLE,
  tn: TN_TABLE,
  neoadjuvant: NEOADJUVANT_TABLE,
};

function getRule(tableRef, ruleId) {
  const table = TABLE_MAP[tableRef];
  if (!table) return null;
  return table.rules.find((r) => r.id === ruleId) || null;
}

function getTable(tableRef) {
  return TABLE_MAP[tableRef] || null;
}

// ============================================================
// Component
// ============================================================

export default function InteractiveDecisionTree() {
  // Path is an array of node IDs representing the traversal
  const [path, setPath] = useState(['root']);

  // Walk the tree to find a node by traversing the path
  const findNode = useCallback((nodeId, tree) => {
    if (tree.id === nodeId) return tree;
    if (!tree.children) return null;
    for (const child of tree.children) {
      const found = findNode(nodeId, child);
      if (found) return found;
    }
    return null;
  }, []);

  const currentNodeId = path[path.length - 1];
  const currentNode = findNode(currentNodeId, TREE);

  // Build breadcrumb nodes
  const breadcrumbNodes = path.map((id) => findNode(id, TREE)).filter(Boolean);

  function handleSelect(childId) {
    setPath((prev) => [...prev, childId]);
  }

  function handleBreadcrumb(index) {
    setPath((prev) => prev.slice(0, index + 1));
  }

  function handleReset() {
    setPath(['root']);
  }

  if (!currentNode) return <div>Node ikke funnet</div>;

  // Get the DMN rule details for leaf nodes
  const rule = currentNode.leaf && currentNode.ruleFilter
    ? getRule(currentNode.tableRef, currentNode.ruleFilter)
    : null;

  const table = currentNode.tableRef ? getTable(currentNode.tableRef) : null;

  return (
    <div className="dtree-container">
      <div className="dtree-header">
        <h2>Interaktivt Beslutningstre</h2>
        <p className="dtree-subtitle">
          Klikk deg gjennom nodene for å utforske den kliniske beslutningslogikken
        </p>
      </div>

      {/* Breadcrumb trail */}
      <div className="dtree-breadcrumb">
        {breadcrumbNodes.map((node, i) => (
          <span key={node.id} className="dtree-crumb-wrapper">
            {i > 0 && <span className="dtree-crumb-arrow">›</span>}
            <button
              className={`dtree-crumb ${i === path.length - 1 ? 'active' : ''}`}
              onClick={() => handleBreadcrumb(i)}
            >
              {node.icon && <span className="dtree-crumb-icon">{node.icon}</span>}
              {node.label}
            </button>
          </span>
        ))}
        {path.length > 1 && (
          <button className="dtree-reset-btn" onClick={handleReset}>
            Start på nytt
          </button>
        )}
      </div>

      {/* Current node */}
      <div className="dtree-current">
        <div className="dtree-node-header">
          {currentNode.icon && <span className="dtree-node-icon">{currentNode.icon}</span>}
          <h3>{currentNode.label}</h3>
          {table && (
            <span className="dtree-table-badge">
              DMN: {table.name}
            </span>
          )}
        </div>

        {currentNode.description && (
          <p className="dtree-node-desc">{currentNode.description}</p>
        )}

        {/* Leaf node — show rule details */}
        {currentNode.leaf && rule && (
          <div className={`dtree-leaf-result ${currentNode.resultColor || 'default'}`}>
            <div className="dtree-result-header">
              <span className="dtree-rule-badge">{rule.id}</span>
              <span className="dtree-result-label">Resultat</span>
            </div>

            <div className="dtree-result-body">
              {rule.outputs.rationale && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Begrunnelse</span>
                  <span className="dtree-result-val">{rule.outputs.rationale}</span>
                </div>
              )}
              {rule.outputs.regimen && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Regime</span>
                  <span className="dtree-result-val">{rule.outputs.regimen}</span>
                </div>
              )}
              {rule.outputs.detail && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Detaljer</span>
                  <span className="dtree-result-val">{rule.outputs.detail}</span>
                </div>
              )}
              {rule.outputs.duration && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Varighet</span>
                  <span className="dtree-result-val">{rule.outputs.duration}</span>
                </div>
              )}
              {rule.outputs.therapy && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Terapi</span>
                  <span className="dtree-result-val">{rule.outputs.therapy}</span>
                </div>
              )}
              {rule.outputs.her2Result && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">HER2-status</span>
                  <span className={`dtree-result-val dtree-her2-${rule.outputs.her2Result}`}>
                    {rule.outputs.her2Result === 'positive' ? 'Positiv' : rule.outputs.her2Result === 'negative' ? 'Negativ' : 'Ekvivokal'}
                  </span>
                </div>
              )}
              {rule.outputs.abemaciclib && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Abemaciclib</span>
                  <span className="dtree-result-val">{formatCDK46(rule.outputs.abemaciclib)}</span>
                </div>
              )}
              {rule.outputs.ribociclib && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Ribociclib</span>
                  <span className="dtree-result-val">{formatCDK46(rule.outputs.ribociclib)}</span>
                </div>
              )}
              {rule.outputs.recommended != null && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Anbefalt</span>
                  <span className="dtree-result-val">{rule.outputs.recommended ? 'Ja' : 'Nei'}</span>
                </div>
              )}
              {rule.outputs.type && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Type</span>
                  <span className="dtree-result-val">{rule.outputs.type}</span>
                </div>
              )}
              {rule.outputs.eligible != null && (
                <div className="dtree-result-row">
                  <span className="dtree-result-key">Indisert</span>
                  <span className="dtree-result-val">{rule.outputs.eligible ? 'Ja' : 'Nei'}</span>
                </div>
              )}
              {rule.outputs.warnings && rule.outputs.warnings.length > 0 && (
                <div className="dtree-result-warnings">
                  <span className="dtree-result-key">Advarsler</span>
                  <ul>
                    {rule.outputs.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Show conditions that led here */}
            {Object.keys(rule.conditions).length > 0 && (
              <div className="dtree-conditions">
                <span className="dtree-conditions-label">Betingelser for denne regelen:</span>
                <div className="dtree-condition-chips">
                  {Object.entries(rule.conditions).map(([key, val]) => (
                    <span key={key} className="dtree-condition-chip">
                      <strong>{key}</strong>: {formatCondition(val)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Non-leaf: show question and choices */}
        {!currentNode.leaf && currentNode.children && (
          <div className="dtree-choices">
            {currentNode.question && (
              <h4 className="dtree-question">{currentNode.question}</h4>
            )}
            <div className="dtree-choice-grid">
              {currentNode.children.map((child) => (
                <button
                  key={child.id}
                  className={`dtree-choice-btn ${child.leaf ? 'leaf' : ''}`}
                  onClick={() => handleSelect(child.id)}
                >
                  <div className="dtree-choice-top">
                    {child.icon && <span className="dtree-choice-icon">{child.icon}</span>}
                    <span className="dtree-choice-label">{child.label}</span>
                    {!child.leaf && <span className="dtree-choice-arrow">→</span>}
                    {child.leaf && <span className="dtree-choice-leaf-badge">Resultat</span>}
                  </div>
                  {child.description && (
                    <span className="dtree-choice-desc">{child.description}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Leaf with no rule — just show description */}
        {currentNode.leaf && !rule && (
          <div className="dtree-leaf-result default">
            <div className="dtree-result-body">
              <p>{currentNode.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Visual path indicator */}
      {path.length > 1 && (
        <div className="dtree-path-visual">
          <h4>Din beslutningsvei</h4>
          <div className="dtree-path-nodes">
            {breadcrumbNodes.map((node, i) => (
              <React.Fragment key={node.id}>
                {i > 0 && <div className="dtree-path-connector" />}
                <div className={`dtree-path-node ${i === breadcrumbNodes.length - 1 ? 'current' : 'visited'} ${node.leaf ? 'leaf' : ''}`}>
                  {node.icon && <span>{node.icon}</span>}
                  <span>{node.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCondition(val) {
  if (val === null || val === undefined) return 'vilkårlig';
  if (Array.isArray(val)) return val.join(' / ');
  if (typeof val === 'object') {
    const parts = [];
    if ('gte' in val) parts.push(`≥${val.gte}`);
    if ('gt' in val) parts.push(`>${val.gt}`);
    if ('lte' in val) parts.push(`≤${val.lte}`);
    if ('lt' in val) parts.push(`<${val.lt}`);
    if ('not' in val) parts.push(`ikke ${val.not}`);
    return parts.join(', ');
  }
  if (typeof val === 'boolean') return val ? 'ja' : 'nei';
  return String(val);
}

function formatCDK46(val) {
  const map = {
    yes: 'Ja — anbefalt',
    no: 'Nei',
    first_choice: 'Førstevalg',
    if_G3: 'Kun ved Grad 3',
    'if_G3_or_gesHigh': 'Ved Grad 3 eller GES høy risiko',
  };
  return map[val] || val;
}
