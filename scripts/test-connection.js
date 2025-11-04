/**
 * Test TradingView API Connection
 */

import dotenv from 'dotenv';
dotenv.config();

import pkg from '@mathieuc/tradingview';
console.log('Package exports:', Object.keys(pkg));

const { Client, BuiltInIndicator } = pkg;

console.log('Client type:', typeof Client);
console.log('BuiltInIndicator type:', typeof BuiltInIndicator);

console.log('\nSession:', process.env.SESSION);
console.log('Signature:', process.env.SIGNATURE);

async function test() {
  try {
    console.log('\nCreating client...');
    const client = new Client({
      token: process.env.SESSION,
      signature: process.env.SIGNATURE,
    });

    console.log('Client created:', client);

    console.log('\nGetting chart...');
    console.log('Chart session:', client.Session.Chart);
    const chart = client.Session.Chart.setMarket('BINANCE:BTCUSDT', {
      timeframe: '5',
    });

    console.log('Chart object:', chart);

    chart.onUpdate(() => {
      console.log('Chart update received!');
      console.log('Symbol info:', chart.infos);
    });

    chart.onError((err) => {
      console.error('Chart error:', err);
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\nClosing...');
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
