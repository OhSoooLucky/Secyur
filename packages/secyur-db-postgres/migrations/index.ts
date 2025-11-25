import { Logger } from 'pino';
import { SecyurCore } from '@ohsooolucky/secyur-core';
import { Client, PoolClient } from "pg";

export class SecyurPostgresMigrator {
  private _log: Logger

  private static readonly VERSION = {
    1: '1_initial'
  }

  constructor(secyur: SecyurCore, public client: Client | PoolClient) {
    this._log = secyur.log.child({
      event: { module: 'secyur-postgres-migrator' },
      secyur: { layer: 'data' }
    })
  }

  async migrate(): Promise<boolean> {
    let currentMigration = { version: 0 }

    try {
      const queryResult = await this.client.query('SELECT version, name FROM migrations ORDER BY version DESC LIMIT 1')
      if (queryResult.rowCount === 1) {
        currentMigration = queryResult.rows[0]
        this._log.info({ secyur: { migration: currentMigration } }, 'Current database version')
      } else {
        this._log.warn('No migration version found, falling back to new database mode')
      }
    } catch {
      this._log.warn('No migration version found, falling back to new database mode')
    }

    for (const [ version, name ] of Object.entries(SecyurPostgresMigrator.VERSION)) {
      const logBase = {
        secyur: { migration: { version: +version, name } }
      }
      this._log.trace(logBase, 'Checking migration version')
      if (+version <= currentMigration.version) {
        this._log.debug(logBase, 'Migration already applied, ignoring')
        continue;
      }


      this._log.debug(logBase, 'Applying migration')
      const migration = require('./' + name)

      await migration.up(this)
      this._log.info(logBase, 'Applied Postgres database migration')
    }

    return true
  }
}
