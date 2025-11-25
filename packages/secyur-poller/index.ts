import { SecyurDnsError } from './error';
import { Resolver } from 'node:dns'

import { SecyurDomain } from '@ohsooolucky/secyur-core/models/domain';
import { SecyurCore } from "@ohsooolucky/secyur-core";
import { SecyurCoreOptions } from "@ohsooolucky/secyur-core/models/configuration";
import { DnsRecord, DnsRecordType } from "@ohsooolucky/secyur-core/models/dns";
import { version as pkgVersion } from './package.json'
import { ResolveResult } from './models/resolveResult';
import getActiveMxRecords from './routines/mxRecords';

export interface ConsensusRecord {
  record: DnsRecord
  resolvers: string[]
}

export interface SecyurPollerConfiguration extends SecyurCoreOptions {
  dnsResolvers: string[]
  /**
   * Specify the minimum amount of valid responses have to be fetched by DNS
   * @default 2
   */
  minimumDnsResolutions?: number

}

export class SecyurPoller extends SecyurCore {
  private _resolvers: Resolver[] = []

  get resolvers(): ReadonlyArray<Resolver> {
    return this._resolvers
  }

  constructor(private configuration: SecyurPollerConfiguration) {
    configuration.logging!.service = {
      name: 'secyur-poller',
      version: pkgVersion,
      environment: 'it don mattuh'
    }
    super(configuration)

    this.setResolvers(configuration.dnsResolvers)
  }

  async getRecord(field: string = '@', domain: SecyurDomain | string, recordType: DnsRecordType): Promise<DnsRecord[]> {
    const parsedRecordType = this.getCorrectRecordType(recordType)

    const domainName = domain instanceof(Object) ? domain.domain : domain
    const fqdn = (field == null || field === '@') ? domainName : `${field}.${domainName}`

    // Get raw records from DNS
    const queries: Promise<ResolveResult>[] = this.executeResolve(fqdn, parsedRecordType)
    const resultsToCompare: ResolveResult[] = []
    for (const query of queries) {
      try {
        const result = await query
        resultsToCompare.push(result)
      } catch (error) {
        this.log.error({ error }, 'DNS Resolution failed with error')
      }
    }

    // Compile a source of thruth
    if (resultsToCompare.length < (this.configuration.minimumDnsResolutions ?? 2)) {
      throw new SecyurDnsError('No accurate source of thruth could be compiled from the dns responses')
    }

    const consensus = this.getConsensusRecords(resultsToCompare)
    if (consensus.length === 0) {
      throw new SecyurDnsError('No accurate source of thruth could be compiled from the dns responses')
    }

    return consensus.map(({ sample, resolvers }) => this.toDnsRecord(sample, fqdn, parsedRecordType, recordType, resolvers))
  }

  async cron() {
    const domains = await this.storage.getAllDomains()

    await this.checkMxRecords(domains)
  }

  async checkMxRecords(domains: SecyurDomain[]) {
    for (const domain of domains) {
      await getActiveMxRecords(this, domain)
    }
  }

  private getCorrectRecordType (recordType: DnsRecordType) {
    this.log.trace({ secyur: { recordType }}, 'Converting recordtype')
    switch (recordType) {
      case DnsRecordType.Dmarc:
      case DnsRecordType.TlsRpt:
      case DnsRecordType.Txt:
      case DnsRecordType.Dkim:
      case DnsRecordType.MtaSts:
      case DnsRecordType.Spf:
        this.log.debug({ secyur: { recordType, nodeRecordType: 'TXT' }}, 'Assigning record type TXT')
        return "TXT"
      default:
        const type = DnsRecordType[recordType].toUpperCase()
        this.log.debug({ secyur: { recordType, nodeRecordType: type }}, 'Assigning record type ' + type)
        return type
    }
  }

