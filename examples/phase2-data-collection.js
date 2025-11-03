/**
 * Phase 2: Data Collection & Indicator Integration Example
 *
 * This example demonstrates:
 * 1. Real-time data collection with WebSocket streaming
 * 2. Technical indicator attachment (EMA, ATR, Volume)
 * 3. Multi-timeframe synchronization (LF, MF, HF)
 * 4. COMA trend detection on High Frame
 * 5. Historical data collection and replay
 *
 * Run: NODE_ENV=development npm run collect:data
 * (Requires TradingView SESSION and SIGNATURE in .env)
 */

import dotenv from 'dotenv';
import winston from 'winston';
import { DataCollector } from '../src/data/collector.js';
import { TrendDetector } from '../src/indicators/trend-detector.js';
import { config } from '../src/config/index.js';

dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/phase2-example.log' }),
  ],
});

// ============ REAL-TIME DATA COLLECTION EXAMPLE ============

async function exampleRealtimeCollection() {
  logger.info('=== EXAMPLE 1: Real-time Data Collection ===');

  const collector = new DataCollector(config, logger);
  const trendDetector = new TrendDetector(config, logger);

  try {
    // Start the collector
    await collector.start();
    logger.info('DataCollector started');

    // Subscribe to real-time data for BTC on 5m timeframe
    await collector.subscribeRealtimeData(
      'BTCUSDT',
      '5m',
      (candle) => {
        logger.info(`New candle: ${candle?.time} Close: ${candle?.close}`);
      }
    );

    // Run for 30 seconds and display stats
    setTimeout(() => {
      const stats = collector.getStats();
      logger.info(`\nCollection Stats:`);
      logger.info(`  Active Charts: ${stats.chartsActive}`);
      logger.info(`  Data Streams: ${stats.dataStreams}`);
      logger.info(`  Bar Counts: ${JSON.stringify(stats.barCounts)}`);

      // Display latest candle
      const latest = collector.getLatestCandle('BTCUSDT', '5m');
      if (latest) {
        logger.info(`\nLatest Candle (BTCUSDT 5m):`);
        logger.info(`  Time: ${latest.time}`);
        logger.info(`  Close: ${latest.close}`);
        logger.info(`  EMA8: ${latest.indicators.ema_8}`);
        logger.info(`  EMA21: ${latest.indicators.ema_21}`);
        logger.info(`  EMA50: ${latest.indicators.ema_50}`);
        logger.info(`  ATR: ${latest.indicators.atr}`);
      }

      collector.stop().then(() => {
        logger.info('Example 1 complete\n');
      });
    }, 30000);

  } catch (error) {
    logger.error('Real-time collection error:', error);
  }
}

// ============ MULTI-TIMEFRAME EXAMPLE ============

async function exampleMultiTimeframe() {
  logger.info('=== EXAMPLE 2: Multi-Timeframe Synchronization ===');

  const collector = new DataCollector(config, logger);

  try {
    await collector.start();
    logger.info('DataCollector started');

    // Subscribe to multiple timeframes for same symbol
    const symbol = 'BTCUSDT';
    const timeframes = ['5m', '15m', '1h']; // LF, MF, HF

    for (const tf of timeframes) {
      await collector.subscribeRealtimeData(symbol, tf, (candle) => {
        logger.debug(`${symbol} ${tf}: ${candle?.time} @ ${candle?.close}`);
      });
    }

    logger.info(`Subscribed to ${symbol} on ${timeframes.join(', ')}`);

    // Run for 20 seconds
    setTimeout(async () => {
      logger.info('\nMulti-Timeframe Data Summary:');
      for (const tf of timeframes) {
        const data = collector.getDataRange(symbol, tf, 5); // Last 5 bars
        logger.info(`\n${symbol} ${tf}: ${data.length} bars`);
        if (data.length > 0) {
          const latest = data[data.length - 1];
          logger.info(`  Latest Close: ${latest.close}`);
          logger.info(`  EMA(8/21/50): ${latest.indicators.ema_8?.toFixed(2)}/${latest.indicators.ema_21?.toFixed(2)}/${latest.indicators.ema_50?.toFixed(2)}`);
        }
      }

      await collector.stop();
      logger.info('\nExample 2 complete\n');
    }, 20000);

  } catch (error) {
    logger.error('Multi-timeframe example error:', error);
  }
}

// ============ TREND DETECTION EXAMPLE ============

async function exampleTrendDetection() {
  logger.info('=== EXAMPLE 3: COMA Trend Detection ===');

  const collector = new DataCollector(config, logger);
  const trendDetector = new TrendDetector(config, logger);

  try {
    await collector.start();

    // Subscribe to high frame (1h) for trend detection
    await collector.subscribeRealtimeData('BTCUSDT', '1h', async (candle) => {
      if (candle) {
        // Get last 100 bars for trend detection
        const hfData = collector.getDataRange('BTCUSDT', '1h', 100);

        if (hfData.length >= 30) {
          const trend = await trendDetector.detectTrend('BTCUSDT', hfData);

          if (trend.confirmed) {
            logger.info(`\n🎯 TREND DETECTED: ${trend.direction}`);
            logger.info(`   Bars in COMA: ${trend.barsInCOMA}/${trend.requiredBars}`);
            logger.info(`   Trend Strength: ${(trend.trend.strength * 100).toFixed(0)}%`);
            logger.info(`   Latest EMA: 8=${trend.latestEMA.ema8?.toFixed(2)}, 21=${trend.latestEMA.ema21?.toFixed(2)}, 50=${trend.latestEMA.ema50?.toFixed(2)}`);
          }
        }
      }
    });

    logger.info('Monitoring BTCUSDT 1h for trends...');

    // Run for 40 seconds
    setTimeout(async () => {
      const stats = collector.getStats();
      logger.info(`\nFinal Stats:`);
      logger.info(`  Total bars collected: ${stats.barCounts['BTCUSDT_1h'] || 0}`);
      await collector.stop();
      logger.info('Example 3 complete\n');
    }, 40000);

  } catch (error) {
    logger.error('Trend detection example error:', error);
  }
}

