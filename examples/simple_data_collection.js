/**
 * Simple Data Collection Example
 *
 * This example demonstrates how to collect real-time data
 * from TradingView-API for a single symbol and timeframe.
 */

import { TradingView, BuiltInIndicator } from '@mathieuc/tradingview';
import { config } from '../src/config/index.js';

async function collectDataExample() {
  console.log('Starting simple data collection example...');

  try {
    // Create TradingView client
    const client = new TradingView({
      session: config.tradingView.session,
      signature: config.tradingView.signature,
    });

    // Create chart for symbol
    const chart = await client.getChart({
      symbol: 'BTCUSDT',
      timeframe: '5m',
    });

    // Create EMA indicators
    const ema8 = new BuiltInIndicator(
      { indicator: 'Moving Average Exponential', length: 8 },
      chart
    );

    const ema21 = new BuiltInIndicator(
      { indicator: 'Moving Average Exponential', length: 21 },
      chart
    );

    // Subscribe to updates
    chart.onReady(() => {
      console.log('Chart ready!');
      console.log(`Close price: ${chart.periods[chart.periods.length - 1].close}`);
    });

    chart.onUpdate(() => {
      const period = chart.periods[chart.periods.length - 1];
      console.log(`Updated: ${period.time} Close: ${period.close}`);
    });

    // Let it run for 30 seconds
    setTimeout(() => {
      console.log('Stopping data collection...');
      chart.disconnect();
      process.exit(0);
    }, 30000);

  } catch (error) {
    console.error('Error in data collection example:', error);
    process.exit(1);
  }
}

collectDataExample();
