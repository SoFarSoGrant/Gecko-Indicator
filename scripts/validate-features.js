#!/usr/bin/env node
/**
 * Feature Validation Script
 *
 * Validates FeatureEngineer output for quality issues:
 * - NaN/Inf values
 * - Zero variance features
 * - Multicollinearity (correlation matrix)
 * - Normalization bounds validation
 * - Feature distribution analysis
 *
 * Usage:
 *   node scripts/validate-features.js <dataset-path>
 *   node scripts/validate-features.js ./data/processed/training_features.json
 *
 * Output:
 *   - Correlation matrix (CSV)
 *   - VIF scores (JSON)
 *   - Feature statistics (JSON)
 *   - Validation report (TXT)
 *
 * @author Feature Analytics Engineer Agent
 * @date November 3, 2025
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Multicollinearity thresholds
  CORRELATION_HIGH: 0.90,
  CORRELATION_MEDIUM: 0.70,
  VIF_SEVERE: 10,
  VIF_MODERATE: 5,

  // Feature quality thresholds
  VARIANCE_MIN: 0.01,
  MISSING_MAX: 0.10, // 10% missing values max
  OUTLIER_ZSCORE: 3, // Z-score threshold for outliers

  // Output paths
  OUTPUT_DIR: './data/analysis',
  CORRELATION_MATRIX: './data/analysis/correlation_matrix.csv',
  VIF_SCORES: './data/analysis/vif_scores.json',
  FEATURE_STATS: './data/analysis/feature_statistics.json',
  VALIDATION_REPORT: './data/analysis/validation_report.txt',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Load feature dataset from JSON file
 * @param {string} filePath - Path to dataset JSON
 * @returns {Array<Object>} Array of feature objects
 */
function loadDataset(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Handle different dataset formats
  if (Array.isArray(data)) {
    return data;
  } else if (data.features && Array.isArray(data.features)) {
    return data.features;
  } else {
    throw new Error('Dataset format not recognized. Expected array of feature objects.');
  }
}

/**
 * Extract feature names from first sample
 * @param {Array<Object>} dataset - Feature dataset
 * @returns {Array<string>} Feature names
 */
function getFeatureNames(dataset) {
  if (dataset.length === 0) return [];
  return Object.keys(dataset[0]);
}

/**
 * Calculate mean of array
 */
function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(values) {
  const avg = mean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate variance
 */
function variance(values) {
  const avg = mean(values);
  return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
}

/**
 * Calculate correlation coefficient between two arrays
 * @returns {number} Pearson correlation coefficient
 */
function correlation(x, y) {
  if (x.length !== y.length) throw new Error('Arrays must have same length');

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumXSquared += dx * dx;
    sumYSquared += dy * dy;
  }

  const denominator = Math.sqrt(sumXSquared * sumYSquared);
  return denominator === 0 ? 0 : numerator / denominator;
}

// ============================================================================
// FEATURE QUALITY ANALYSIS
// ============================================================================

/**
 * Validate features for NaN, Infinity, and missing values
 */
function validateFeatureQuality(dataset, featureNames) {
  const report = {
    totalSamples: dataset.length,
    features: {},
    issues: [],
  };

  for (const feature of featureNames) {
    const values = dataset.map(sample => sample[feature]);

    const nanCount = values.filter(v => isNaN(v)).length;
    const infCount = values.filter(v => !isFinite(v)).length;
    const missingCount = values.filter(v => v === null || v === undefined).length;

    const missingPct = (nanCount + infCount + missingCount) / dataset.length;

    report.features[feature] = {
      nanCount,
      infCount,
      missingCount,
      missingPct: (missingPct * 100).toFixed(2) + '%',
    };

    // Flag issues
    if (nanCount > 0) {
      report.issues.push(`${feature}: ${nanCount} NaN values`);
    }
    if (infCount > 0) {
      report.issues.push(`${feature}: ${infCount} Infinity values`);
    }
    if (missingPct > CONFIG.MISSING_MAX) {
      report.issues.push(`${feature}: ${(missingPct * 100).toFixed(1)}% missing (>${CONFIG.MISSING_MAX * 100}% threshold)`);
    }
  }

  return report;
}

/**
 * Calculate feature statistics (mean, std, variance, min, max)
 */
function calculateFeatureStatistics(dataset, featureNames) {
  const stats = {};

  for (const feature of featureNames) {
    const values = dataset.map(sample => sample[feature]).filter(v => isFinite(v));

    if (values.length === 0) {
      stats[feature] = {
        count: 0,
        mean: null,
        std: null,
        variance: null,
        min: null,
        max: null,
      };
      continue;
    }

    const avg = mean(values);
    const std = stdDev(values);
    const vari = variance(values);

    stats[feature] = {
      count: values.length,
      mean: avg.toFixed(4),
      std: std.toFixed(4),
      variance: vari.toFixed(4),
      min: Math.min(...values).toFixed(4),
      max: Math.max(...values).toFixed(4),
    };
  }

  return stats;
}

