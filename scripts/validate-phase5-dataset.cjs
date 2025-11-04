/**
 * Phase 5 Dataset Validation Script
 * Comprehensive validation of historical-patterns.json
 */

const fs = require('fs');
const path = require('path');

const DATASET_PATH = path.join(__dirname, '../data/raw/historical-patterns.json');

function validateDataset() {
  console.log('=== Phase 5 Dataset Validation ===\n');

  // Load dataset
  const data = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  const patterns = data.patterns;

  // 1. Basic counts
  console.log('1. DATASET COUNTS');
  console.log(`   Total patterns: ${patterns.length}`);
  const winners = patterns.filter(p => p.label === 'winner');
  const losers = patterns.filter(p => p.label === 'loser');
  console.log(`   Winners: ${winners.length} (${(winners.length/patterns.length*100).toFixed(1)}%)`);
  console.log(`   Losers: ${losers.length} (${(losers.length/patterns.length*100).toFixed(1)}%)`);
  console.log(`   Long patterns: ${patterns.filter(p => p.direction === 'long').length}`);
  console.log(`   Short patterns: ${patterns.filter(p => p.direction === 'short').length}`);

  // 2. Symbol distribution
  console.log('\n2. SYMBOL DISTRIBUTION');
  const symbolCounts = {};
  patterns.forEach(p => {
    symbolCounts[p.symbol] = (symbolCounts[p.symbol] || 0) + 1;
  });
  Object.entries(symbolCounts).forEach(([sym, count]) => {
    console.log(`   ${sym}: ${count} patterns`);
  });

  // 3. Calculate R:R ratios manually
  console.log('\n3. RISK:REWARD ANALYSIS');
  const rrRatios = patterns.map(p => {
    const risk = Math.abs(p.entryPrice - p.stopLoss);
    const reward = Math.abs(p.target - p.entryPrice);
    return reward / risk;
  });
  const avgRR = rrRatios.reduce((a,b) => a+b, 0) / rrRatios.length;
  const minRR = Math.min(...rrRatios);
  const maxRR = Math.max(...rrRatios);
  console.log(`   Average R:R: ${avgRR.toFixed(2)}:1`);
  console.log(`   Min R:R: ${minRR.toFixed(2)}:1`);
  console.log(`   Max R:R: ${maxRR.toFixed(2)}:1`);
  console.log(`   Patterns with R:R >= 2:1: ${rrRatios.filter(r => r >= 2).length}/${patterns.length}`);

  // 4. Price validation
  console.log('\n4. PRICE VALIDATION');
  let validPrices = 0;
  let invalidPrices = [];
  patterns.forEach((p, i) => {
    const risk = Math.abs(p.entryPrice - p.stopLoss);
    const reward = Math.abs(p.target - p.entryPrice);

    if (p.direction === 'long') {
      if (p.stopLoss < p.entryPrice && p.target > p.entryPrice) {
        validPrices++;
      } else {
        invalidPrices.push({ id: p.id, issue: 'Long: stop >= entry or target <= entry' });
      }
    } else {
      if (p.stopLoss > p.entryPrice && p.target < p.entryPrice) {
        validPrices++;
      } else {
        invalidPrices.push({ id: p.id, issue: 'Short: stop <= entry or target >= entry' });
      }
    }
  });
  console.log(`   Valid price structures: ${validPrices}/${patterns.length}`);
  if (invalidPrices.length > 0) {
    console.log(`   ❌ Invalid patterns: ${invalidPrices.length}`);
    invalidPrices.slice(0, 5).forEach(inv => {
      console.log(`      ${inv.id}: ${inv.issue}`);
    });
  } else {
    console.log(`   ✅ All price structures valid`);
  }

  // 5. Required fields validation
  console.log('\n5. REQUIRED FIELDS VALIDATION');
  const requiredFields = [
    'id', 'symbol', 'timeframe', 'direction', 'entryTime', 'entryPrice',
    'stopLoss', 'target', 'atr', 'stage1_momentumMove', 'stage2_consolidation',
    'stage3_testBar', 'stage4_hook', 'stage5_reentry', 'hfTrend', 'label'
  ];

  let missingFieldsCount = 0;
  patterns.forEach((p, i) => {
    requiredFields.forEach(field => {
      if (p[field] === undefined || p[field] === null) {
        missingFieldsCount++;
        if (missingFieldsCount <= 5) {
          console.log(`   ❌ Pattern ${i}: Missing field '${field}'`);
        }
      }
    });
  });

  if (missingFieldsCount === 0) {
    console.log(`   ✅ All required fields present in all ${patterns.length} patterns`);
  } else {
    console.log(`   ❌ Found ${missingFieldsCount} missing fields`);
  }

  // 6. COMA confirmation validation
  console.log('\n6. COMA TREND VALIDATION');
  const comaConfirmed = patterns.filter(p => p.hfTrend && p.hfTrend.comaConfirmed);
  console.log(`   Patterns with COMA confirmation: ${comaConfirmed.length}/${patterns.length}`);
  const uptrends = patterns.filter(p => p.hfTrend && p.hfTrend.direction === 'up');
  const downtrends = patterns.filter(p => p.hfTrend && p.hfTrend.direction === 'down');
  console.log(`   Uptrends: ${uptrends.length}`);
  console.log(`   Downtrends: ${downtrends.length}`);

  // 7. Duplicate check
  console.log('\n7. DUPLICATE CHECK');
  const uniqueKeys = new Set();
  let duplicates = 0;
  patterns.forEach(p => {
    const key = `${p.symbol}_${p.entryTime}`;
    if (uniqueKeys.has(key)) {
      duplicates++;
    } else {
      uniqueKeys.add(key);
    }
  });
  if (duplicates === 0) {
    console.log(`   ✅ No duplicates found (all ${patterns.length} patterns unique)`);
  } else {
    console.log(`   ❌ Found ${duplicates} duplicate patterns`);
  }

  // 8. Stage validation
  console.log('\n8. STAGE STRUCTURE VALIDATION');
  let validStages = 0;
  patterns.forEach(p => {
    const hasStage1 = p.stage1_momentumMove && p.stage1_momentumMove.sizeInATR >= 1.5;
    const hasStage2 = p.stage2_consolidation && p.stage2_consolidation.barCount >= 20;
    const hasStage3 = p.stage3_testBar && p.stage3_testBar.sizeInATR >= 1.5;
    const hasStage4 = p.stage4_hook && p.stage4_hook.closesBeyondTB !== undefined;
    const hasStage5 = p.stage5_reentry && p.stage5_reentry.breaksConsolidation !== undefined;

    if (hasStage1 && hasStage2 && hasStage3 && hasStage4 && hasStage5) {
      validStages++;
    }
  });
  console.log(`   Valid Gecko 5-stage patterns: ${validStages}/${patterns.length}`);

  // 9. Label validation
  console.log('\n9. LABEL VALIDATION');
  const validLabels = patterns.filter(p => p.label === 'winner' || p.label === 'loser');
  console.log(`   Valid labels (winner/loser): ${validLabels.length}/${patterns.length}`);
  const withDetails = patterns.filter(p => {
    if (p.label === 'winner') {
      return p.labelDetails && p.labelDetails.targetHitBar !== undefined;
    } else {
      return p.labelDetails && p.labelDetails.stopHitBar !== undefined;
    }
  });
  console.log(`   Patterns with label details: ${withDetails.length}/${patterns.length}`);

  // Final verdict
  console.log('\n=== VALIDATION VERDICT ===');
  const allChecks = [
    { name: 'Pattern count >= 200', pass: patterns.length >= 200 },
    { name: 'Winner/loser distribution balanced', pass: winners.length >= 100 && losers.length >= 100 },
    { name: 'No duplicates', pass: duplicates === 0 },
    { name: 'All required fields present', pass: missingFieldsCount === 0 },
    { name: 'All prices valid', pass: invalidPrices.length === 0 },
    { name: 'All stages valid', pass: validStages === patterns.length },
    { name: 'All labels valid', pass: validLabels.length === patterns.length },
    { name: 'Average R:R >= 2:1', pass: avgRR >= 2.0 }
  ];

  allChecks.forEach(check => {
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
  });

  const allPassed = allChecks.every(c => c.pass);
  console.log(`\nOverall: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

  return allPassed;
}

// Run validation
const passed = validateDataset();
process.exit(passed ? 0 : 1);
