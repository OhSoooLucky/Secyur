import pino from "pino"

export enum EcsCompatibility {
  ECSv8 = "v8",
  ECSv9 = "v9"
}

export interface SecyurLoggingOptions extends pino.LoggerOptions {
  service?: {
    name: string,
    version: string
    environment: string
  }
  /**
   * Specify what ECS compatibility to apply
   */
  ecsCompatibility?: EcsCompatibility | null | undefined
  /**
   * Provide OpenTelemetry compatibility
   */
  otCompatibility?: boolean
}

export interface SecyurCoreOptions {
  logging?: SecyurLoggingOptions
}

export class SecyurValidationError extends Error {}
