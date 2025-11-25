import { DmarcRecord } from "./dns"
import { DmarcPolicy, SpfPolicy } from "./policies"

export interface SecyurReport {
  date: Date,
  result: boolean
}

export interface SecyurPurgeReport extends SecyurReport {
  purgedBefore: Date
  dmarcReports: number
  tlsReports: number
}

export interface DmarcMetadata {
  /**
   * @field report_metadata.report_id
   */ 
  reportId: string
  /**
   * @field report_metadata.org_name
   */
  orgName: string
  /**
   * @field report_metadata.email
   */
  email: string

  dateRange: {
    /**
     * @field report_metadata.date_rage.begin
     */
    begin: Date
    /**
     * @field report_metadata.date_rage.end
     */
    end: Date
  }
}

export interface DmarcIdentifiers {
  /**
   * @field record.identifiers.envelope_to
   */
  envelopeTo?: string
  /**
   * @field record.identifiers.envelope_from
   */
  envelopeFrom?: string
  /**
   * @field record.identifiers.header_from
   */
  headerFrom?: string
}

export interface DmarcAuthResults {
  dkim: {
    domain: string
    selector: string
    result: boolean
  }
  spf: {
    domain: string
    scope: string
    result: SpfPolicy
  }
}
export interface DmarcPolicyEvaluation {
  deposition: DmarcPolicy
  dkim: boolean
  spf: boolean
}

export interface DmarcReportRecord {
  row: {
    sourceIp: string
    count: number
    policyEvaluated: DmarcPolicyEvaluation
  }

  authResults: DmarcAuthResults
  identifiers: DmarcIdentifiers
}


export interface DmarcReport {
  /**
   * @field version
   * @default 1
   */
  version?: number
  date: Date

  reportMetadata: DmarcMetadata
  policyPublished: DmarcRecord
  records: DmarcReportRecord[]
}