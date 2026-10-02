import sqlite3 from 'sqlite3';
import { config } from '../config';

// Open SQLite database connection
const db = new sqlite3.Database(config.dbPath, (err) => {
  if (err) {
    console.error('[DB] Failed to connect to SQLite:', err.message);
  } else {
    console.log(`[DB] Connected to SQLite database at ${config.dbPath}`);
  }
});

// Promisified database helpers
export function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) return reject(err);
      resolve(row as T);
    });
  });
}

export function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) return reject(err);
      resolve(rows as T[]);
    });
  });
}

// Initialize tables & run auto-migrations
export async function initDatabase(): Promise<void> {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      current_time REAL NOT NULL DEFAULT 0,
      play_state TEXT NOT NULL DEFAULT 'PAUSED',
      room_type TEXT NOT NULL DEFAULT 'private',
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Check and run migrations if columns don't exist in existing database
  const columns = await dbAll<any>(`PRAGMA table_info(rooms)`);
  const columnNames = columns.map((c) => c.name);

  if (!columnNames.includes('room_type')) {
    await dbRun(`ALTER TABLE rooms ADD COLUMN room_type TEXT NOT NULL DEFAULT 'private'`);
    console.log('[DB] Migrated rooms table: added room_type');
  }
  if (!columnNames.includes('description')) {
    await dbRun(`ALTER TABLE rooms ADD COLUMN description TEXT DEFAULT ''`);
    console.log('[DB] Migrated rooms table: added description');
  }
  if (!columnNames.includes('category')) {
    await dbRun(`ALTER TABLE rooms ADD COLUMN category TEXT DEFAULT 'General'`);
    console.log('[DB] Migrated rooms table: added category');
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);

  await dbRun(`
    CREATE INDEX IF NOT EXISTS idx_chat_room_time 
    ON chat_messages (room_id, timestamp)
  `);

  // Seed and ensure default community public lounges
  const now = Date.now();
  const seededPublicRooms = [
    {
      id: 'COMMUNITY-LOFI',
      name: '☕ 24/7 Lofi & Chill Study Lounge',
      description: 'Mellow beats, cozy vibes, and productive study sessions. Open 24/7 for anyone.',
      category: 'Study & Lofi',
      videoId: 'jfKfPfyJRdk',
    },
    {
      id: 'COMMUNITY-SYNTH',
      name: '🌆 Synthwave & Cyberpunk Hub',
      description: 'Retro 80s synth rhythms, neon visuals, and late night dev hangouts.',
      category: 'Music',
      videoId: '4xDzrJKXOOY',
    },
    {
      id: 'COMMUNITY-CINEMA',
      name: '🎬 Cinema Club & Movie Trailers',
      description: 'Watch the newest blockbuster movie trailers, short films, and cinephile breakdowns.',
      category: 'Cinema',
      videoId: 'd9MyW72ELq0',
    },
    {
      id: 'COMMUNITY-GAMING',
      name: '🎮 Gaming Highlights & Speedruns',
      description: 'Awesome gaming clutches, esports tournaments, and speedrun world records.',
      category: 'Gaming',
      videoId: 'f_6vA1523k0',
    },
  ];

  for (const r of seededPublicRooms) {
    await dbRun(
      `INSERT INTO rooms (id, name, host_user_id, video_id, current_time, play_state, room_type, description, category, created_at, updated_at)
       VALUES (?, ?, 'SYSTEM_COMMUNITY', ?, 0, 'PLAYING', 'public', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         category = excluded.category,
         room_type = 'public'`,
      [r.id, r.name, r.videoId, r.description, r.category, now, now]
    );
  }
  console.log('[DB] Seeded and ensured initial public community rooms');

  console.log('[DB] Schemas initialized successfully');
}

export default db;
