import mongoose from 'mongoose';
import type { Logger } from '@supportpilot/shared-lib';

export interface DbConnectionOptions {
  uri: string;
  logger: Logger;
}

export function isDbConnected(): boolean {
  // 1 = connected, 2 = connecting
  return mongoose.connection.readyState === 1;
}

export async function connectDb(uri: string, logger: Logger): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  try {
    return await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: process.env['NODE_ENV'] !== 'production',
    });
  } catch (err) {
    logger.error({ err }, 'Failed to connect to MongoDB');
    throw err;
  }
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
