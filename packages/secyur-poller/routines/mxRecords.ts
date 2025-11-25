import { DnsRecordType, MxRecord } from "@ohsooolucky/secyur-core/models/dns";
import { SecyurDomain } from "@ohsooolucky/secyur-core/models/domain";
import { SecyurPoller } from "../index";
import { SecyurDnsError } from "../error";


export default async function getActiveMxRecords(secyurPoller: SecyurPoller, domain: SecyurDomain | string) {
  if (typeof(domain) === 'string') {
    secyurPoller.log.trace({ url: { domain } },
      'Provided domain is a string, fetching domain object from storage')
    domain = await secyurPoller.storage.getDomainByName(domain)
  }

  const logBase = { url: { domain: domain.domain }, secyur: { domain: { id: domain.id } } } as any

  try {
    const recordsPromise = secyurPoller.getRecord('@', domain, DnsRecordType.Mx)
      .then(x => {
        secyurPoller.log.info(Object.assign({}, { ...logBase, secyur: Object.assign({}, logBase.secyur, { rowCount: x.length }) }),
          'Fetched all DNS records from multiple resolvers')
        return x
      })
    const storedRecordsPromise = secyurPoller.storage.getMxRecordsByDomain(domain.id, true)
      .then(x => {
        secyurPoller.log.info(Object.assign({}, { ...logBase, secyur: Object.assign({}, logBase.secyur, { rowCount: x.length }) }),
          'Fetched all stored DNS records from storage')
        return x
      })

    const records = await Promise.all([ recordsPromise, storedRecordsPromise ])


    const updatePromises = []
    // No MX records are known or active, fill up with what we have
    if (records[1].length === 0) {
      secyurPoller.log.debug(logBase,
        'No stored MX records found, inserting resolved directly')
      for (const record of records[0] as MxRecord[]) {
        record.domainId = domain.id
        
        updatePromises.push(secyurPoller.storage.createMXRecord(record))
      }
    } else {
      // Check every record against the existing
      for (const record of records[0] as MxRecord[]) {
        const existingRecord = records[1].find(x => x.value === record.value && x.priority === record.priority)
        if (existingRecord == null) {
          record.domainId = domain.id
          secyurPoller.log.debug(Object.assign({}, { ...logBase, secyur: Object.assign({}, logBase.secyur, { dns: record }) }),
            'Record does not exist, creating new mx record')
          secyurPoller.storage.createMXRecord(record)
        } else {
          existingRecord.lastObserved = record.firstObserved // Set the correct last observed timestamp.
          existingRecord.resolvers = record.resolvers
          existingRecord.ttl = record.ttl

          secyurPoller.log.debug(Object.assign({}, { ...logBase, secyur: Object.assign({}, logBase.secyur, { dns: record }) }),
            'Updating existing records with latest findings')
          updatePromises.push(secyurPoller.storage.updateMxRecord(existingRecord))
        }
      }

      const updatedRecords = await Promise.all(updatePromises)

      // Set untouched records to inactive
      const staleRecords = records[1].filter(x => updatedRecords.indexOf(x) === -1)
      for (const record of staleRecords) {
        secyurPoller.log.debug(Object.assign({}, { ...logBase, secyur: Object.assign({}, logBase.secyur, { dns: record }) }),
          'Record is stale, deactivating')
        record.active = false
        updatePromises.push(secyurPoller.storage.updateMxRecord(record))
      }
    }

    await Promise.all(updatePromises) // Catch any errors
  } catch (error) {
    if (error instanceof SecyurDnsError) {
      secyurPoller.log.error({
        error,
        secyur: {
          domain: { id: domain.id },
          dns: { recordType: DnsRecordType.Mx }
        },
        url: { domain: domain.domain }
      }, error.message)
    }
  }
}
