import { SecyurPostgresMigrator } from ".";

export const up = async (migrator: SecyurPostgresMigrator) => {
  try {
    await migrator.client.query('BEGIN TRANSACTION')

    // Migrations table
    await migrator.client.query(`CREATE TABLE migrations (
      version INTEGER NOT NULL CHECK (version >= 0),
      name    TEXT    NOT NULL,

      PRIMARY KEY (version, name)
    );`)

    // Domains table
    await migrator.client.query(`CREATE TABLE domains (
      id                 BIGSERIAL PRIMARY KEY,
      domain             TEXT NOT NULL UNIQUE,
      added              TIMESTAMPTZ NOT NULL                                     DEFAULT now(),
      modified           TIMESTAMPTZ NOT NULL                                     DEFAULT now(),

      "spfPolicy"        SMALLINT NOT NULL CHECK ("spfPolicy" BETWEEN 0 AND 2)    DEFAULT 0,
      "dkimSelectors"    SMALLINT NOT NULL CHECK ("dkimSelectors" >= 0)           DEFAULT 0,
      "dmarcPolicy"      SMALLINT NOT NULL CHECK ("dmarcPolicy" BETWEEN 0 AND 2)  DEFAULT 0,
      "mtaStsMode"       SMALLINT NOT NULL CHECK ("mtaStsMode" BETWEEN 0 AND 2)   DEFAULT 0,
      "mtaStsAge"        INT NOT NULL CHECK ("mtaStsAge" BETWEEN 0 AND 31557600)  DEFAULT 86400,       
      "tlsrptEnabled"    BOOLEAN NOT NULL                                         DEFAULT false,
      "tlsaEnabled"      BOOLEAN NOT NULL                                         DEFAULT false,
      "bimiEnabled"      BOOLEAN NOT NULL                                         DEFAULT false,
      "dnsSecEnabled"    BOOLEAN NOT NULL                                         DEFAULT false,
      monitoring         BOOLEAN NOT NULL                                         DEFAULT false,
      "retentionPolicy"  SMALLINT NOT NULL CHECK ("retentionPolicy" >= 0)         DEFAULT 3650
    );

    CREATE OR REPLACE FUNCTION set_modified_now()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.modified := now();
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER domains_touch BEFORE UPDATE ON domains
      FOR EACH ROW EXECUTE FUNCTION set_modified_now();`)

    await migrator.client.query(`CREATE INDEX IF NOT EXISTS domains_domain_idx ON domains (domain);`)

    await migrator.client.query(`
      CREATE TABLE "dnsRecords" (
        "id"              BIGSERIAL PRIMARY KEY,
        "domainId"        BIGINT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
        "type"            SMALLINT NOT NULL CHECK ("type" BETWEEN 0 AND 7),
        "record"          TEXT NOT NULL,
        "value"           TEXT NOT NULL,
        "ttl"             INT NOT NULL DEFAULT 0 CHECK ("ttl" >= 0),
        "firstObserved"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "lastObserved"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "active"          BOOLEAN NOT NULL DEFAULT true,
        "version"         SMALLINT CHECK ("version" IS NULL OR "version" >= 0),
        "resolvers"       JSONB,

        CONSTRAINT "dnsRecords_unique_record" UNIQUE ("domainId", "type", "record", "value", "firstObserved")
      );

      CREATE INDEX IF NOT EXISTS "dnsRecords_domain_idx" ON "dnsRecords" ("domainId");
      CREATE INDEX IF NOT EXISTS "dnsRecords_type_idx" ON "dnsRecords" ("type");
      CREATE INDEX IF NOT EXISTS "dnsRecords_active_idx" ON "dnsRecords" ("domainId", "active");

      CREATE FUNCTION ensure_dns_record_type() RETURNS trigger AS $$
      BEGIN
        PERFORM 1 FROM "dnsRecords" WHERE "id" = NEW."dnsRecordId" AND "type" = TG_ARGV[0]::SMALLINT;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'dnsRecord type mismatch for %, expected type %', NEW."dnsRecordId", TG_ARGV[0];
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TABLE "mxRecords" (
        "dnsRecordId" BIGINT PRIMARY KEY REFERENCES "dnsRecords"("id") ON DELETE CASCADE,
        "priority"    SMALLINT NOT NULL CHECK ("priority" >= 0)
      );
      CREATE TRIGGER "mxRecords_type_check" BEFORE INSERT ON "mxRecords"
        FOR EACH ROW EXECUTE FUNCTION ensure_dns_record_type('1');

      CREATE TABLE "dmarcRecords" (
        "dnsRecordId"      BIGINT PRIMARY KEY REFERENCES "dnsRecords"("id") ON DELETE CASCADE,
        "policy"           SMALLINT NOT NULL CHECK ("policy" BETWEEN 0 AND 2),
        "subdomainPolicy"  SMALLINT CHECK ("subdomainPolicy" BETWEEN 0 AND 2),
        "alignment"        SMALLINT CHECK ("alignment" >= 0),
        "spfStrict"        BOOLEAN,
        "dkimStrict"       BOOLEAN,
        "failurePolicy"    JSONB,
        "reportInterval"   TEXT,
        "reportFormat"     TEXT,
        "reportEndpoint"   JSONB,
        "failureEndpoint"  JSONB
      );
      CREATE TRIGGER "dmarcRecords_type_check" BEFORE INSERT ON "dmarcRecords"
        FOR EACH ROW EXECUTE FUNCTION ensure_dns_record_type('2');

      CREATE TABLE "dkimRecords" (
        "dnsRecordId" BIGINT PRIMARY KEY REFERENCES "dnsRecords"("id") ON DELETE CASCADE,
        "publicKey"   TEXT NOT NULL,
        "algorithm"   TEXT CHECK ("algorithm" IN ('rsa', 'ed25519') OR "algorithm" IS NULL)
      );
      CREATE TRIGGER "dkimRecords_type_check" BEFORE INSERT ON "dkimRecords"
        FOR EACH ROW EXECUTE FUNCTION ensure_dns_record_type('4');

      CREATE TABLE "spfRecords" (
        "dnsRecordId" BIGINT PRIMARY KEY REFERENCES "dnsRecords"("id") ON DELETE CASCADE,
        "mxAllowed"   BOOLEAN NOT NULL,
        "ipv4"        JSONB NOT NULL DEFAULT '[]'::jsonb,
        "ipv6"        JSONB NOT NULL DEFAULT '[]'::jsonb,
        "includes"    JSONB NOT NULL DEFAULT '[]'::jsonb,
        "qualifier"   SMALLINT NOT NULL CHECK ("qualifier" BETWEEN 0 AND 2)
      );
      CREATE TRIGGER "spfRecords_type_check" BEFORE INSERT ON "spfRecords"
        FOR EACH ROW EXECUTE FUNCTION ensure_dns_record_type('3');

      CREATE TABLE "mtaStsRecords" (
        "dnsRecordId" BIGINT PRIMARY KEY REFERENCES "dnsRecords"("id") ON DELETE CASCADE,
        "stsId"       TEXT NOT NULL
      );
      CREATE TRIGGER "mtaStsRecords_type_check" BEFORE INSERT ON "mtaStsRecords"
        FOR EACH ROW EXECUTE FUNCTION ensure_dns_record_type('5');

      CREATE TABLE "tlsaRecords" (
        "dnsRecordId" BIGINT PRIMARY KEY REFERENCES "dnsRecords"("id") ON DELETE CASCADE
      );
      CREATE TRIGGER "tlsaRecords_type_check" BEFORE INSERT ON "tlsaRecords"
        FOR EACH ROW EXECUTE FUNCTION ensure_dns_record_type('6');

      CREATE TABLE "tlsRptRecords" (
        "dnsRecordId" BIGINT PRIMARY KEY REFERENCES "dnsRecords"("id") ON DELETE CASCADE,
        "rua"         JSONB NOT NULL DEFAULT '[]'::jsonb
      );
      CREATE TRIGGER "tlsRptRecords_type_check" BEFORE INSERT ON "tlsRptRecords"
        FOR EACH ROW EXECUTE FUNCTION ensure_dns_record_type('7');
    `)

    await migrator.client.query(`INSERT INTO migrations (version, name) VALUES (1, '1_initial');`)
    await migrator.client.query('COMMIT TRANSACTION')
  } catch (error) {
    await migrator.client.query('ROLLBACK TRANSACTION')
    throw error
  }
}
