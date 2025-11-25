import { FastifyInstance } from "fastify";
import { SecyurDbError, SecyurStorage } from "@ohsooolucky/secyur-core/models/db";
import { MtaStsPolicy } from "@ohsooolucky/secyur-core/models/policies";

export default function(fastify: FastifyInstance, options: any, done: Function) {
  fastify.get('/.well-known/mta-sts.txt', async (req, reply) => {
    const storage = fastify.getDecorator('storage') as SecyurStorage

    const domainName = req.host.replace(/^mta-sts\./i, '')

    req.log.debug({ url: { domain: domainName } }, 'Getting domain details for domain')
    try {
      const domain = await storage.getDomainByName(domainName)

      // TO-DO: Get all polled (active) mx records and provide them in the mx list
      const mxRecords = await storage.getMxRecordsByDomain(domain.id, true)
      const mxRecordsText = mxRecords.sort((x, y) => x.priority - y.priority)
        .map(x => `mx: ${x.value}`).join('\n')

      reply.statusCode = 200
      return reply.send(`version: STSv1\nmode: ${MtaStsPolicy[domain.mtaStsMode].toLowerCase()}\n${mxRecordsText}\nmax_age: ${domain.mtaStsAge}`)
    } catch (error) {
      if (error instanceof SecyurDbError) {
        reply.log.warn({ url: { domain: domainName } }, 'Couldn\'t fetch domain name from the storage provider')
        reply.statusCode = 404
        reply.send()
      } else {
        reply.log.warn({ error, url: { domain: domainName } }, 'Couldn\'t fetch domain name from the storage provider')
        reply.statusCode = 500
        reply.send()
      }
    }
  })

  done()
}