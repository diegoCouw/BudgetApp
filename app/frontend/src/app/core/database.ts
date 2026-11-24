import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';

const DB_NAME = 'prospero';
const DB_VERSION = 1;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS accounts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    type      TEXT NOT NULL,
    balance   REAL NOT NULL DEFAULT 0,
    currency  TEXT NOT NULL DEFAULT 'EUR'
  );

  CREATE TABLE IF NOT EXISTS categories (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    emoji     TEXT,
    color     TEXT,
    is_custom INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS txs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id),
    category_id INTEGER REFERENCES categories(id),
    amount      REAL NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('expense','income')),
    date        TEXT NOT NULL,
    note        TEXT
  );

  CREATE TABLE IF NOT EXISTS recurring (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id),
    category_id INTEGER REFERENCES categories(id),
    amount      REAL NOT NULL,
    interval    TEXT NOT NULL,
    next_date   TEXT NOT NULL,
    name        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goals (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    target_amount  REAL NOT NULL,
    current_amount REAL NOT NULL DEFAULT 0,
    deadline       TEXT
  );
`;

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;

  async open(): Promise<void> {
    if (this.db) return;

    this.db = await this.sqlite.createConnection(
      DB_NAME, false, 'no-encryption', DB_VERSION, false
    );
    await this.db.open();
    await this.db.execute(SCHEMA);
  }

  async query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database niet geopend');
    const result = await this.db.query(sql, values);
    return (result.values ?? []) as T[];
  }

  async run(sql: string, values: unknown[] = []): Promise<number> {
    if (!this.db) throw new Error('Database niet geopend');
    const result = await this.db.run(sql, values);
    return result.changes?.lastId ?? 0;
  }
}
