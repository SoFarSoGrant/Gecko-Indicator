#!/usr/bin/env node

/**
 * Real-Time Data Collection Test
 *
 * Tests real-time WebSocket collection for BTCUSDT on multiple timeframes.
 * Monitors connection stability and data quality.
 *
 * Run: node scripts/test-realtime-collection.js
 */

import dotenv from 'dotenv';
import winston from 'winston';

// Load environment variables BEFORE importing config
dotenv.config();

// Now import config AFTER env vars are loaded
const configModule = await import('../src/config/index.js');
const { config } = configModule;

// Import other modules
const { DataCollector } = await import('../src/data/collector.js');
const { TrendDetector } = await import('../src/indicators/trend-detector.js');

// Configure logger with detailed output
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
    new winston.transports.File({ filename: 'logs/realtime-test.log' }),
  ],
});

// Test configuration
const SYMBOL = 'BTCUSDT';
const TIMEFRAMES = ['5m', '15m', '1h'];
const TEST_DURATION = 120000; // 2 minutes
const REPORT_INTERVAL = 30000; // 30 seconds

// Collection statistics
const stats = {
  startTime: Date.now(),
  candles: {
    '5m': 0,
    '15m': 0,
    '1h': 0,
  },
  indicators: {
    '5m': { present: 0, missing: 0 },
    '15m': { present: 0, missing: 0 },
    '1h': { present: 0, missing: 0 },
  },
  errors: [],
};

