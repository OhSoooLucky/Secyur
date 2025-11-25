import pino from 'pino';

import { SecyurCoreOptions } from "./models/configuration";
import createLogger from './logger';
import { SecyurStorage } from './models/db';
import { version as pkgVersion, name as pkgName } from './package.json'
import { SecyurError } from './error';

/**
 * Core base for deploying a secyur environment
 */
export class SecyurCore {
  private _log: pino.Logger
  private _storage?: SecyurStorage
  private _executionEnvironment: 'bun' | 'node' = 'node'

  readonly executionEnvironment = this._executionEnvironment


  get log() {
    return this._log
  }

  get storage() {
    if (!this._storage) {
      throw new SecyurError('Storage provider has not been configured yet')
    }
    return this._storage
  }

  constructor (options: SecyurCoreOptions) {
    SecyurCore.validateConfiguration(options)
    this._log = createLogger(options.logging)

    this.detectExecutionEnvironment()
    this._log.info({ package: { name: pkgName, version: pkgVersion } }, 'Configured Secyur version ' + pkgVersion)
  }

  /**
   * Use and initialize a storage backend
   * @param initializer Storage factory
   * @returns the created instance of the storage backend
   */
  async useStorage(initializer: (secyur: SecyurCore) => SecyurStorage): Promise<SecyurStorage> {
    this._storage = initializer(this)
    const logBase = { secyur: { storageType: this._storage.constructor.name } }
    this._log.info(logBase, 'Using new storage backend for this instance')

    this._log.trace(logBase, 'Initializing storage backend')
    await this._storage.init()
      .then(x => this._log.debug(logBase, 'Initialized storage backend'))

    return this._storage
  }

  private detectExecutionEnvironment() {
    if (process.versions.bun) {
      this._executionEnvironment = 'bun'
      this._log.info({ package: { name: 'bun', version: process.versions.bun } }, 'Detected Bun as execution environment!')
    } else {
      this._log.info({ package: { name: 'node', version: process.versions.node } }, 'Detected NodeJS as execution environment!')
    }
  }

  private static validateConfiguration(options: SecyurCoreOptions) {

  }
}