// ============ DATA QUALITY VALIDATION EXAMPLE ============

async function exampleDataValidation() {
  logger.info('=== EXAMPLE 4: Data Quality Validation ===');

  const collector = new DataCollector(config, logger);

  try {
    await collector.start();

    // Subscribe to short timeframe for frequent updates
    await collector.subscribeRealtimeData('BTCUSDT', '5m');

    // Track data gaps
    let lastTime = null;
    let gapCount = 0;
    const expectedInterval = 5 * 60; // 5 minutes in seconds

    const validator = setInterval(() => {
      const data = collector.getData('BTCUSDT', '5m');

      if (data.length > 1) {
        // Check for gaps
        let currentGaps = 0;
        for (let i = 1; i < data.length; i++) {
          const timeDiff = data[i].time - data[i - 1].time;
          if (timeDiff !== expectedInterval) {
            currentGaps++;
          }
        }

        const completeness = ((data.length - currentGaps) / data.length * 100).toFixed(1);
        logger.info(`\nData Quality Check:`);
        logger.info(`  Total bars: ${data.length}`);
        logger.info(`  Gaps detected: ${currentGaps}`);
        logger.info(`  Completeness: ${completeness}%`);

        // Check indicators
        const latest = data[data.length - 1];
        const hasAllIndicators = latest.indicators.ema_8 && latest.indicators.ema_21 &&
                                 latest.indicators.ema_50 && latest.indicators.atr;
        logger.info(`  Indicators present: ${hasAllIndicators ? 'YES' : 'NO'}`);
      }
    }, 10000); // Check every 10 seconds

    // Run for 30 seconds
    setTimeout(async () => {
      clearInterval(validator);
      await collector.stop();
      logger.info('\nExample 4 complete\n');
    }, 30000);

  } catch (error) {
    logger.error('Data validation example error:', error);
  }
}

// ============ HISTORICAL DATA COLLECTION EXAMPLE ============

async function exampleHistoricalCollection() {
  logger.info('=== EXAMPLE 5: Historical Data Collection (Replay) ===');

  const collector = new DataCollector(config, logger);

  try {
    await collector.start();
    logger.info('DataCollector started');

    // Collect last 7 days of 1h data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    logger.info(`Collecting historical data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const historicalData = await collector.collectHistoricalData(
      'BTCUSDT',
      '1h',
      startDate,
      endDate
    );

    logger.info(`\nHistorical Data Collection Complete:`);
    logger.info(`  Bars collected: ${historicalData.length}`);

    if (historicalData.length > 0) {
      logger.info(`  Date range: ${historicalData[0].time} to ${historicalData[historicalData.length - 1].time}`);
      logger.info(`  First bar close: ${historicalData[0].close}`);
      logger.info(`  Last bar close: ${historicalData[historicalData.length - 1].close}`);

      // Check data quality
      const barsWithIndicators = historicalData.filter(b =>
        b.indicators.ema_8 && b.indicators.ema_21 && b.indicators.ema_50
      ).length;
      const quality = (barsWithIndicators / historicalData.length * 100).toFixed(1);
      logger.info(`  Data quality (indicators): ${quality}%`);
    }

    await collector.stop();
    logger.info('\nExample 5 complete\n');

  } catch (error) {
    logger.error('Historical collection error:', error);
  }
}

// ============ MAIN EXECUTION ============

async function main() {
  logger.info('Starting Phase 2 Data Collection Examples\n');

  // Check for credentials
  if (!config.tradingView.session || !config.tradingView.signature) {
    logger.warn('⚠️  TradingView credentials not configured!');
    logger.warn('Set SESSION and SIGNATURE in .env to enable live examples');
    logger.info('\nRunning mock example instead...\n');

    // You can still run trend detection with mock data
    const mockData = Array.from({ length: 50 }, (_, i) => ({
      time: i * 3600,
      close: 100 + i * 0.5,
      high: 105 + i * 0.5,
      low: 99 + i * 0.5,
      volume: 1000000,
      indicators: {
        ema_8: 102 + i * 0.3,
        ema_21: 101 + i * 0.25,
        ema_50: 100 + i * 0.2,
        atr: 2.5,
      },
    }));

    const detector = new TrendDetector(config, logger);
    const trend = await detector.detectTrend('BTCUSDT', mockData);
    logger.info('\nMock Trend Detection Result:');
    logger.info(`  Confirmed: ${trend.confirmed}`);
    logger.info(`  Direction: ${trend.direction}`);
    logger.info(`  Bars in COMA: ${trend.barsInCOMA}/${trend.requiredBars}`);

    process.exit(0);
  }

  // Choose which example to run (comment out others)
  try {
    // Uncomment one of these:
    await exampleRealtimeCollection();
    // await exampleMultiTimeframe();
    // await exampleTrendDetection();
    // await exampleDataValidation();
    // await exampleHistoricalCollection();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
