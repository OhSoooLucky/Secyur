import { AnyRecord, CaaRecord, MxRecord, NaptrRecord, SoaRecord, SrvRecord, TlsaRecord } from "node:dns";

export interface ResolveResult {
  resolver: string,
  observed: Date,
  timeTaken: number,
  records: string[] | MxRecord[] | TlsaRecord[] | string[][]
      | SoaRecord | AnyRecord[] | CaaRecord[] | NaptrRecord[] | SrvRecord[]
}