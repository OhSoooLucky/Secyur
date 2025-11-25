import server from 'fastify'
import { validateLoggingConfiguration } from '@ohsooolucky/secyur-core/logger'
import { EcsCompatibility } from '@ohsooolucky/secyur-core/models/configuration'
import { SecyurCore } from '@ohsooolucky/secyur-core'
import { SecyurPostgresStorage } from '@ohsooolucky/secyur-db-postgres'
import { version as pkgVersion } from './package.json'
import mtaSts from './controllers/mta-sts'


const fastify = await server({
  disableRequestLogging: false,
  logger: validateLoggingConfiguration({
    level: 'info',
    service: {
      name: 'secyur-mta-sts',
      version: pkgVersion,
      environment: process.env.NODE_ENV ?? 'production'
    },
    ecsCompatibility: EcsCompatibility.ECSv8,
    otCompatibility: true
  })
})


const secyurCore = new SecyurCore({
  logging: {
    level: 'trace',
    ecsCompatibility: EcsCompatibility.ECSv8,
    otCompatibility: true
  }
})
const storage = await secyurCore.useStorage(core => new SecyurPostgresStorage(core, {
  host: '::1',
  port: 5432,
  user: 'testing',
  password: 'example',
  database: 'secyur'
}))

fastify.decorate('storage', storage)

fastify.register(mtaSts, { prefix: '/' })

await fastify.listen({
  host: '::',
  exclusive: true,
  port: 80
})