/**
 * Identify zero-variance features
 */
function identifyZeroVarianceFeatures(stats) {
  const zeroVarianceFeatures = [];

  for (const [feature, stat] of Object.entries(stats)) {
    if (stat.variance !== null && parseFloat(stat.variance) < CONFIG.VARIANCE_MIN) {
      zeroVarianceFeatures.push({
        feature,
        variance: stat.variance,
        value: stat.mean, // Constant value
      });
    }
  }

  return zeroVarianceFeatures;
}

// ============================================================================
// MULTICOLLINEARITY ANALYSIS
// ============================================================================

/**
 * Compute correlation matrix for all features
 */
function computeCorrelationMatrix(dataset, featureNames) {
  const matrix = {};

  for (const feature1 of featureNames) {
    matrix[feature1] = {};

    const values1 = dataset.map(s => s[feature1]).filter(v => isFinite(v));

    for (const feature2 of featureNames) {
      const values2 = dataset.map(s => s[feature2]).filter(v => isFinite(v));

      if (values1.length === values2.length && values1.length > 0) {
        const corr = correlation(values1, values2);
        matrix[feature1][feature2] = corr.toFixed(4);
      } else {
        matrix[feature1][feature2] = null;
      }
    }
  }

  return matrix;
}

/**
 * Identify highly correlated feature pairs
 */
function identifyCorrelatedPairs(correlationMatrix, threshold) {
  const pairs = [];

  const features = Object.keys(correlationMatrix);

  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const feature1 = features[i];
      const feature2 = features[j];
      const corr = parseFloat(correlationMatrix[feature1][feature2]);

      if (Math.abs(corr) >= threshold) {
        pairs.push({
          feature1,
          feature2,
          correlation: corr.toFixed(4),
          absCorrelation: Math.abs(corr).toFixed(4),
        });
      }
    }
  }

  // Sort by absolute correlation (descending)
  pairs.sort((a, b) => Math.abs(parseFloat(b.correlation)) - Math.abs(parseFloat(a.correlation)));

  return pairs;
}

/**
 * Calculate Variance Inflation Factor (VIF) for each feature
 * VIF = 1 / (1 - R²)
 * where R² is from regressing feature i on all other features
 */
