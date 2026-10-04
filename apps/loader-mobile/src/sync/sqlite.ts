import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqlDatabase } from '@waypoint/mobile-sync';

/** expo-sqlite's database as the shared outbox's SqlDatabase. */
export function asSqlDatabase(db: SQLiteDatabase): SqlDatabase {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params) => db.runAsync(sql, params),
    getAllAsync: (sql, params) => db.getAllAsync(sql, params),
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}
