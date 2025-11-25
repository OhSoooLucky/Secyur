import { SecyurCore } from '@ohsooolucky/secyur-core'
import { SecyurDbError, SecyurStorage } from '@ohsooolucky/secyur-core/models/db'
import { SecyurDomain } from '@ohsooolucky/secyur-core/models/domain'
import { Pool, PoolConfig } from 'pg'
import { Logger } from 'pino'
import { SecyurPostgresMigrator } from './migrations'
import { MxRecord } from '@ohsooolucky/secyur-core/models/dns'

/**
 * PostgreSQL-based SecyurStorage provider
 */
export class SecyurPostgresStorage implements SecyurStorage {
  private _pool: Pool 
  private _logger: Logger
  private _initialized: boolean = false


  readonly initialized = this._initialized

  constructor(private secyur: SecyurCore,
    protected configuration: SecyurPostgresConfiguration) {
    this._pool = new Pool(configuration)
    this._logger = secyur.log.child({
      event: { module: 'secyur-postgres' },
      secyur: { layer: 'data' }
    })
  }

  async init() {
    if (this._initialized) {
      return
    }

    const client = await this._pool.connect()
    const migrator = new SecyurPostgresMigrator(this.secyur, client)

    this._logger.debug('Applying migrations to the Postgres database')
    await migrator.migrate() // throws otherwise
    this._initialized = true

    this._logger.info('Successfully migrated the database')
  }

//#region Domains
  async getAllDomains(): Promise<SecyurDomain[]> {
    this._logger.trace(`Retrieving all domains from the Postgres database`)
    const queryResult = await this._pool.query('SELECT * FROM domains')
  
    if (queryResult.rowCount === 0 ) {
      this._logger.debug('No domains were found in the database')
      return []
    }

    this._logger.debug('Retrieved all domains from the Postgres database')
    return queryResult.rows as SecyurDomain[]
  }

  async getDomain(domainId: number): Promise<SecyurDomain> {
    this._logger.trace({
        secyur: { domain: { id: domainId } }
      }, `Retrieving domain by id from Postgres database`)

    const queryResult = await this._pool.query<SecyurDomain>(
      'SELECT * FROM domains WHERE id = $1', [domainId])

    if (queryResult.rowCount === 0) {
      this._logger.trace({ secyur: { domain: { id: domainId } } },
        `No domain found by id, throwing error`)
      throw new SecyurPostgresError('Domain not found')
    }

    this._logger.debug({
        secyur: { domain: { ...queryResult.rows[0], id: domainId,  } }
      }, `Retrieved domain by id from Postgres database`)

    return queryResult.rows[0]
  }

  async getDomainByName(name: string): Promise<SecyurDomain> {
    this._logger.trace({
        secyur: { domain: { name } }
      }, `Retrieving domain by name from Postgres database`)
    const queryResult = await this._pool.query<SecyurDomain>(`SELECT "id",
      "domain", "added", "modified", "spfPolicy", "dmarcPolicy", "mtaStsMode",
      "mtaStsAge", "tlsrptEnabled", "tlsaEnabled", "bimiEnabled", "dnsSecEnabled",
      "monitoring", "retentionPolicy" FROM domains WHERE domain = $1`, [name])
    if (queryResult.rowCount === 0) {
      throw new SecyurPostgresError('Domain not found by name: ' + name)
    }

    this._logger.debug({
        secyur: { domain: { ...queryResult.rows[0], name } }
      }, `Retrieved domain by name from Postgres database`)

    return queryResult.rows[0]
  }

  async updateDomain(domain: SecyurDomain): Promise<boolean> {
    this._logger.trace({ secyur: { domain } },
      `Updating domain instance in Postgres database`)
    const updateResult = await this._pool.query(`UPDATE domains SET "spfPolicy"=$1,
        "dmarcPolicy"=$2, "mtaStsMode"=$3, "mtaStsAge"=$4, "tlsrptEnabled"=$5,
        "tlsaEnabled"=$6, "bimiEnabled"=$7, "dnsSecEnabled"=$8, monitoring=$9,
        "retentionPolicy"=$10 modified=now()
        WHERE id=$11`, [
        +domain.spfPolicy,
        +domain.dmarcPolicy,
        +domain.mtaStsMode,
        +domain.mtaStsAge,
        domain.tlsrptEnabled,
        domain.tlsaEnabled,
        domain.bimiEnabled,
        domain.dnsSecEnabled,
        domain.monitoring,
        domain.retentionPolicy,
        domain.id
      ])

    if (updateResult.rowCount === 0) {
      this._logger.error({ secyur: { domain } },
        `Failed to update domain instance in Postgres database`)
      return false
    }

    this._logger.debug({ secyur: { domain } },
      `Updated domain instance in Postgres database`)
    return true
  }

