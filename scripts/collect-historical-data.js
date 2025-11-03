#!/usr/bin/env node

/**
 * Historical Data Collection Script
 *
 * Collects 6+ months of historical OHLCV + indicator data from TradingView
 * for all configured symbols and stores it for Phase 3 feature engineering.
 *
 * Usage: node scripts/collect-historical-data.js
 *        node scripts/collect-historical-data.js [symbols]
 *        node scripts/collect-historical-data.js BTCUSDT,ETHUSDT
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

const configModule = await import('../src/config/index.js');
const { config } = configModule;

const { DataCollector } = await import('../src/data/collector.js');

// Configuration
const SYMBOLS = process.argv[2]
  ? process.argv[2].split(',')
  : (config.data?.symbols || 'BTCUSDT,ETHUSDT,EURUSD,GBPUSD,SPY').split(',');

const TIMEFRAMES = ['5m', '15m', '1h'];

// Collect 6+ months of data (180 days)
const COLLECTION_DAYS = 180;
const END_DATE = new Date();
const START_DATE = new Date(END_DATE.getTime() - COLLECTION_DAYS * 24 * 60 * 60 * 1000);

// Data directory
const DATA_DIR = './data/raw';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/historical-collection.log' }),
  ],
});

async function main() {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('    GECKO ML INDICATOR - HISTORICAL DATA COLLECTION');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info(`Symbols: ${SYMBOLS.join(', ')}`);
  logger.info(`Timeframes: ${TIMEFRAMES.join(', ')}`);
  logger.info(`Period: ${START_DATE.toISOString()} to ${END_DATE.toISOString()}`);
  logger.info(`Duration: ${COLLECTION_DAYS} days (~6 months)`);
  logger.info('');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    logger.info(`Created data directory: ${DATA_DIR}`);
  }

  const collector = new DataCollector(config, logger);
  const results = [];

  try {
    logger.info('Starting DataCollector...');
    await collector.start();
    logger.info('✓ DataCollector started');
    logger.info('');

    // Collect data for each symbol and timeframe
    for (const symbol of SYMBOLS) {
      logger.info(`═══════════════════════════════════════════════════════════════`);
      logger.info(`Collecting data for ${symbol}`);
      logger.info(`═══════════════════════════════════════════════════════════════`);

      for (const timeframe of TIMEFRAMES) {
        logger.info(`  ${symbol} ${timeframe}: collecting...`);

        try {
          const data = await collector.collectHistoricalData(
            symbol,
            timeframe,
            START_DATE,
            END_DATE
          );

          logger.info(`  ${symbol} ${timeframe}: ✓ collected ${data.length} candles`);

          // Validate completeness
          const expectedCandles = calculateExpectedCandles(COLLECTION_DAYS, timeframe);
          const completeness = ((data.length / expectedCandles) * 100).toFixed(2);
          logger.info(`  ${symbol} ${timeframe}: completeness ${completeness}%`);

          // Check indicator quality
          const withIndicators = data.filter(c => Object.keys(c.indicators).length > 0).length;
          const indicatorQuality = ((withIndicators / data.length) * 100).toFixed(2);
          logger.info(`  ${symbol} ${timeframe}: indicators ${indicatorQuality}%`);

          // Save to file
          const filename = `${symbol.toLowerCase()}_${timeframe}_${COLLECTION_DAYS}d.json`;
          const filepath = path.join(DATA_DIR, filename);

          fs.writeFileSync(filepath, JSON.stringify({
            symbol,
            timeframe,
            startDate: START_DATE.toISOString(),
            endDate: END_DATE.toISOString(),
            durationDays: COLLECTION_DAYS,
            candleCount: data.length,
            expectedCandles,
            completeness: parseFloat(completeness),
            indicatorQuality: parseFloat(indicatorQuality),
            data,
          }, null, 2));

          logger.info(`  ${symbol} ${timeframe}: ✓ saved to ${filename}`);

          results.push({
            symbol,
            timeframe,
            candleCount: data.length,
            expectedCandles,
            completeness: parseFloat(completeness),
            indicatorQuality: parseFloat(indicatorQuality),
            status: completeness >= 99.5 ? 'PASS' : 'WARN',
          });

        } catch (error) {
          logger.error(`  ${symbol} ${timeframe}: ✗ ERROR - ${error.message}`);
          results.push({
            symbol,
            timeframe,
            status: 'FAILED',
            error: error.message,
          });
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('');
    }

    // Print summary
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('COLLECTION SUMMARY');
    logger.info('═══════════════════════════════════════════════════════════════');

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const result of results) {
      if (result.status === 'PASS') {
        passCount++;
        logger.info(`✓ ${result.symbol} ${result.timeframe}: ${result.candleCount} candles (${result.completeness}% complete)`);
      } else if (result.status === 'WARN') {
        warnCount++;
        logger.warn(`⚠ ${result.symbol} ${result.timeframe}: ${result.candleCount} candles (${result.completeness}% complete) - below 99.5%`);
      } else {
        failCount++;
        logger.error(`✗ ${result.symbol} ${result.timeframe}: ${result.error}`);
      }
    }

    logger.info('');
    logger.info(`Summary: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAILED (${results.length} total)`);
    logger.info('');

    // Save summary
    const summaryPath = path.join(DATA_DIR, '_collection_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
      collectionDate: new Date().toISOString(),
      period: {
        start: START_DATE.toISOString(),
        end: END_DATE.toISOString(),
        durationDays: COLLECTION_DAYS,
      },
      results,
      summary: {
        total: results.length,
        passed: passCount,
        warned: warnCount,
        failed: failCount,
      },
    }, null, 2));

    logger.info(`✓ Summary saved to ${summaryPath}`);
    logger.info('');
    logger.info('Historical data collection complete!');
    logger.info('Files ready for Phase 3 Feature Engineering');

  } catch (error) {
    logger.error('Collection failed with error:', error);
    process.exit(1);
  } finally {
    logger.info('Stopping DataCollector...');
    await collector.stop();
    logger.info('✓ DataCollector stopped');
  }
}

/**
 * Calculate expected number of candles based on timeframe
 * @param {number} days - Number of days
 * @param {string} timeframe - Timeframe (5m, 15m, 1h, etc.)
 * @returns {number} Expected candle count
 */
function calculateExpectedCandles(days, timeframe) {
  let minutesPerCandle;

  switch (timeframe) {
    case '1m':
      minutesPerCandle = 1;
      break;
    case '5m':
      minutesPerCandle = 5;
      break;
    case '15m':
      minutesPerCandle = 15;
      break;
    case '30m':
      minutesPerCandle = 30;
      break;
    case '1h':
      minutesPerCandle = 60;
      break;
    case '4h':
      minutesPerCandle = 240;
      break;
    case '1D':
      minutesPerCandle = 1440;
      break;
    default:
      minutesPerCandle = 60;
  }

  // Assume ~24 hours of trading per day (crypto, forex are 24/5)
  // For stocks, assume ~6.5 hours per day
  const hoursPerDay = timeframe.includes('1D') ? 24 : (timeframe === '1h' || timeframe.match(/\d+h/) ? 24 : 6.5);
  const minutesPerDay = hoursPerDay * 60;

  return Math.floor((days * minutesPerDay) / minutesPerCandle);
}

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
