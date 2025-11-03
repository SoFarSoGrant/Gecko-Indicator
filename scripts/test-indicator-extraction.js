#!/usr/bin/env node

/**
 * Indicator Extraction Diagnostic Test
 *
 * Tests how to properly extract indicator values from TradingView charts
 * and studies. Helps diagnose why indicators are showing as N/A.
 *
 * Run: node scripts/test-indicator-extraction.js
 */

import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

const configModule = await import('../src/config/index.js');
const { config } = configModule;

const { DataCollector } = await import('../src/data/collector.js');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/indicator-test.log' }),
  ],
});

const SYMBOL = 'BTCUSDT';
const TIMEFRAME = '5m';
const TEST_DURATION = 30000; // 30 seconds

async function main() {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('    INDICATOR EXTRACTION DIAGNOSTIC TEST');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info(`Symbol: ${SYMBOL}, Timeframe: ${TIMEFRAME}`);
  logger.info('');

  const collector = new DataCollector(config, logger);

  try {
    logger.info('Starting DataCollector...');
    await collector.start();
    logger.info('✓ DataCollector started');
    logger.info('');

    logger.info(`Subscribing to ${SYMBOL} ${TIMEFRAME}...`);

    // Track raw study data for debugging
    const studyDebugInfo = {
      hasStudies: false,
      studyCount: 0,
      periodCounts: {},
      sampleValues: {},
    };

    const onUpdate = (candle) => {
      if (candle) {
        logger.info(`Candle received:`);
        logger.info(`  Time: ${new Date(candle.time * 1000).toISOString()}`);
        logger.info(`  Close: $${candle.close.toFixed(2)}`);
        logger.info(`  Indicators: ${JSON.stringify(candle.indicators)}`);
        logger.info('');
      }
    };

    await collector.subscribeRealtimeData(SYMBOL, TIMEFRAME, onUpdate);
    logger.info(`✓ Subscribed to ${SYMBOL} ${TIMEFRAME}`);
    logger.info('');

    // Give it a moment for charts and indicators to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Inspect internal state of collector
    logger.info('DIAGNOSTIC: Inspecting collector internal state...');
    const key = `${SYMBOL}_${TIMEFRAME}`;
    const studies = collector.studies;
    const data = collector.getData(SYMBOL, TIMEFRAME);

    logger.info(`Chart has ${collector.charts.size} active charts`);
    logger.info(`Studies registered: ${studies.size}`);
    logger.info(`Data points collected: ${data.length}`);
    logger.info('');

    // List all studies
    logger.info('DIAGNOSTIC: Studies attached to this symbol/timeframe:');
    for (const [studyKey, study] of studies) {
      if (studyKey.includes(key)) {
        logger.info(`  Study Key: ${studyKey}`);
        logger.info(`    - Has periods: ${study.periods ? 'YES' : 'NO'}`);
        if (study.periods) {
          logger.info(`    - Period count: ${study.periods.length}`);
          if (study.periods.length > 0) {
            logger.info(`    - First period value: ${study.periods[0].value || 'undefined'}`);
            logger.info(`    - First period data: ${JSON.stringify(study.periods[0]).substring(0, 100)}`);
          }
        }
        logger.info(`    - Study object keys: ${Object.keys(study).join(', ')}`);
        logger.info('');
      }
    }

    // Check chart object structure
    const chart = collector.charts.get(key);
    if (chart) {
      logger.info('DIAGNOSTIC: Chart object structure:');
      logger.info(`  - Chart keys: ${Object.keys(chart).join(', ')}`);
      logger.info(`  - Periods length: ${chart.periods ? chart.periods.length : 'N/A'}`);
      if (chart.periods && chart.periods.length > 0) {
        logger.info(`  - First period keys: ${Object.keys(chart.periods[0]).join(', ')}`);
        logger.info(`  - First period: ${JSON.stringify(chart.periods[0]).substring(0, 150)}`);
      }
      logger.info('');
    }

    logger.info('Collecting data for 30 seconds to observe indicator values...');
    logger.info('');

    await new Promise(resolve => setTimeout(resolve, TEST_DURATION));

    // Print final state
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('FINAL DIAGNOSTIC REPORT');
    logger.info('═══════════════════════════════════════════════════════════════');

    const finalData = collector.getData(SYMBOL, TIMEFRAME);
    logger.info(`Total candles collected: ${finalData.length}`);

    if (finalData.length > 0) {
      logger.info(`Latest candle:`);
      const latest = finalData[finalData.length - 1];
      logger.info(`  Time: ${new Date(latest.time * 1000).toISOString()}`);
      logger.info(`  OHLCV: O=${latest.open}, H=${latest.high}, L=${latest.low}, C=${latest.close}, V=${latest.volume}`);
      logger.info(`  Indicators: ${JSON.stringify(latest.indicators)}`);
    }

    // Sample a few candles with indicators
    logger.info('');
    logger.info('Sample of collected data (last 5 candles):');
    const sampleSize = Math.min(5, finalData.length);
    for (let i = Math.max(0, finalData.length - sampleSize); i < finalData.length; i++) {
      const candle = finalData[i];
      const indicatorStr = Object.keys(candle.indicators).length > 0
        ? `Indicators: ${Object.entries(candle.indicators).map(([k, v]) => `${k}=${v}`).join(', ')}`
        : 'NO INDICATORS';
      logger.info(`  [${i}] ${new Date(candle.time * 1000).toISOString()} | Close: $${candle.close.toFixed(2)} | ${indicatorStr}`);
    }

    logger.info('');
    logger.info('Stopping DataCollector...');
    await collector.stop();
    logger.info('✓ DataCollector stopped');

  } catch (error) {
    logger.error('Test failed with error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
