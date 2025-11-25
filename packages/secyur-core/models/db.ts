import { SecyurError } from "../error"
import { SecyurDomain } from "./domain"
import { MxRecord } from './dns'

export interface SecyurStorage {
  readonly initialized: boolean

  getAllDomains: () => Promise<SecyurDomain[]>
  getDomain: (domainId: number) => Promise<SecyurDomain>
  getDomainByName: (name: string) => Promise<SecyurDomain>

  updateDomain: (domain: SecyurDomain) => Promise<boolean>
  createDomain: (domain: SecyurDomain) => Promise<SecyurDomain>
  deleteDomain: (domainId: number) => Promise<boolean>

  getMxRecordsByDomain: (domain: number | string, active: boolean)
    => Promise<MxRecord[]>
  createMXRecord: (record: MxRecord) => Promise<MxRecord>
  updateMxRecord: (record: MxRecord) => Promise<MxRecord>

  // purgeDkimRecords: (beforeDate: Date) => Promise<SecyurPurgeReport>
  init: () => Promise<void>
}

export class SecyurDbError extends SecyurError {}
