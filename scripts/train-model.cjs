#!/usr/bin/env node
/**
 * Model Training Script - Phase 4
 *
 * Trains the Gecko pattern classifier using TensorFlow.js.
 * Can use either real historical data or synthetic data for testing.
 *
 * Usage:
 *   node scripts/train-model.cjs [options]
 *
 * Options:
 *   --synthetic    Use synthetic data for testing (default: true if no real data)
 *   --epochs       Number of training epochs (default: 100)
 *   --batch-size   Batch size (default: 32)
 *   --learning-rate Learning rate (default: 0.001)
 *   --save-path    Path to save model (default: ./data/models/gecko-pattern-classifier)
 *
 * Examples:
 *   npm run train:model
 *   node scripts/train-model.cjs --synthetic --epochs 50
 *   node scripts/train-model.cjs --batch-size 64 --learning-rate 0.0005
 *
 * @module scripts/train-model
 */

const { ModelPredictor } = require('../src/models/predictor.cjs');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

// Mock config
const config = {
  model: {
    path: './data/models/gecko-pattern-classifier/model.json',
    minConfidence: 0.7,
  },
};

/**
 * Generate synthetic dataset for testing
 *
 * Creates a dataset where patterns are either "winners" or "losers" based on
 * simplified feature patterns. This allows testing the training pipeline
 * without real historical data.
 *
 * Winner patterns:
 * - Higher EMA alignment (COMA trends)
 * - Stronger consolidation touches
 * - Better momentum indicators
 * - Higher volume ratios
 *
 * Loser patterns:
 * - Weaker or opposite trends
 * - Poor consolidation quality
 * - Negative momentum
 * - Lower volume
 *
 * @param {number} numSamples - Total number of patterns to generate
 * @param {number} winnerRatio - Ratio of winners to losers (0-1, default 0.5)
 * @returns {Object} Dataset with features and labels
 */
function generateSyntheticDataset(numSamples = 300, winnerRatio = 0.5) {
  logger.info(`Generating synthetic dataset with ${numSamples} samples`);

  const features = [];
  const labels = [];

  const numWinners = Math.floor(numSamples * winnerRatio);
  const numLosers = numSamples - numWinners;

  // Generate winner patterns
  for (let i = 0; i < numWinners; i++) {
    const pattern = generateWinnerPattern();
    features.push(pattern);
    labels.push([0, 1]); // One-hot: [loser, winner]
  }

  // Generate loser patterns
  for (let i = 0; i < numLosers; i++) {
    const pattern = generateLoserPattern();
    features.push(pattern);
    labels.push([1, 0]); // One-hot: [loser, winner]
  }

  // Shuffle dataset
  const shuffled = shuffleArrays(features, labels);

  logger.info(
    `Dataset generated: ${numWinners} winners, ${numLosers} losers`
  );

  return {
    features: shuffled.features,
    labels: shuffled.labels,
  };
}

/**
 * Generate a "winner" pattern with favorable characteristics
 */
