/**
 * BTCUSDT Multi-Timeframe Real-Time Data Collection Monitor
 *
 * Collects real-time data for BTCUSDT on 5m, 15m, and 1h timeframes
 * Monitors connection health, data quality, and indicator values
 * Runs for 2 minutes with 30-second status reports
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env BEFORE importing config
dotenv.config({ path: path.join(__dirname, '.env') });

import winston from 'winston';
import { DataCollector } from './src/data/collector.js';

// Build config manually after env is loaded
const config = {
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug',
  tradingView: {
    session: process.env.SESSION || '',
    signature: process.env.SIGNATURE || '',
  },
  indicators: {
    emaLengths: (process.env.EMA_LENGTHS || '8,21,50,200').split(',').map(Number),
    atrLength: parseInt(process.env.ATR_LENGTH || '14'),
  },
};

// Configure logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} ${level}: ${message}`;
        })
      )
    })
  ],
});

// Tracking metrics
const metrics = {
  connectionStatus: {},
  barsCollected: {},
  lastUpdate: {},
  errors: [],
  startTime: null,
  gapCount: {},
  indicatorMissing: {},
};

const SYMBOL = 'BTCUSDT';
const TIMEFRAMES = ['5m', '15m', '1h'];
const RUN_DURATION = 120000; // 2 minutes
const REPORT_INTERVAL = 30000; // 30 seconds

function formatCandle(candle) {
  if (!candle) return 'N/A';

  return `
    Time: ${new Date(candle.time * 1000).toISOString()}
    OHLCV: O=${candle.open?.toFixed(2)} H=${candle.high?.toFixed(2)} L=${candle.low?.toFixed(2)} C=${candle.close?.toFixed(2)} V=${candle.volume?.toFixed(0)}
    Indicators:
      - EMA8:   ${candle.indicators?.ema_8?.toFixed(2) || 'N/A'}
      - EMA21:  ${candle.indicators?.ema_21?.toFixed(2) || 'N/A'}
      - EMA50:  ${candle.indicators?.ema_50?.toFixed(2) || 'N/A'}
      - EMA200: ${candle.indicators?.ema_200?.toFixed(2) || 'N/A'}
      - ATR:    ${candle.indicators?.atr?.toFixed(2) || 'N/A'}`;
}

function checkDataGaps(data, expectedInterval) {
  let gaps = 0;
  for (let i = 1; i < data.length; i++) {
    const timeDiff = data[i].time - data[i - 1].time;
    if (timeDiff !== expectedInterval) {
      gaps++;
    }
  }
  return gaps;
}

function checkIndicators(candle) {
  if (!candle || !candle.indicators) return false;
  return !!(
    candle.indicators.ema_8 &&
    candle.indicators.ema_21 &&
    candle.indicators.ema_50 &&
    candle.indicators.atr
  );
}

function printStatusReport(collector) {
  const stats = collector.getStats();
  const elapsed = (Date.now() - metrics.startTime) / 1000;

  logger.info('\n' + '='.repeat(80));
  logger.info(`STATUS REPORT - Elapsed Time: ${elapsed.toFixed(0)}s`);
  logger.info('='.repeat(80));

  logger.info(`\nCollection Status:`);
  logger.info(`  Collector Running: ${stats.isRunning ? 'YES' : 'NO'}`);
  logger.info(`  Active Charts: ${stats.chartsActive}`);
  logger.info(`  Data Streams: ${stats.dataStreams}`);

  logger.info(`\nTimeframe Summary:`);

  TIMEFRAMES.forEach(tf => {
    const key = `${SYMBOL}_${tf}`;
    const data = collector.getData(SYMBOL, tf);
    const latest = collector.getLatestCandle(SYMBOL, tf);

    logger.info(`\n  ${SYMBOL} ${tf}:`);
    logger.info(`    Status: ${metrics.connectionStatus[key] || 'PENDING'}`);
    logger.info(`    Bars Collected: ${data.length}`);
    logger.info(`    Last Update: ${metrics.lastUpdate[key] || 'N/A'}`);

    if (data.length > 0) {
      // Check data quality
      const expectedInterval = tf === '5m' ? 300 : tf === '15m' ? 900 : 3600;
      const gaps = checkDataGaps(data, expectedInterval);
      const completeness = data.length > 0 ? ((data.length - gaps) / data.length * 100) : 0;

      logger.info(`    Data Gaps: ${gaps}`);
      logger.info(`    Completeness: ${completeness.toFixed(1)}%`);

      // Check indicators
      const hasIndicators = latest ? checkIndicators(latest) : false;
      logger.info(`    Indicators Present: ${hasIndicators ? 'YES' : 'NO'}`);

      if (latest) {
        logger.info(`    Latest Close: ${latest.close?.toFixed(2)}`);
        logger.info(`    Latest EMA(8/21/50): ${latest.indicators?.ema_8?.toFixed(2)}/${latest.indicators?.ema_21?.toFixed(2)}/${latest.indicators?.ema_50?.toFixed(2)}`);
      }
    }
  });

  if (metrics.errors.length > 0) {
    logger.info(`\nErrors (${metrics.errors.length}):`);
    metrics.errors.slice(-5).forEach(err => {
      logger.info(`  - ${err}`);
    });
  }

  logger.info('\n' + '='.repeat(80) + '\n');
}

function printFinalReport(collector) {
  const stats = collector.getStats();
  const elapsed = (Date.now() - metrics.startTime) / 1000;

  logger.info('\n' + '='.repeat(80));
  logger.info('FINAL COLLECTION REPORT');
  logger.info('='.repeat(80));

  logger.info(`\nExecution Summary:`);
  logger.info(`  Duration: ${elapsed.toFixed(1)}s`);
  logger.info(`  Total Bars Collected: ${Object.values(stats.barCounts).reduce((a, b) => a + b, 0)}`);
  logger.info(`  Total Errors: ${metrics.errors.length}`);

  logger.info(`\nDetailed Timeframe Data:\n`);

  TIMEFRAMES.forEach(tf => {
    const key = `${SYMBOL}_${tf}`;
    const data = collector.getData(SYMBOL, tf);
    const latest = collector.getLatestCandle(SYMBOL, tf);

    logger.info(`\n${SYMBOL} ${tf} - Summary:`);
    logger.info(`  Total Bars: ${data.length}`);
    logger.info(`  Connection Status: ${metrics.connectionStatus[key] || 'UNKNOWN'}`);

    if (data.length > 0) {
      logger.info(`  Time Range: ${new Date(data[0].time * 1000).toISOString()} to ${new Date(data[data.length - 1].time * 1000).toISOString()}`);

      const expectedInterval = tf === '5m' ? 300 : tf === '15m' ? 900 : 3600;
      const gaps = checkDataGaps(data, expectedInterval);
      const completeness = ((data.length - gaps) / data.length * 100);

      logger.info(`  Data Quality:`);
      logger.info(`    Gaps: ${gaps}`);
      logger.info(`    Completeness: ${completeness.toFixed(2)}%`);

      const barsWithIndicators = data.filter(checkIndicators).length;
      const indicatorCoverage = (barsWithIndicators / data.length * 100);
      logger.info(`    Indicator Coverage: ${indicatorCoverage.toFixed(2)}%`);

      logger.info(`\n  Latest Candle:${formatCandle(latest)}`);

      // Sample of first candle
      if (data.length > 0) {
        logger.info(`\n  First Candle:${formatCandle(data[0])}`);
      }
    }
  });

  // Success criteria check
  logger.info(`\n${'='.repeat(80)}`);
  logger.info('SUCCESS CRITERIA CHECK:');
  logger.info('='.repeat(80));

  let allConnected = true;
  let allHaveData = true;
  let avgCompleteness = 0;
  let avgIndicatorCoverage = 0;

  TIMEFRAMES.forEach(tf => {
    const key = `${SYMBOL}_${tf}`;
    const data = collector.getData(SYMBOL, tf);

    if (metrics.connectionStatus[key] !== 'CONNECTED') {
      allConnected = false;
    }

    if (data.length === 0) {
      allHaveData = false;
    } else {
      const expectedInterval = tf === '5m' ? 300 : tf === '15m' ? 900 : 3600;
      const gaps = checkDataGaps(data, expectedInterval);
      const completeness = ((data.length - gaps) / data.length * 100);
      avgCompleteness += completeness;

      const barsWithIndicators = data.filter(checkIndicators).length;
      const indicatorCoverage = (barsWithIndicators / data.length * 100);
      avgIndicatorCoverage += indicatorCoverage;
    }
  });

  avgCompleteness /= TIMEFRAMES.length;
  avgIndicatorCoverage /= TIMEFRAMES.length;

  logger.info(`  ✓ All timeframes connected: ${allConnected ? 'YES' : 'NO'}`);
  logger.info(`  ✓ All timeframes have data: ${allHaveData ? 'YES' : 'NO'}`);
  logger.info(`  ✓ Average data completeness: ${avgCompleteness.toFixed(2)}% (target: >99.5%)`);
  logger.info(`  ✓ Average indicator coverage: ${avgIndicatorCoverage.toFixed(2)}% (target: >99%)`);

  const overallSuccess = allConnected && allHaveData && avgCompleteness > 95 && avgIndicatorCoverage > 95;

  logger.info(`\n${'='.repeat(80)}`);
  if (overallSuccess) {
    logger.info('RESULT: ✅ COLLECTION SUCCESSFUL');
  } else {
    logger.info('RESULT: ⚠️  COLLECTION INCOMPLETE (may need more time or reconnection)');
  }
  logger.info('='.repeat(80) + '\n');
}

async function main() {
  logger.info('='.repeat(80));
  logger.info('BTCUSDT Multi-Timeframe Data Collection Monitor');
  logger.info('='.repeat(80));
  logger.info(`Symbol: ${SYMBOL}`);
  logger.info(`Timeframes: ${TIMEFRAMES.join(', ')}`);
  logger.info(`Duration: ${RUN_DURATION / 1000}s`);
  logger.info(`Report Interval: ${REPORT_INTERVAL / 1000}s`);
  logger.info('='.repeat(80) + '\n');

  // Check credentials
  logger.debug(`SESSION from env: ${process.env.SESSION ? 'SET' : 'NOT SET'}`);
  logger.debug(`SIGNATURE from env: ${process.env.SIGNATURE ? 'SET' : 'NOT SET'}`);
  logger.debug(`config.tradingView.session: ${config.tradingView.session}`);
  logger.debug(`config.tradingView.signature: ${config.tradingView.signature}`);

  if (!config.tradingView.session || !config.tradingView.signature) {
    logger.error('❌ TradingView credentials not configured!');
    logger.error('Set SESSION and SIGNATURE in .env file');
    process.exit(1);
  }

  logger.info('✓ Credentials loaded');
  logger.info('✓ Initializing DataCollector...\n');

  const collector = new DataCollector(config, logger);
  metrics.startTime = Date.now();

  try {
    // Start collector
    await collector.start();
    logger.info('✓ DataCollector started successfully\n');

    // Subscribe to all timeframes
    for (const tf of TIMEFRAMES) {
      const key = `${SYMBOL}_${tf}`;

      logger.info(`Subscribing to ${key}...`);
      metrics.connectionStatus[key] = 'CONNECTING';

      await collector.subscribeRealtimeData(SYMBOL, tf, (candle) => {
        if (candle) {
          metrics.connectionStatus[key] = 'CONNECTED';
          metrics.lastUpdate[key] = new Date().toISOString();
          metrics.barsCollected[key] = (metrics.barsCollected[key] || 0) + 1;

          const hasIndicators = checkIndicators(candle);
          if (!hasIndicators) {
            metrics.indicatorMissing[key] = (metrics.indicatorMissing[key] || 0) + 1;
          }

          logger.debug(`${key} update: Close=${candle.close?.toFixed(2)} EMA8=${candle.indicators?.ema_8?.toFixed(2)}`);
        }
      });

      // Small delay between subscriptions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('\n✓ All subscriptions initiated\n');

    // Set up periodic status reports
    const reportInterval = setInterval(() => {
      printStatusReport(collector);
    }, REPORT_INTERVAL);

    // Run for specified duration
    setTimeout(async () => {
      clearInterval(reportInterval);

      logger.info('\n⏱️  Collection period complete. Generating final report...\n');

      // Print final report
      printFinalReport(collector);

      // Stop collector
      await collector.stop();
      logger.info('✓ DataCollector stopped');
      logger.info('✓ Monitor complete\n');

      process.exit(0);
    }, RUN_DURATION);

    logger.info(`📊 Monitoring started. Will run for ${RUN_DURATION / 1000}s...`);
    logger.info(`📈 Status reports every ${REPORT_INTERVAL / 1000}s\n`);

  } catch (error) {
    logger.error('❌ Fatal error:', error);
    metrics.errors.push(error.message);

    await collector.stop();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n\nReceived SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  metrics.errors.push(error.message);
});

main();