async function main() {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('    GECKO ML INDICATOR - REAL-TIME DATA COLLECTION TEST');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info(`Symbol: ${SYMBOL}`);
  logger.info(`Timeframes: ${TIMEFRAMES.join(', ')}`);
  logger.info(`Test Duration: ${TEST_DURATION / 1000} seconds`);
  logger.info('');
  logger.debug(`Config.tradingView.session: ${config.tradingView.session ? config.tradingView.session.substring(0, 10) + '...' : 'MISSING'}`);
  logger.debug(`Config.tradingView.signature: ${config.tradingView.signature ? config.tradingView.signature.substring(0, 10) + '...' : 'MISSING'}`);

  const collector = new DataCollector(config, logger);
  const detector = new TrendDetector(config, logger);

  try {
    // Start collector
    logger.info('Starting DataCollector...');
    await collector.start();
    logger.info('✓ DataCollector started');
    logger.info('');

    // Subscribe to all timeframes
    logger.info(`Subscribing to ${SYMBOL} on ${TIMEFRAMES.length} timeframes...`);

    for (const timeframe of TIMEFRAMES) {
      const onUpdate = (candle) => {
        if (candle) {
          const key = timeframe;
          stats.candles[key]++;

          // Check indicator presence
          const hasAllIndicators =
            candle.indicators.ema_8 !== undefined &&
            candle.indicators.ema_21 !== undefined &&
            candle.indicators.ema_50 !== undefined &&
            candle.indicators.atr !== undefined;

          if (hasAllIndicators) {
            stats.indicators[key].present++;
          } else {
            stats.indicators[key].missing++;
          }

          // Log candle details
          logger.debug(
            `${SYMBOL} ${timeframe} - ` +
            `Close: ${candle.close.toFixed(2)} | ` +
            `EMA8: ${candle.indicators.ema_8?.toFixed(2) || 'N/A'} | ` +
            `EMA21: ${candle.indicators.ema_21?.toFixed(2) || 'N/A'} | ` +
            `ATR: ${candle.indicators.atr?.toFixed(4) || 'N/A'}`
          );
        }
      };

      try {
        await collector.subscribeRealtimeData(SYMBOL, timeframe, onUpdate);
        logger.info(`✓ Subscribed to ${SYMBOL} ${timeframe}`);
      } catch (error) {
        logger.error(`✗ Failed to subscribe to ${SYMBOL} ${timeframe}: ${error.message}`);
        stats.errors.push(`Subscribe ${timeframe} failed: ${error.message}`);
      }
    }

    logger.info('');
    logger.info('Collecting data... (check logs for incoming candles)');
    logger.info('');

    // Report status periodically
    const reportInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
      logger.info('─────────────────────────────────────────────────────────────────');
      logger.info(`STATUS REPORT (${elapsed}s elapsed)`);
      logger.info('─────────────────────────────────────────────────────────────────');

      for (const timeframe of TIMEFRAMES) {
        const candleCount = stats.candles[timeframe];
        const indicatorStats = stats.indicators[timeframe];
        const totalIndicators = indicatorStats.present + indicatorStats.missing;
        const indicatorQuality = totalIndicators > 0
          ? ((indicatorStats.present / totalIndicators) * 100).toFixed(1)
          : 0;

        logger.info(
          `${SYMBOL} ${timeframe}: ` +
          `${candleCount} candles | ` +
          `Indicators: ${indicatorStats.present}/${totalIndicators} (${indicatorQuality}%)`
        );
      }

      if (stats.errors.length > 0) {
        logger.warn(`Errors: ${stats.errors.length}`);
        stats.errors.slice(-3).forEach(err => logger.warn(`  - ${err}`));
      }

      logger.info('');
    }, REPORT_INTERVAL);

    // Run for specified duration
    await new Promise(resolve => setTimeout(resolve, TEST_DURATION));

    // Clear report interval
    clearInterval(reportInterval);

    // Get final statistics
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('                    FINAL TEST REPORT');
    logger.info('═══════════════════════════════════════════════════════════════');

    const totalElapsed = (Date.now() - stats.startTime) / 1000;
    logger.info(`Total Test Duration: ${totalElapsed.toFixed(1)} seconds`);
    logger.info('');

    // Report by timeframe
    logger.info('DATA COLLECTION RESULTS:');
    logger.info('─────────────────────────────────────────────────────────────────');

    let totalCandles = 0;
    let totalIndicatorQuality = 0;

    for (const timeframe of TIMEFRAMES) {
      const candleCount = stats.candles[timeframe];
      const indicatorStats = stats.indicators[timeframe];
      const totalIndicators = indicatorStats.present + indicatorStats.missing;
      const indicatorQuality = totalIndicators > 0
        ? (indicatorStats.present / totalIndicators) * 100
        : 0;

      const rate = (candleCount / totalElapsed).toFixed(2);

      logger.info(
        `${SYMBOL} ${timeframe}:\n` +
        `  Candles Collected: ${candleCount}\n` +
        `  Collection Rate: ${rate} candles/sec\n` +
        `  Indicator Quality: ${indicatorStats.present}/${totalIndicators} (${indicatorQuality.toFixed(1)}%)\n`
      );

      totalCandles += candleCount;
      totalIndicatorQuality += indicatorQuality;
    }

    logger.info('─────────────────────────────────────────────────────────────────');
    const avgIndicatorQuality = (totalIndicatorQuality / TIMEFRAMES.length).toFixed(1);
    logger.info(`Total Candles: ${totalCandles}`);
    logger.info(`Average Indicator Quality: ${avgIndicatorQuality}%`);
    logger.info('');

    // Validation checks
    logger.info('VALIDATION CHECKS:');
    logger.info('─────────────────────────────────────────────────────────────────');

    const checks = {
      'Data collection started': totalCandles > 0,
      'All timeframes have data': TIMEFRAMES.every(tf => stats.candles[tf] > 0),
      'Indicator quality >95%': avgIndicatorQuality >= 95,
      'No critical errors': stats.errors.length === 0,
    };

    let passCount = 0;
    for (const [check, passed] of Object.entries(checks)) {
      const status = passed ? '✓ PASS' : '✗ FAIL';
      logger.info(`${status}: ${check}`);
      if (passed) passCount++;
    }

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════');
    const result = passCount === Object.keys(checks).length ? 'SUCCESS' : 'PARTIAL SUCCESS';
    logger.info(`OVERALL RESULT: ${result} (${passCount}/${Object.keys(checks).length} checks passed)`);
    logger.info('═══════════════════════════════════════════════════════════════');

    // Stop collector
    logger.info('');
    logger.info('Stopping DataCollector...');
    await collector.stop();
    logger.info('✓ DataCollector stopped');

  } catch (error) {
    logger.error('Test failed with error:', error);
    stats.errors.push(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