function generateWinnerPattern() {
  const pattern = new Array(62);

  // Price features (0-11): Moderate values with bullish bias
  pattern[0] = randomRange(0.4, 0.6); // close
  pattern[1] = randomRange(0.35, 0.55); // open
  pattern[2] = randomRange(0.45, 0.65); // high
  pattern[3] = randomRange(0.3, 0.5); // low
  pattern[4] = randomRange(0.6, 0.9); // volume (higher for winners)
  pattern[5] = randomRange(0.4, 0.6); // range
  pattern[6] = randomRange(0.5, 0.8); // body (strong candle)
  pattern[7] = randomRange(0.1, 0.3); // upper_wick
  pattern[8] = randomRange(0.1, 0.3); // lower_wick
  pattern[9] = randomRange(0.4, 0.6); // hl2
  pattern[10] = randomRange(0.4, 0.6); // hlc3
  pattern[11] = randomRange(0.6, 0.9); // body_percent (strong body)

  // EMA features (12-26): Bullish alignment
  for (let i = 12; i < 27; i++) {
    pattern[i] = randomRange(0.4, 0.7);
  }

  // Consolidation features (27-38): Good quality
  pattern[27] = randomRange(0.4, 0.6); // consolidation_level
  pattern[28] = randomRange(0.2, 0.4); // consolidation_range (tight)
  pattern[29] = randomRange(0.1, 0.3); // price_distance_from_base (close)
  pattern[30] = randomRange(0.6, 0.9); // touches_to_level (many)
  pattern[31] = randomRange(0.6, 0.9); // touch_density (high)
  pattern[32] = randomRange(0.4, 0.7); // range_ratio
  pattern[33] = randomRange(0.2, 0.4); // volatility_squeeze (low vol)
  pattern[34] = randomRange(0.3, 0.5); // avg_range_last_10
  pattern[35] = randomRange(0.7, 1.0); // has_test_bar (likely)
  pattern[36] = randomRange(0.6, 0.9); // test_bar_strength (strong)
  pattern[37] = randomRange(0.6, 0.9); // test_bar_volume_ratio (high)

  // Trend features (38-49): Strong COMA alignment
  pattern[38] = randomRange(0.8, 1.0); // lf_ema_order_long
  pattern[39] = randomRange(0.0, 0.2); // lf_ema_order_short
  pattern[40] = randomRange(0.7, 1.0); // lf_above_200sma
  pattern[41] = randomRange(0.8, 1.0); // mf_ema_order_long
  pattern[42] = randomRange(0.0, 0.2); // mf_ema_order_short
  pattern[43] = randomRange(0.7, 1.0); // mf_above_200sma
  pattern[44] = randomRange(0.8, 1.0); // hf_ema_order_long
  pattern[45] = randomRange(0.0, 0.2); // hf_ema_order_short
  pattern[46] = randomRange(0.7, 1.0); // hf_above_200sma
  pattern[47] = randomRange(0.8, 1.0); // all_tf_aligned_long
  pattern[48] = randomRange(0.0, 0.2); // all_tf_aligned_short
  pattern[49] = randomRange(0.8, 1.0); // lf_mf_aligned

  // Support/momentum features (50-61): Bullish momentum
  pattern[50] = randomRange(-0.1, 0.2); // distance_to_ema21_mf
  pattern[51] = randomRange(-0.1, 0.2); // distance_to_ema5_hf
  pattern[52] = randomRange(-0.1, 0.2); // distance_to_ema200_mf
  pattern[53] = randomRange(0.7, 1.0); // close_above_ema21_mf
  pattern[54] = randomRange(0.7, 1.0); // close_above_ema5_hf
  pattern[55] = randomRange(0.7, 1.0); // close_above_ema200_mf
  pattern[56] = randomRange(0.6, 0.9); // bars_higher_highs
  pattern[57] = randomRange(0.6, 0.9); // bars_higher_lows
  pattern[58] = randomRange(0.1, 0.3); // bars_lower_highs
  pattern[59] = randomRange(0.6, 1.2); // volume_ratio
  pattern[60] = randomRange(0.02, 0.08); // return_last_5_bars (positive)
  pattern[61] = randomRange(0.03, 0.1); // return_last_10_bars (positive)

  return pattern;
}

/**
 * Generate a "loser" pattern with unfavorable characteristics
 */