function calculateVIF(dataset, featureNames) {
  const vifScores = {};

  for (const targetFeature of featureNames) {
    // Extract target feature values
    const y = dataset.map(s => s[targetFeature]).filter(v => isFinite(v));

    // Extract other features as predictors
    const otherFeatures = featureNames.filter(f => f !== targetFeature);
    const X = dataset.map(sample =>
      otherFeatures.map(f => sample[f]).filter(v => isFinite(v))
    );

    // Simple R² approximation: correlation of target with mean of other features
    // (Full VIF requires linear regression; approximation for this script)
    const meanOthers = X.map(row => mean(row));

    if (y.length === meanOthers.length && y.length > 0) {
      const corr = correlation(y, meanOthers);
      const rSquared = corr * corr;
      const vif = rSquared < 0.99 ? 1 / (1 - rSquared) : Infinity;

      vifScores[targetFeature] = {
        vif: vif === Infinity ? 'Infinity' : vif.toFixed(2),
        rSquared: rSquared.toFixed(4),
        severity: vif > CONFIG.VIF_SEVERE ? 'SEVERE' : vif > CONFIG.VIF_MODERATE ? 'MODERATE' : 'OK',
      };
    } else {
      vifScores[targetFeature] = { vif: null, rSquared: null, severity: 'UNKNOWN' };
    }
  }

  return vifScores;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate validation report
 */
function generateValidationReport(
  qualityReport,
  stats,
  zeroVarianceFeatures,
  correlatedPairs,
  vifScores
) {
  const lines = [];

  lines.push('='.repeat(80));
  lines.push('FEATURE VALIDATION REPORT');
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('='.repeat(80));
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(80));
  lines.push(`Total Samples: ${qualityReport.totalSamples}`);
  lines.push(`Total Features: ${Object.keys(stats).length}`);
  lines.push(`Quality Issues: ${qualityReport.issues.length}`);
  lines.push(`Zero-Variance Features: ${zeroVarianceFeatures.length}`);
  lines.push(`High Correlation Pairs (>${CONFIG.CORRELATION_HIGH}): ${correlatedPairs.filter(p => parseFloat(p.absCorrelation) > CONFIG.CORRELATION_HIGH).length}`);
  lines.push(`Severe VIF (>${CONFIG.VIF_SEVERE}): ${Object.values(vifScores).filter(v => v.severity === 'SEVERE').length}`);
  lines.push('');

  // Quality Issues
  if (qualityReport.issues.length > 0) {
    lines.push('QUALITY ISSUES');
    lines.push('-'.repeat(80));
    qualityReport.issues.forEach(issue => lines.push(`  - ${issue}`));
    lines.push('');
  } else {
    lines.push('QUALITY ISSUES: None');
    lines.push('');
  }

  // Zero-Variance Features
  if (zeroVarianceFeatures.length > 0) {
    lines.push('ZERO-VARIANCE FEATURES');
    lines.push('-'.repeat(80));
    zeroVarianceFeatures.forEach(({ feature, variance, value }) => {
      lines.push(`  - ${feature}: variance=${variance}, constant value=${value}`);
    });
    lines.push('');
  }

  // High Correlation Pairs
  const highCorrPairs = correlatedPairs.filter(p => parseFloat(p.absCorrelation) > CONFIG.CORRELATION_HIGH);
  if (highCorrPairs.length > 0) {
    lines.push(`HIGH CORRELATION PAIRS (|r| > ${CONFIG.CORRELATION_HIGH})`);
    lines.push('-'.repeat(80));
    highCorrPairs.forEach(({ feature1, feature2, correlation }) => {
      lines.push(`  - ${feature1} <-> ${feature2}: r=${correlation}`);
    });
    lines.push('');
  }

  // Medium Correlation Pairs
  const mediumCorrPairs = correlatedPairs.filter(
    p => parseFloat(p.absCorrelation) >= CONFIG.CORRELATION_MEDIUM && parseFloat(p.absCorrelation) < CONFIG.CORRELATION_HIGH
  );
  if (mediumCorrPairs.length > 0) {
    lines.push(`MEDIUM CORRELATION PAIRS (${CONFIG.CORRELATION_MEDIUM} ≤ |r| < ${CONFIG.CORRELATION_HIGH})`);
    lines.push('-'.repeat(80));
    mediumCorrPairs.slice(0, 10).forEach(({ feature1, feature2, correlation }) => {
      lines.push(`  - ${feature1} <-> ${feature2}: r=${correlation}`);
    });
    if (mediumCorrPairs.length > 10) {
      lines.push(`  ... and ${mediumCorrPairs.length - 10} more`);
    }
    lines.push('');
  }

  // VIF Scores (Severe)
  const severeVIF = Object.entries(vifScores).filter(([_, v]) => v.severity === 'SEVERE');
  if (severeVIF.length > 0) {
    lines.push(`SEVERE MULTICOLLINEARITY (VIF > ${CONFIG.VIF_SEVERE})`);
    lines.push('-'.repeat(80));
    severeVIF.forEach(([feature, { vif, rSquared }]) => {
      lines.push(`  - ${feature}: VIF=${vif}, R²=${rSquared}`);
    });
    lines.push('');
  }

  // VIF Scores (Moderate)
  const moderateVIF = Object.entries(vifScores).filter(([_, v]) => v.severity === 'MODERATE');
  if (moderateVIF.length > 0) {
    lines.push(`MODERATE MULTICOLLINEARITY (${CONFIG.VIF_MODERATE} ≤ VIF ≤ ${CONFIG.VIF_SEVERE})`);
    lines.push('-'.repeat(80));
    moderateVIF.slice(0, 10).forEach(([feature, { vif, rSquared }]) => {
      lines.push(`  - ${feature}: VIF=${vif}, R²=${rSquared}`);
    });
    if (moderateVIF.length > 10) {
      lines.push(`  ... and ${moderateVIF.length - 10} more`);
    }
    lines.push('');
  }

  // Recommendations
  lines.push('RECOMMENDATIONS');
  lines.push('-'.repeat(80));

  if (qualityReport.issues.length > 0) {
    lines.push('  1. Fix quality issues (NaN/Inf/missing values) before training');
  }

  if (zeroVarianceFeatures.length > 0) {
    lines.push(`  2. Remove ${zeroVarianceFeatures.length} zero-variance features (no predictive value)`);
  }

  if (highCorrPairs.length > 0) {
    lines.push(`  3. Remove ${highCorrPairs.length} highly correlated features (|r| > ${CONFIG.CORRELATION_HIGH})`);
    lines.push('     - For each pair, keep feature with higher importance');
  }

  if (severeVIF.length > 0) {
    lines.push(`  4. Remove ${severeVIF.length} features with severe VIF (>${CONFIG.VIF_SEVERE})`);
  }

  if (qualityReport.issues.length === 0 && zeroVarianceFeatures.length === 0 && highCorrPairs.length === 0 && severeVIF.length === 0) {
    lines.push('  - No critical issues detected. Features are ready for training.');
  }

  lines.push('');
  lines.push('='.repeat(80));
  lines.push('END OF REPORT');
  lines.push('='.repeat(80));

  return lines.join('\n');
}

