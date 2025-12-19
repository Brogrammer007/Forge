/**
 * Utility for cleaning up temporary files
 */

import { readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from './logger';

const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Clean up old temporary files
 * Removes files older than MAX_AGE_MS
 */
export async function cleanupOldFiles(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    return;
  }

  try {
    const files = await readdir(UPLOAD_DIR);
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      const filepath = path.join(UPLOAD_DIR, file);
      try {
        const stats = await stat(filepath);
        if (now - stats.mtimeMs > MAX_AGE_MS) {
          await unlink(filepath);
          cleanedCount++;
        }
      } catch (error) {
        // Ignore individual file errors, continue cleanup
        logger.warn(`Failed to clean up file: ${file}`, { error });
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old temporary file(s)`);
    }
  } catch (error) {
    logger.error('Failed to cleanup old files', error);
  }
}

/**
 * Clean up a specific file
 */
export async function cleanupFile(filename: string): Promise<boolean> {
  const filepath = path.join(UPLOAD_DIR, filename);
  
  if (!existsSync(filepath)) {
    return false;
  }

  try {
    await unlink(filepath);
    return true;
  } catch (error) {
    logger.error(`Failed to delete file: ${filename}`, error);
    return false;
  }
}