function generateLoserPattern() {
  const pattern = new Array(62);

  // Price features: Neutral to bearish
  pattern[0] = randomRange(0.3, 0.5); // close
  pattern[1] = randomRange(0.4, 0.6); // open
  pattern[2] = randomRange(0.45, 0.65); // high
  pattern[3] = randomRange(0.2, 0.4); // low
  pattern[4] = randomRange(0.2, 0.5); // volume (lower)
  pattern[5] = randomRange(0.4, 0.6); // range
  pattern[6] = randomRange(0.2, 0.5); // body (weak)
  pattern[7] = randomRange(0.2, 0.5); // upper_wick (longer)
  pattern[8] = randomRange(0.2, 0.5); // lower_wick
  pattern[9] = randomRange(0.3, 0.5); // hl2
  pattern[10] = randomRange(0.3, 0.5); // hlc3
  pattern[11] = randomRange(0.2, 0.5); // body_percent (weak body)

  // EMA features: No clear alignment
  for (let i = 12; i < 27; i++) {
    pattern[i] = randomRange(0.3, 0.6);
  }

  // Consolidation features: Poor quality
  pattern[27] = randomRange(0.3, 0.6); // consolidation_level
  pattern[28] = randomRange(0.5, 0.8); // consolidation_range (wide)
  pattern[29] = randomRange(0.4, 0.7); // price_distance_from_base (far)
  pattern[30] = randomRange(0.1, 0.4); // touches_to_level (few)
  pattern[31] = randomRange(0.1, 0.4); // touch_density (low)
  pattern[32] = randomRange(0.6, 0.9); // range_ratio
  pattern[33] = randomRange(0.6, 0.9); // volatility_squeeze (high vol)
  pattern[34] = randomRange(0.5, 0.8); // avg_range_last_10
  pattern[35] = randomRange(0.0, 0.4); // has_test_bar (unlikely)
  pattern[36] = randomRange(0.1, 0.4); // test_bar_strength (weak)
  pattern[37] = randomRange(0.2, 0.5); // test_bar_volume_ratio (low)

  // Trend features: Weak or no COMA
  pattern[38] = randomRange(0.0, 0.3); // lf_ema_order_long
  pattern[39] = randomRange(0.0, 0.3); // lf_ema_order_short
  pattern[40] = randomRange(0.2, 0.5); // lf_above_200sma
  pattern[41] = randomRange(0.0, 0.3); // mf_ema_order_long
  pattern[42] = randomRange(0.0, 0.3); // mf_ema_order_short
  pattern[43] = randomRange(0.2, 0.5); // mf_above_200sma
  pattern[44] = randomRange(0.0, 0.3); // hf_ema_order_long
  pattern[45] = randomRange(0.0, 0.3); // hf_ema_order_short
  pattern[46] = randomRange(0.2, 0.5); // hf_above_200sma
  pattern[47] = randomRange(0.0, 0.2); // all_tf_aligned_long
  pattern[48] = randomRange(0.0, 0.2); // all_tf_aligned_short
  pattern[49] = randomRange(0.0, 0.3); // lf_mf_aligned

  // Support/momentum features: Bearish momentum
  pattern[50] = randomRange(-0.3, 0.1); // distance_to_ema21_mf
  pattern[51] = randomRange(-0.3, 0.1); // distance_to_ema5_hf
  pattern[52] = randomRange(-0.3, 0.1); // distance_to_ema200_mf
  pattern[53] = randomRange(0.0, 0.4); // close_above_ema21_mf
  pattern[54] = randomRange(0.0, 0.4); // close_above_ema5_hf
  pattern[55] = randomRange(0.0, 0.4); // close_above_ema200_mf
  pattern[56] = randomRange(0.1, 0.3); // bars_higher_highs
  pattern[57] = randomRange(0.1, 0.3); // bars_higher_lows
  pattern[58] = randomRange(0.6, 0.9); // bars_lower_highs
  pattern[59] = randomRange(0.3, 0.8); // volume_ratio
  pattern[60] = randomRange(-0.08, 0.01); // return_last_5_bars (negative)
  pattern[61] = randomRange(-0.1, 0.02); // return_last_10_bars (negative)

  return pattern;
}

/**
 * Random value in range [min, max]
 */
function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Shuffle two arrays in sync
 */
function shuffleArrays(arr1, arr2) {
  const indices = arr1.map((_, i) => i);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return {
    features: indices.map((i) => arr1[i]),
    labels: indices.map((i) => arr2[i]),
  };
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    synthetic: true,
    epochs: 100,
    batchSize: 32,
    learningRate: 0.001,
    savePath: './data/models/gecko-pattern-classifier',
    numSamples: 300,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--synthetic':
        options.synthetic = true;
        break;
      case '--epochs':
        options.epochs = parseInt(args[++i]);
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--learning-rate':
        options.learningRate = parseFloat(args[++i]);
        break;
      case '--save-path':
        options.savePath = args[++i];
        break;
      case '--num-samples':
        options.numSamples = parseInt(args[++i]);
        break;
      case '--help':
        console.log(`
Model Training Script - Phase 4

Usage: node scripts/train-model.cjs [options]

Options:
  --synthetic         Use synthetic data for testing (default: true)
  --epochs <n>        Number of training epochs (default: 100)
  --batch-size <n>    Batch size (default: 32)
  --learning-rate <f> Learning rate (default: 0.001)
  --save-path <path>  Path to save model (default: ./data/models/gecko-pattern-classifier)
  --num-samples <n>   Number of synthetic samples (default: 300)
  --help              Show this help message

Examples:
  npm run train:model
  node scripts/train-model.cjs --synthetic --epochs 50
  node scripts/train-model.cjs --batch-size 64 --learning-rate 0.0005
        `);
        process.exit(0);
    }
  }

  return options;
}

/**
 * Main training function
 */
