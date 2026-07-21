import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri);
    logger.info(`MongoDB connected succesfully`);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err}`);
    process.exit(1);
  }

  mongoose.connection.on('error', err => {
    logger.error(`MongoDB error: ${err}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Reconnecting…');
  });
}
