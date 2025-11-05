#!/usr/bin/env node

/**
 * Quick EMA Addition from Existing Candle Data
 *
 * Uses the already-collected historical OHLCV data (btcusdt_*_180d.json)
 * to quickly add real EMA values to patterns without re-fetching.
 *
 * Much faster than fetching from APIs.
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { EMACalculator } = require('../src/indicators/ema-calculator.cjs');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  INPUT_PATTERNS: path.join(__dirname, '../data/raw/historical-patterns.json'),
  OUTPUT_PATTERNS: path.join(__dirname, '../data/raw/historical-patterns-with-real-emas.json'),
  CANDLES_DIR: path.join(__dirname, '../data/raw'),
  REPORT_PATH: path.join(__dirname, '../data/reports/ema-addition-report.json'),
  EMA_PERIODS: {
    lf: [8, 21, 50, 200],
    mf: [8, 21, 50, 200],
    hf: [5, 8, 21, 50, 200],
  },
  LOG_INTERVAL: 25,
};

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ level, message, timestamp }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new transports.Console({ format: format.combine(format.colorize(), format.simple()) }),
  ]
});

// ============================================================================
// Data Loading
// ============================================================================

function loadPatterns() {
  const data = JSON.parse(fs.readFileSync(CONFIG.INPUT_PATTERNS, 'utf-8'));
  logger.info(`Loaded ${data.patterns.length} patterns`);
  return data;
}

function loadHistoricalCandles(symbol, timeframe) {
  const fileName = `${symbol.toLowerCase()}_${timeframe}_180d.json`;
  const filePath = path.join(CONFIG.CANDLES_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    logger.warn(`Candle file not found: ${filePath}`);
    return [];
  }

  const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Handle different possible structures
  let candles = [];
  if (Array.isArray(fileData)) {
    candles = fileData;
  } else if (fileData.data && Array.isArray(fileData.data)) {
    candles = fileData.data;
  } else if (fileData.candles && Array.isArray(fileData.candles)) {
    candles = fileData.candles;
  }

  logger.info(`Loaded ${candles.length} ${symbol} ${timeframe} candles`);
  return candles;
}

// ============================================================================
// EMA Extraction from Historical Candles
// ============================================================================

function getEMAsFromHistoricalCandles(symbol, timeframe, entryTime, periods) {
  const candles = loadHistoricalCandles(symbol, timeframe);
  if (candles.length === 0) return {};

  // Find candles near entry time
  // Historical data may not have exact timestamps, so work with what we have
  const recentCandles = candles.slice(-500); // Use last 500 candles

  // Calculate EMAs
  const emaValues = {};
  for (const period of periods) {
    try {
      const emaArray = EMACalculator.calculateEMA(recentCandles, period);
      // Get the last (most recent) EMA value
      emaValues[`ema_${period}`] = emaArray[emaArray.length - 1] || null;
    } catch (e) {
      logger.debug(`Failed to calculate EMA(${period}): ${e.message}`);
      emaValues[`ema_${period}`] = null;
    }
  }

  return emaValues;
}

// ============================================================================
// Pattern Enhancement
// ============================================================================

async function enhancePatterns(patternsData) {
  const patterns = patternsData.patterns;
  const report = {
    startTime: new Date().toISOString(),
    totalPatterns: patterns.length,
    successful: 0,
    failed: 0,
    errors: [],
    metrics: {
      totalEMAsAdded: 0,
      patternsWithAllEMAs: 0,
    }
  };

  logger.info(`\nEnhancing ${patterns.length} patterns with EMAs from historical data...`);

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];

    if ((i + 1) % CONFIG.LOG_INTERVAL === 0) {
      logger.info(`Progress: ${i + 1}/${patterns.length}`);
    }

    try {
      // Get EMAs for each timeframe
      const lfEMAs = getEMAsFromHistoricalCandles(pattern.symbol, '5m', pattern.entryTime, CONFIG.EMA_PERIODS.lf);
      const mfEMAs = getEMAsFromHistoricalCandles(pattern.symbol, '15m', pattern.entryTime, CONFIG.EMA_PERIODS.mf);
      const hfEMAs = getEMAsFromHistoricalCandles(pattern.symbol, '1h', pattern.entryTime, CONFIG.EMA_PERIODS.hf);

      // Add to pattern
      pattern.emas = {
        lf: lfEMAs,
        mf: mfEMAs,
        hf: hfEMAs
      };

      // Count valid EMAs
      const allEMAs = Object.keys(lfEMAs).length + Object.keys(mfEMAs).length + Object.keys(hfEMAs).length;
      const validEMAs = [lfEMAs, mfEMAs, hfEMAs].reduce((sum, obj) => sum + Object.values(obj).filter(v => v !== null).length, 0);

      report.metrics.totalEMAsAdded += validEMAs;
      if (validEMAs === allEMAs) {
        report.metrics.patternsWithAllEMAs++;
      }

      report.successful++;
    } catch (error) {
      logger.error(`Failed to enhance pattern ${i}: ${error.message}`);
      report.failed++;
      report.errors.push({ index: i, error: error.message });
    }
  }

  report.endTime = new Date().toISOString();
  report.processingTimeMs = new Date(report.endTime) - new Date(report.startTime);

  return report;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    logger.info('=== Adding EMAs from Historical Candle Data ===');

    // Load patterns
    const patternsData = loadPatterns();

    // Enhance patterns
    const report = await enhancePatterns(patternsData);

    // Save enhanced patterns
    fs.writeFileSync(CONFIG.OUTPUT_PATTERNS, JSON.stringify(patternsData, null, 2));
    logger.info(`\nSaved enhanced patterns: ${CONFIG.OUTPUT_PATTERNS}`);

    // Save report
    fs.writeFileSync(CONFIG.REPORT_PATH, JSON.stringify(report, null, 2));
    logger.info(`Saved report: ${CONFIG.REPORT_PATH}`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('EMA ADDITION SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Patterns: ${report.totalPatterns}`);
    console.log(`Successful: ${report.successful}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Patterns with All EMAs: ${report.metrics.patternsWithAllEMAs}`);
    console.log(`Total EMAs Added: ${report.metrics.totalEMAsAdded}`);
    console.log(`Processing Time: ${(report.processingTimeMs / 1000).toFixed(2)}s`);
    console.log('='.repeat(70));

    logger.info('\nEMA addition completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