  /**
   * Determine the most common records across resolvers. Duplicates inside a
   * single resolver response are ignored.
   */
  private getConsensusRecords(results: ResolveResult[]): { sample: any, resolvers: string[] }[] {
    const frequencies: Map<string, { count: number, sample: any, resolvers: Set<string>, observed: Date }> = new Map()

    for (const result of results) {
      const seenInResult = new Set<string>()
      const records = Array.isArray(result.records) ? result.records : [result.records]
      for (const record of records) {
        const key = this.normalizeRecord(record)
        if (seenInResult.has(key)) {
          continue
        }
        seenInResult.add(key)
        const current = frequencies.get(key) ?? { count: 0, sample: record, resolvers: new Set<string>() }
        current.resolvers.add(result.resolver)
        frequencies.set(key, { count: current.count + 1, sample: current.sample, resolvers: current.resolvers, observed: result.observed })
      }
    }

    const minAgree = Math.floor(results.length / 2) + 1
    let highest = minAgree
    const winners: { sample: any, resolvers: string[] }[] = []

    for (const { count } of frequencies.values()) {
      if (count > highest) {
        highest = count
      }
    }

    for (const { count, sample, resolvers, observed } of frequencies.values()) {
      if (count === highest && count >= minAgree) {
        sample.firstObserved = observed
        winners.push({ sample, resolvers: Array.from(resolvers) })
      }
    }

    return winners
  }

  private normalizeRecord(record: any): string {
    if (record == null) {
      return 'null'
    }
    if (Array.isArray(record)) {
      // TXT records can be string[]; combine to reduce segment ordering noise
      return JSON.stringify(record.map(value => typeof value === 'string' ? value : this.normalizeRecord(value)))
    }
    if (typeof record === 'object') {
      const sortedKeys = Object.keys(record).sort()
      const normalized: any = {}
      for (const key of sortedKeys) {
        normalized[key] = record[key]
      }
      return JSON.stringify(normalized)
    }
    return String(record)
  }

  private toDnsRecord(rawRecord: any, fqdn: string, parsedRecordType: string, recordType: DnsRecordType, resolvers: string[]): DnsRecord {
    const base: DnsRecord = {
      type: recordType,
      record: fqdn,
      value: '',
      ttl: 0,
      active: true,
      firstObserved: rawRecord.firstObserved,
      resolvers
    }

    if (parsedRecordType === 'MX' && typeof rawRecord === 'object') {
      return {
        ...base,
        value: (rawRecord as any).exchange,
        type: DnsRecordType.Mx,
        // priority is part of MX record in core models
        priority: (rawRecord as any).priority
      } as DnsRecord
    }

    // TXT-like responses may come as nested arrays of strings
    if (Array.isArray(rawRecord)) {
      const combined = rawRecord.map(part => Array.isArray(part) ? part.join('') : String(part)).join('')
      return { ...base, value: combined }
    }

    return { ...base, value: String(rawRecord) }
  }

  /**
   * Execute and resolve a query on all resolvers
   * 
   * @param fqdn path/full domain to query the record from
   * @param parsedRecordType node-compatible record type string
   * @returns 
   */
  private executeResolve(fqdn: string, parsedRecordType: string): Promise<ResolveResult>[] {
    return this._resolvers.map(dnsResolver => {
      const resolver = dnsResolver.getServers()[0]
      const logBase: any = {
        secyur: {
          dns: {
            recordType: parsedRecordType,
            dnsResolver: resolver
          },
        },
        url: { domain: fqdn }
      }
      this.log.trace(logBase, 'Executing query for record')

      return new Promise((resolve, reject) => {
        const startTime = new Date().getTime()
        dnsResolver.resolve(fqdn, parsedRecordType, (error, records) => {
          if (error) {
            return reject(error)
          }
          const timeTaken = new Date().getTime() - startTime
          
          logBase.secyur.dns.timeTaken = timeTaken
          logBase.secyur.dns.records = records
          this.log.debug(logBase, 'Resolved query for record')
          return resolve({ resolver, records, timeTaken, observed: new Date() })
        })
      })
    })
  }

  /**
   * Create a list of independent resolvers.
   * @description A seperate resolver per DNS-server allows us to do DNS
   * verification across providers
   * @param dnsResolvers List of dns resolver IPs to use
   */
  private setResolvers(dnsResolvers: ReadonlyArray<string>) {
    for (const resolverAddress of dnsResolvers) {
      const resolver = new Resolver()
      resolver.setServers([resolverAddress])
      this._resolvers.push(resolver)
    }
  }
}