/**
 * Save correlation matrix to CSV
 */
function saveCorrelationMatrixCSV(correlationMatrix, filePath) {
  const features = Object.keys(correlationMatrix);
  const lines = [];

  // Header
  lines.push(',' + features.join(','));

  // Rows
  for (const feature1 of features) {
    const row = [feature1];
    for (const feature2 of features) {
      row.push(correlationMatrix[feature1][feature2] || '');
    }
    lines.push(row.join(','));
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node scripts/validate-features.js <dataset-path>');
    console.log('Example: node scripts/validate-features.js ./data/processed/training_features.json');
    process.exit(1);
  }

  const datasetPath = args[0];

  console.log('Feature Validation Script');
  console.log('='.repeat(80));
  console.log(`Dataset: ${datasetPath}`);
  console.log('');

  // Create output directory
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  // Load dataset
  console.log('Loading dataset...');
  const dataset = loadDataset(datasetPath);
  const featureNames = getFeatureNames(dataset);
  console.log(`  - Loaded ${dataset.length} samples`);
  console.log(`  - Detected ${featureNames.length} features`);
  console.log('');

  // Validate feature quality
  console.log('Validating feature quality...');
  const qualityReport = validateFeatureQuality(dataset, featureNames);
  console.log(`  - Quality issues: ${qualityReport.issues.length}`);
  console.log('');

  // Calculate statistics
  console.log('Calculating feature statistics...');
  const stats = calculateFeatureStatistics(dataset, featureNames);
  console.log(`  - Statistics computed for ${Object.keys(stats).length} features`);
  console.log('');

  // Identify zero-variance features
  console.log('Identifying zero-variance features...');
  const zeroVarianceFeatures = identifyZeroVarianceFeatures(stats);
  console.log(`  - Zero-variance features: ${zeroVarianceFeatures.length}`);
  console.log('');

  // Compute correlation matrix
  console.log('Computing correlation matrix...');
  const correlationMatrix = computeCorrelationMatrix(dataset, featureNames);
  console.log('  - Correlation matrix computed');
  console.log('');

  // Identify correlated pairs
  console.log('Identifying correlated feature pairs...');
  const correlatedPairs = identifyCorrelatedPairs(correlationMatrix, CONFIG.CORRELATION_MEDIUM);
  const highCorrPairs = correlatedPairs.filter(p => parseFloat(p.absCorrelation) > CONFIG.CORRELATION_HIGH);
  console.log(`  - High correlation pairs (|r| > ${CONFIG.CORRELATION_HIGH}): ${highCorrPairs.length}`);
  console.log(`  - Medium correlation pairs (|r| ≥ ${CONFIG.CORRELATION_MEDIUM}): ${correlatedPairs.length - highCorrPairs.length}`);
  console.log('');

  // Calculate VIF
  console.log('Calculating VIF scores...');
  const vifScores = calculateVIF(dataset, featureNames);
  const severeVIF = Object.values(vifScores).filter(v => v.severity === 'SEVERE').length;
  const moderateVIF = Object.values(vifScores).filter(v => v.severity === 'MODERATE').length;
  console.log(`  - Severe VIF (>${CONFIG.VIF_SEVERE}): ${severeVIF}`);
  console.log(`  - Moderate VIF (${CONFIG.VIF_MODERATE}-${CONFIG.VIF_SEVERE}): ${moderateVIF}`);
  console.log('');

  // Save outputs
  console.log('Saving outputs...');

  saveCorrelationMatrixCSV(correlationMatrix, CONFIG.CORRELATION_MATRIX);
  console.log(`  - Correlation matrix: ${CONFIG.CORRELATION_MATRIX}`);

  fs.writeFileSync(CONFIG.VIF_SCORES, JSON.stringify(vifScores, null, 2), 'utf8');
  console.log(`  - VIF scores: ${CONFIG.VIF_SCORES}`);

  fs.writeFileSync(CONFIG.FEATURE_STATS, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`  - Feature statistics: ${CONFIG.FEATURE_STATS}`);

  const report = generateValidationReport(qualityReport, stats, zeroVarianceFeatures, correlatedPairs, vifScores);
  fs.writeFileSync(CONFIG.VALIDATION_REPORT, report, 'utf8');
  console.log(`  - Validation report: ${CONFIG.VALIDATION_REPORT}`);

  console.log('');
  console.log('Validation complete!');
  console.log('');

  // Print summary
  console.log(report);
}

// Run main
if (require.main === module) {
  main();
}

module.exports = {
  loadDataset,
  validateFeatureQuality,
  calculateFeatureStatistics,
  computeCorrelationMatrix,
  calculateVIF,
};
