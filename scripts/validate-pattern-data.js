#!/usr/bin/env node

/**
 * Pattern Data Validation Script
 *
 * Validates historical pattern data quality and generates detailed reports.
 * Checks for data completeness, duplicates, label distribution, and pattern validity.
 *
 * Usage: node scripts/validate-pattern-data.js [path/to/patterns.json]
 *        node scripts/validate-pattern-data.js data/raw/historical-patterns.json
 */

import fs from 'fs';
import path from 'path';

// Parse arguments
const args = process.argv.slice(2);
const INPUT_FILE = args[0] || './data/raw/historical-patterns.json';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  PATTERN DATA VALIDATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Input file: ${INPUT_FILE}`);
console.log('');

// Load data
if (!fs.existsSync(INPUT_FILE)) {
  console.error(`✗ ERROR: File not found: ${INPUT_FILE}`);
  process.exit(1);
}

const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
const data = JSON.parse(rawData);

console.log('✓ File loaded successfully');
console.log('');

// Validation results
const validationResults = {
  passed: [],
  failed: [],
  warnings: [],
};

/**
 * Add validation result
 */
function addResult(type, name, status, details = '') {
  const result = { name, status, details };
  validationResults[type].push(result);

  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`${icon} ${name}: ${status} ${details ? `(${details})` : ''}`);
}

/**
 * Validation Tests
 */

console.log('METADATA VALIDATION');
console.log('───────────────────────────────────────────────────────────────');

// Check metadata structure
if (data.collectionDate && data.symbol && data.timeframes && data.patterns) {
  addResult('passed', 'Metadata Structure', 'PASS', 'All required fields present');
} else {
  addResult('failed', 'Metadata Structure', 'FAIL', 'Missing required metadata fields');
}

// Check collection period
if (data.collectionPeriod && data.collectionPeriod.days >= 180) {
  addResult('passed', 'Collection Period', 'PASS', `${data.collectionPeriod.days} days`);
} else {
  addResult('warnings', 'Collection Period', 'WARN', `Only ${data.collectionPeriod?.days || 0} days (need 180+)`);
}

// Check timeframes
const expectedTimeframes = ['lf', 'mf', 'hf'];
const hasAllTimeframes = expectedTimeframes.every(tf => data.timeframes[tf]);
if (hasAllTimeframes) {
  addResult('passed', 'Timeframes', 'PASS', `LF=${data.timeframes.lf}, MF=${data.timeframes.mf}, HF=${data.timeframes.hf}`);
} else {
  addResult('failed', 'Timeframes', 'FAIL', 'Missing required timeframes');
}

console.log('');
console.log('PATTERN COUNT VALIDATION');
console.log('───────────────────────────────────────────────────────────────');

const patterns = data.patterns || [];
const patternCount = patterns.length;

if (patternCount >= 200) {
  addResult('passed', 'Pattern Count', 'PASS', `${patternCount} patterns (need 200+)`);
} else {
  addResult('failed', 'Pattern Count', 'FAIL', `${patternCount} patterns (need 200+)`);
}

console.log('');
console.log('LABEL DISTRIBUTION VALIDATION');
console.log('───────────────────────────────────────────────────────────────');

const winners = patterns.filter(p => p.label === 'winner').length;
const losers = patterns.filter(p => p.label === 'loser').length;
const unlabeled = patterns.filter(p => !p.label || (p.label !== 'winner' && p.label !== 'loser')).length;

const winRate = patternCount > 0 ? ((winners / patternCount) * 100).toFixed(2) : 0;
const ratio = losers > 0 ? (winners / losers).toFixed(2) : 'Infinity';

console.log(`Winners: ${winners} (${winRate}%)`);
console.log(`Losers: ${losers} (${(100 - winRate).toFixed(2)}%)`);
console.log(`Unlabeled: ${unlabeled}`);
console.log(`Ratio: ${ratio}`);

// Check win rate (should be realistic, 40-70%)
if (winRate >= 40 && winRate <= 70) {
  addResult('passed', 'Win Rate', 'PASS', `${winRate}%`);
} else if (winRate >= 30 && winRate <= 80) {
  addResult('warnings', 'Win Rate', 'WARN', `${winRate}% (prefer 40-70%)`);
} else {
  addResult('failed', 'Win Rate', 'FAIL', `${winRate}% (should be 40-70%)`);
}

// Check ratio (50/50 to 60/40 range = 0.8 to 1.5)
const ratioNum = parseFloat(ratio);
if (ratioNum >= 0.8 && ratioNum <= 1.5) {
  addResult('passed', 'Winner/Loser Ratio', 'PASS', `${ratio}`);
} else if (ratioNum >= 0.6 && ratioNum <= 2.0) {
  addResult('warnings', 'Winner/Loser Ratio', 'WARN', `${ratio} (prefer 0.8-1.5)`);
} else {
  addResult('failed', 'Winner/Loser Ratio', 'FAIL', `${ratio} (should be 0.8-1.5)`);
}

// Check for unlabeled patterns
if (unlabeled === 0) {
  addResult('passed', 'Labeling Completeness', 'PASS', 'All patterns labeled');
} else {
  addResult('failed', 'Labeling Completeness', 'FAIL', `${unlabeled} unlabeled patterns`);
}

console.log('');
console.log('PATTERN STRUCTURE VALIDATION');
console.log('───────────────────────────────────────────────────────────────');

// Check required fields for each pattern
const requiredFields = [
  'symbol', 'timeframe', 'entryTime', 'entryPrice', 'stopLoss', 'target', 'atr',
  'direction', 'label', 'stage1_momentumMove', 'stage2_consolidation',
  'stage3_testBar', 'stage4_hook', 'stage5_reentry', 'hfTrend', 'labelDetails'
];

let missingFieldCount = 0;
const fieldPresence = {};

for (const pattern of patterns) {
  for (const field of requiredFields) {
    if (!pattern[field]) {
      missingFieldCount++;
      fieldPresence[field] = (fieldPresence[field] || 0) + 1;
    }
  }
}

if (missingFieldCount === 0) {
  addResult('passed', 'Required Fields', 'PASS', 'All patterns have required fields');
} else {
  addResult('failed', 'Required Fields', 'FAIL', `${missingFieldCount} missing fields across patterns`);
  Object.entries(fieldPresence).forEach(([field, count]) => {
    console.log(`    Missing '${field}' in ${count} patterns`);
  });
}

console.log('');
console.log('DATA QUALITY VALIDATION');
console.log('───────────────────────────────────────────────────────────────');

// Check for duplicate entry times
const entryTimes = patterns.map(p => p.entryTime);
const uniqueTimes = new Set(entryTimes);

if (uniqueTimes.size === entryTimes.length) {
  addResult('passed', 'Duplicate Check', 'PASS', 'No duplicate entry times');
} else {
  const duplicates = entryTimes.length - uniqueTimes.size;
  addResult('failed', 'Duplicate Check', 'FAIL', `${duplicates} duplicate entry times`);
}

// Check for valid prices (positive, non-zero, non-NaN)
let invalidPrices = 0;

for (const pattern of patterns) {
  if (!pattern.entryPrice || pattern.entryPrice <= 0 || isNaN(pattern.entryPrice)) invalidPrices++;
  if (!pattern.stopLoss || pattern.stopLoss <= 0 || isNaN(pattern.stopLoss)) invalidPrices++;
  if (!pattern.target || pattern.target <= 0 || isNaN(pattern.target)) invalidPrices++;
  if (!pattern.atr || pattern.atr <= 0 || isNaN(pattern.atr)) invalidPrices++;
}

if (invalidPrices === 0) {
  addResult('passed', 'Price Validity', 'PASS', 'All prices valid');
} else {
  addResult('failed', 'Price Validity', 'FAIL', `${invalidPrices} invalid price values`);
}

// Check direction consistency
const longPatterns = patterns.filter(p => p.direction === 'long').length;
const shortPatterns = patterns.filter(p => p.direction === 'short').length;
const invalidDirections = patterns.filter(p => p.direction !== 'long' && p.direction !== 'short').length;

console.log(`Long patterns: ${longPatterns}`);
console.log(`Short patterns: ${shortPatterns}`);

if (invalidDirections === 0) {
  addResult('passed', 'Direction Validity', 'PASS', 'All directions valid (long/short)');
} else {
  addResult('failed', 'Direction Validity', 'FAIL', `${invalidDirections} invalid direction values`);
}

// Check risk/reward ratios
let invalidRR = 0;
let avgRR = 0;

for (const pattern of patterns) {
  const risk = Math.abs(pattern.entryPrice - pattern.stopLoss);
  const reward = Math.abs(pattern.target - pattern.entryPrice);
  const rr = reward / risk;

  if (rr < 1 || rr > 10 || isNaN(rr)) {
    invalidRR++;
  } else {
    avgRR += rr;
  }
}

avgRR = avgRR / (patternCount - invalidRR);

if (invalidRR === 0) {
  addResult('passed', 'Risk/Reward Validity', 'PASS', `Average R:R = ${avgRR.toFixed(2)}`);
} else {
  addResult('warnings', 'Risk/Reward Validity', 'WARN', `${invalidRR} patterns with unusual R:R (avg ${avgRR.toFixed(2)})`);
}

console.log('');
console.log('PHASE 5 READINESS VALIDATION');
console.log('───────────────────────────────────────────────────────────────');

// Overall Phase 5 criteria
const phase5Criteria = [
  { name: 'Pattern Count ≥ 200', pass: patternCount >= 200 },
  { name: 'Win Rate 40-70%', pass: winRate >= 40 && winRate <= 70 },
  { name: 'Ratio 0.8-1.5', pass: ratioNum >= 0.8 && ratioNum <= 1.5 },
  { name: 'No Duplicates', pass: uniqueTimes.size === entryTimes.length },
  { name: 'All Fields Present', pass: missingFieldCount === 0 },
  { name: 'Valid Prices', pass: invalidPrices === 0 },
];

const phase5Pass = phase5Criteria.every(c => c.pass);

phase5Criteria.forEach(criterion => {
  const icon = criterion.pass ? '✓' : '✗';
  console.log(`${icon} ${criterion.name}: ${criterion.pass ? 'PASS' : 'FAIL'}`);
});

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');

console.log(`Tests Passed: ${validationResults.passed.length}`);
console.log(`Tests Failed: ${validationResults.failed.length}`);
console.log(`Warnings: ${validationResults.warnings.length}`);
console.log('');

if (phase5Pass && validationResults.failed.length === 0) {
  console.log('✓ ✓ ✓  PHASE 5 DATA VALIDATION: PASSED  ✓ ✓ ✓');
  console.log('');
  console.log('✓ Dataset is ready for model retraining');
  console.log('✓ Run: node scripts/train-model.cjs --data real');
} else if (validationResults.failed.length === 0) {
  console.log('⚠ ⚠ ⚠  PHASE 5 DATA VALIDATION: WARNINGS  ⚠ ⚠ ⚠');
  console.log('');
  console.log('Dataset has warnings but may be usable');
  console.log('Review warnings above before proceeding');
} else {
  console.log('✗ ✗ ✗  PHASE 5 DATA VALIDATION: FAILED  ✗ ✗ ✗');
  console.log('');
  console.log('Dataset has critical issues that must be fixed');
  console.log('Review failed tests above');
}

console.log('');

// Save validation report
const reportDir = './data/reports';
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const reportFile = path.join(reportDir, 'pattern-data-validation-report.json');
const report = {
  validationDate: new Date().toISOString(),
  inputFile: INPUT_FILE,
  summary: {
    totalPatterns: patternCount,
    winners: winners,
    losers: losers,
    unlabeled: unlabeled,
    winRate: parseFloat(winRate),
    ratio: parseFloat(ratio),
  },
  phase5Readiness: {
    passed: phase5Pass,
    criteria: phase5Criteria,
  },
  validation: {
    passed: validationResults.passed.length,
    failed: validationResults.failed.length,
    warnings: validationResults.warnings.length,
    details: validationResults,
  },
};

fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`✓ Validation report saved to ${reportFile}`);
console.log('');