async function main() {
  try {
    logger.info('='.repeat(60));
    logger.info('Gecko Pattern Classifier - Model Training');
    logger.info('Phase 4: Model Training');
    logger.info('='.repeat(60));

    // Parse arguments
    const options = parseArgs();

    logger.info('Training Configuration:');
    logger.info(`  Data Source: ${options.synthetic ? 'Synthetic' : 'Real'}`);
    logger.info(`  Epochs: ${options.epochs}`);
    logger.info(`  Batch Size: ${options.batchSize}`);
    logger.info(`  Learning Rate: ${options.learningRate}`);
    logger.info(`  Save Path: ${options.savePath}`);
    if (options.synthetic) {
      logger.info(`  Samples: ${options.numSamples}`);
    }
    logger.info('');

    // Load or generate dataset
    let dataset;
    if (options.synthetic) {
      dataset = generateSyntheticDataset(options.numSamples);
    } else {
      // TODO: Implement real data loading from historical patterns
      logger.error('Real data loading not yet implemented');
      logger.info('Please use --synthetic flag to train with synthetic data');
      process.exit(1);
    }

    // Create predictor
    const predictor = new ModelPredictor(config, logger);

    // Build model with custom hyperparameters
    predictor.buildModel({
      learningRate: options.learningRate,
    });

    logger.info('');
    logger.info('Starting training...');
    logger.info('-'.repeat(60));

    // Train model
    const result = await predictor.trainModel(dataset, {
      epochs: options.epochs,
      batchSize: options.batchSize,
      verbose: 0, // Suppress TensorFlow logs (we use custom logging)
    });

    logger.info('-'.repeat(60));
    logger.info('Training Complete!');
    logger.info('');

    // Print results
    logger.info('Final Training Metrics:');
    logger.info(`  Epochs Completed: ${result.epochs}`);
    logger.info(
      `  Training Loss: ${result.metrics.trainLoss.toFixed(4)}`
    );
    logger.info(
      `  Training Accuracy: ${(result.metrics.trainAccuracy * 100).toFixed(2)}%`
    );
    logger.info(
      `  Validation Loss: ${result.metrics.valLoss.toFixed(4)}`
    );
    logger.info(
      `  Validation Accuracy: ${(result.metrics.valAccuracy * 100).toFixed(2)}%`
    );
    logger.info('');
    logger.info('Test Set Metrics:');
    logger.info(
      `  Test Loss: ${result.metrics.testLoss.toFixed(4)}`
    );
    logger.info(
      `  Test Accuracy: ${(result.metrics.testAccuracy * 100).toFixed(2)}%`
    );
    logger.info(`  Test AUC: ${result.metrics.testAUC.toFixed(4)}`);
    logger.info('');

    // Check Phase 4 gate
    if (result.gatePassed.passed) {
      logger.info('Phase 4 Success Gate: PASSED');
      logger.info('  Validation Accuracy >= 70%: YES');
      logger.info('  Test AUC >= 0.75: YES');
    } else {
      logger.warn('Phase 4 Success Gate: FAILED');
      logger.warn(
        `  Validation Accuracy >= 70%: ${result.gatePassed.criteria.validationAccuracy.passed ? 'YES' : 'NO'}`
      );
      logger.warn(
        `  Test AUC >= 0.75: ${result.gatePassed.criteria.testAUC.passed ? 'YES' : 'NO'}`
      );
      logger.info('');
      logger.info('Recommendations:');
      if (!result.gatePassed.criteria.validationAccuracy.passed) {
        logger.info('  - Increase model capacity (more layers or neurons)');
        logger.info('  - Reduce dropout rates');
        logger.info('  - Increase training epochs');
        logger.info('  - Adjust learning rate (try 0.0005 or 0.005)');
      }
      if (!result.gatePassed.criteria.testAUC.passed) {
        logger.info('  - Check for class imbalance in dataset');
        logger.info('  - Increase regularization (L2 or dropout)');
        logger.info('  - Use class weights during training');
      }
    }

    logger.info('');

    // Save model
    logger.info(`Saving model to ${options.savePath}...`);
    await predictor.saveModel(options.savePath);
    logger.info('Model saved successfully!');

    logger.info('');
    logger.info('Model Files:');
    logger.info(`  ${options.savePath}/model.json`);
    logger.info(`  ${options.savePath}/weights.bin`);
    logger.info(`  ${options.savePath}/metadata.json`);
    logger.info(`  ${options.savePath}/training-history.json`);

    logger.info('');
    logger.info('='.repeat(60));
    logger.info('Training session complete!');
    logger.info('='.repeat(60));

    process.exit(result.gatePassed.passed ? 0 : 1);
  } catch (error) {
    logger.error('Training failed:', error);
    process.exit(1);
  }
}

// Run main
if (require.main === module) {
  main();
}

module.exports = {
  generateSyntheticDataset,
  generateWinnerPattern,
  generateLoserPattern,
};