  async createDomain(domain: SecyurDomain): Promise<SecyurDomain> {
    this._logger.trace({ secyur: { domain } },
      `Creating new domain instance in Postgres database`)
    const updateResult = await this._pool.query(`INSERT INTO domains
      (domain,added,"spfPolicy","dmarcPolicy","mtaStsMode","mtaStsAge",
        "tlsrptEnabled","tlsaEnabled","bimiEnabled","dnsSecEnabled",monitoring,
        "retentionPolicy")
      VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
        domain.domain,
        +domain.spfPolicy,
        +domain.dmarcPolicy,
        +domain.mtaStsMode,
        +domain.mtaStsAge,
        domain.tlsrptEnabled,
        domain.tlsaEnabled,
        domain.bimiEnabled,
        domain.dnsSecEnabled,
        domain.monitoring,
        domain.retentionPolicy
      ])

    if (updateResult.rowCount === 0) {
      this._logger.error({ secyur: { domain } },
        `Creating new domain instance failed in Postgres database`)
      throw new SecyurPostgresError('Unable to register domain: '
        + domain.domain)
    }

    domain.id = updateResult.oid
    this._logger.debug({ secyur: { domain } },
      `Created new domain instance in Postgres database`)

    return domain
  }

  async deleteDomain(domainId: number): Promise<boolean> {
    this._logger.debug({ secyur: { domain: { id: domainId } } },
      `Created new domain instance in Postgres database`)
  
    const result = await this._pool.query('DELETE FROM domains WHERE id=$1',
      [ domainId ])
    if (result.rowCount === 0) {
      this._logger.error({ secyur: { domain: { id: domainId } } },
        `Deleting domain from Postgres database failed`)
      return false
    }

    this._logger.debug({ secyur: { domain: { id: domainId } } },
      `Deleted domain from Postgres database`)
    return true
  }
//#endregion
//#region MxRecords


  async getMxRecordsByDomain(domain: number | string, active: boolean = true): Promise<MxRecord[]> {
    const domainId = !isNaN(+domain) ? domain : undefined
    const domainName = typeof(domain) === 'string' ? domain : undefined 
    const loggerBase = {
      secyur: {
        domain: { id: domainId }
      },
      url: { domain: domainName }
    }
    this._logger.trace(loggerBase, `Retrieving all mx records for domain`)
    const result = await this._pool.query<MxRecord>(`SELECT dr."id", dr."type",
      dr."record", dr."value", dr."ttl", dr."firstObserved", dr."lastObserved",
      dr.active=TRUE, mx."priority"
      FROM "dnsRecords" dr
        INNER JOIN "mxRecords" mx ON dr.id=mx."dnsRecordId"
        WHERE ${ !!domainId ? 'dr."domainId"=$1': 'dr."domainId"=(SELECT id FROM domains WHERE domain=$1)' } AND (dr.active=True OR dr.active=$2)`, [domain, active])
        
    if (result.rowCount === 0) {
      this._logger.debug(loggerBase, `No mx records registered`)
      return []
    }

    this._logger.debug(loggerBase, `Returning ${result.rowCount} rows of mx records for domain`)
    return result.rows
  }

  async createMXRecord(record: MxRecord): Promise<MxRecord> {
    const client = await this._pool.connect()
    try {
      await client.query('BEGIN TRANSACTION;')
      const result = await client.query(`INSERT INTO "dnsRecords" ("domainId", type, record, value, ttl, "firstObserved", "lastObserved", active, version, resolvers)
        VALUES ($1, $2, $3, $4, $5, $6, now(), TRUE, NULL, $7) RETURNING id`,
        [record.domainId, record.type, record.record, record.value, record.ttl, record.firstObserved, JSON.stringify(record.resolvers)])

      if (result.rowCount === 1) {
        record.id = result.rows[0].id


        const mxResult = await client.query(`INSERT INTO "mxRecords" ("dnsRecordId", priority) VALUES ($1, $2)`, [record.id, record.priority])
        if (mxResult.rowCount === 1) {
          await client.query('COMMIT TRANSACTION;')
          return record
        }
      }

      client.query('ROLLBACK TRANSACTION')
      throw new SecyurDbError('Failed to complete mx record transaction')
    } catch (error) {
      client.query('ROLLBACK TRANSACTION')
      throw error
    }
  }

  async updateMxRecord(record: MxRecord): Promise<MxRecord> {
    const result = await this._pool.query(`UPDATE "dnsRecords" SET ttl=$1, "lastObserved"=$2, active=$3, resolvers=$4)`,
      [record.ttl, record.lastObserved, record.active, JSON.stringify(record.resolvers)])

    if (result.rowCount === 1) {
      return record
    }

    throw new SecyurDbError('Failed to complete mx record transaction')
  }
//#endregion
  // async purgeRecords (beforeDate: Date): Promise<SecyurPurgeReport> {
  //   const
  // }
}

export class SecyurPostgresError extends SecyurDbError {}
export interface SecyurPostgresConfiguration extends PoolConfig {}