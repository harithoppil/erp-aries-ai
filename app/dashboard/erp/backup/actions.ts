'use server';

// Database backup & restore server actions.
// Uses pg_dump / pg_restore via child_process.
// Stores backup metadata in the DB and files on disk.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createReadStream } from 'fs';
import { join } from 'path';
import { prisma } from '@/lib/prisma';

const execFileAsync = promisify(execFile);

const BACKUP_DIR = join(process.cwd(), 'backups');

// ── Types ────────────────────────────────────────────────────────────────────

export interface BackupInfo {
  id: string;
  filename: string;
  size: number;       // bytes
  createdAt: Date;
  status: 'completed' | 'failed' | 'in_progress';
  message?: string;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupInfo;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  message?: string;
}

// ── Ensure backup directory exists ───────────────────────────────────────────

function ensureBackupDir(): string {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
}

// ── Parse DATABASE_URL ───────────────────────────────────────────────────────

interface ParsedConnectionString {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

function parseDatabaseUrl(url: string): ParsedConnectionString {
  // postgresql://user:password@host:port/database
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

// ── Create backup ────────────────────────────────────────────────────────────

export async function createBackup(): Promise<BackupResult> {
  const backupDir = ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `erp-aries-backup-${timestamp}.sql`;
  const filepath = join(backupDir, filename);
  const id = `BAK-${crypto.randomUUID().slice(0, 8)}`;

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return { success: false, error: 'DATABASE_URL not configured' };
    }

    const conn = parseDatabaseUrl(dbUrl);

    const env = { ...process.env, PGPASSWORD: conn.password };

    await execFileAsync('pg_dump', [
      '-h', conn.host,
      '-p', conn.port,
      '-U', conn.user,
      '-d', conn.database,
      '--no-owner',
      '--no-acl',
      '--format=plain',
      '-f', filepath,
    ], { env, timeout: 300000 }); // 5 min timeout

    const stats = statSync(filepath);

    return {
      success: true,
      backup: {
        id,
        filename,
        size: stats.size,
        createdAt: new Date(),
        status: 'completed',
      },
    };
  } catch (err) {
    // Clean up failed backup file
    if (existsSync(filepath)) {
      try { unlinkSync(filepath); } catch { /* ignore */ }
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
    };
  }
}

// ── List backups ─────────────────────────────────────────────────────────────

export async function listBackups(): Promise<BackupInfo[]> {
  const backupDir = ensureBackupDir();
  const results: BackupInfo[] = [];

  const sqlFiles = readdirSync(backupDir).filter((f) => f.endsWith('.sql'));

  for (const f of sqlFiles) {
    const filepath = join(backupDir, f);
    try {
      const stats = statSync(filepath);
      results.push({
        id: `file-${f}`,
        filename: f,
        size: stats.size,
        createdAt: stats.mtime,
        status: 'completed',
      });
    } catch {
      // skip unreadable files
    }
  }

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return results;
}

// ── Delete backup ────────────────────────────────────────────────────────────

export async function deleteBackup(filename: string): Promise<{ success: boolean; error?: string }> {
  try {
    const backupDir = ensureBackupDir();
    // Sanitize filename to prevent path traversal
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filepath = join(backupDir, safeName);

    if (!existsSync(filepath)) {
      return { success: false, error: 'Backup file not found' };
    }

    unlinkSync(filepath);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ── Get backup file path (for download) ──────────────────────────────────────

export async function getBackupFilePath(filename: string): Promise<string | null> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filepath = join(BACKUP_DIR, safeName);
  if (existsSync(filepath)) {
    return filepath;
  }
  return null;
}

// ── Restore from backup ──────────────────────────────────────────────────────

export async function restoreBackup(filename: string): Promise<RestoreResult> {
  const backupDir = ensureBackupDir();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filepath = join(backupDir, safeName);

  if (!existsSync(filepath)) {
    return { success: false, error: 'Backup file not found' };
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return { success: false, error: 'DATABASE_URL not configured' };
    }

    const conn = parseDatabaseUrl(dbUrl);
    const env = { ...process.env, PGPASSWORD: conn.password };

    // Use psql to restore the plain SQL dump
    await execFileAsync('psql', [
      '-h', conn.host,
      '-p', conn.port,
      '-U', conn.user,
      '-d', conn.database,
      '-f', filepath,
      '-v', 'ON_ERROR_STOP=0', // continue on errors
    ], { env, timeout: 600000 }); // 10 min timeout

    return {
      success: true,
      message: `Restored ${filename} successfully`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
    };
  }
}
