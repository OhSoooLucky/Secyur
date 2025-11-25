import { DmarcPolicy, MtaStsPolicy, SpfPolicy } from './policies';

export interface SecyurDomain {
  id: number
  domain: string
  added: Date
  modified?: Date

  spfPolicy: SpfPolicy
  dkimSelectors?: number
  dmarcPolicy: DmarcPolicy
  mtaStsMode: MtaStsPolicy
  /**
   * MTA-STS max age in seconds
   */
  mtaStsAge: number,
  tlsrptEnabled: boolean
  tlsaEnabled: boolean
  bimiEnabled: boolean
  dnsSecEnabled: boolean
  monitoring: boolean
  /**
   * Time in days to retain history data of the domain
   */
  retentionPolicy: number
}

export interface SecyurDomainMxRecord {
  domainId: number
  mxDomain: string
  priority: number
  active: boolean
  firstSeen: Date
  lastSeen: Date
}
