/**
 * Gecko ML Indicator - Main Application Entry Point
 *
 * This is the primary entry point for the Gecko ML Indicator system.
 * It initializes the application, sets up logging, and starts the main processes.
 *
 * @module src/index
 */

import dotenv from 'dotenv';
import winston from 'winston';
import { GeckoIndicator } from './core/gecko-indicator.js';
import { DataCollector } from './data/collector.js';
import { config } from './config/index.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'gecko-indicator' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    ),
  }));
}

/**
 * Initialize and start the Gecko Indicator system
 */
async function main() {
  try {
    logger.info('Starting Gecko ML Indicator System');
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`Config: ${JSON.stringify(config, null, 2)}`);

    // Initialize the Gecko Indicator
    const geckoIndicator = new GeckoIndicator(config, logger);

    // Initialize data collector
    const dataCollector = new DataCollector(config, logger);

    // Start the indicator
    await geckoIndicator.initialize();
    logger.info('Gecko Indicator initialized successfully');

    // Start data collection
    await dataCollector.start();
    logger.info('Data collection started');

    // TODO: Add event listeners for trading signals
    // TODO: Connect to real-time streaming
    // TODO: Set up API endpoints for dashboard

  } catch (error) {
    logger.error('Fatal error during initialization:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main();
