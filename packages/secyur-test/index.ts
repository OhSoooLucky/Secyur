import { SecyurCore } from "@ohsooolucky/secyur-core";
import { EcsCompatibility } from "@ohsooolucky/secyur-core/models/configuration";
import { DmarcPolicy, MtaStsPolicy, SpfPolicy } from "@ohsooolucky/secyur-core/models/policies";
import { SecyurPostgresStorage } from "@ohsooolucky/secyur-db-postgres";

const secyurCore = new SecyurCore({
  logging: {
    level: 'trace',
    ecsCompatibility: EcsCompatibility.ECSv8
  }
})
const storage = await secyurCore.useStorage(core => new SecyurPostgresStorage(core, {
  host: '::1',
  port: 5432,
  user: 'testing',
  password: 'example',
  database: 'secyur'
}))
