import { DmarcFailurePolicy, DmarcPolicy, SpfPolicy } from "./policies"

export enum DnsRecordType {
  Txt     = 0,
  Mx      = 1,
  Dmarc   = 2,
  Spf     = 3,
  Dkim    = 4,
  MtaSts  = 5,
  Tlsa    = 6,
  TlsRpt  = 7
}

export enum DkimKeyType {
  Rsa = 'rsa',
  Ed25519 = 'ed25519'
}

export enum RuaContactType {
  MailTo = 'mailto',
  Https = 'https'
}

export interface RuaContact {
  type: RuaContactType
  value: string
}

export interface DnsRecord {
  id?: number
  type: DnsRecordType
  /**
   * Record name
   */
  record: string
  /**
   * Record value text
   */
  value: string

  /**
   * DNS record Time-To-Live value (i.e. max caching age)
   */
  ttl: number

  firstObserved?: Date
  lastObserved?: Date
  active?: boolean,
  resolvers?: string[]
  domainId?: number
}

export interface PersistedDnsRecord extends DnsRecord {
  id: number
  domainId: number
  firstObserved: Date
  lastObserved: Date
  active: boolean
}

export interface MxRecord extends DnsRecord {
  type: DnsRecordType.Mx
  priority: number
}

export interface TxtRecord extends DnsRecord {
  type: DnsRecordType.Txt | DnsRecordType.Dmarc | DnsRecordType.Dkim
    | DnsRecordType.Spf | DnsRecordType.MtaSts | DnsRecordType.Tlsa
    | DnsRecordType.TlsRpt
  version: number
}


export interface DmarcRecord extends TxtRecord {
  type: DnsRecordType.Dmarc
  /**
   * DMARC Policy for the main domain (and subdomains if sp is unset)
   * @field p
   */
  policy: DmarcPolicy
  /**
   * DMARC Policy for subdomains
   * @field sp
   */
  subdomainPolicy?: DmarcPolicy
  /**
   * Apply percentage
   * @description Amount of e-mails to hold subject to the DMARC policies
   * @field pct
   */
  alignment?: number
  /**
   * SPF Alignment policy
   * @field aspf
   */
  spfStrict?: boolean
  /**
   * DKIM Alignment policy
   * @field adkim
   */
  dkimStrict?: boolean
  /**
   * Alignment combination policy requirements
   * @field fo
   */
  failurePolicy: DmarcFailurePolicy | DmarcFailurePolicy[]

  /**
   * Reporting interval
   * @field ri
   * @default '1 DAY'
   */
  reportInterval?: string
  /**
   * Reporting format (forensic reporting)
   * @field rf
   * @default afrf
   */
  reportFormat?: string
  /**
   * Reporting endpoint URI
   * @field rua
   */
  reportEndpoint?: RuaContact[]
  /**
   * Failure reporting endpoint URI
   * @field ruf
   */
  failureEndpoint?: RuaContact[]
}

export interface DkimRecord extends TxtRecord {
  type: DnsRecordType.Dkim
  publicKey: string
  algorithm?: DkimKeyType
}

export interface SpfRecord extends TxtRecord {
  type: DnsRecordType.Spf
  mxAllowed: boolean
  ipv4: string[]
  ipv6: string[]
  includes: string[]
  qualifier: SpfPolicy
}

export interface MtaStsRecord extends TxtRecord {
  type: DnsRecordType.MtaSts
  stsId: string
}

export interface TlsRptRecord extends TxtRecord {
  type: DnsRecordType.TlsRpt
  rua: RuaContact[]
}
export interface TlsaRecord extends TxtRecord {
  type: DnsRecordType.Tlsa
}