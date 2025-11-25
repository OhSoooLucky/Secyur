import pino from 'pino';
import os from 'os';

import pkg from './package.json'

import { EcsCompatibility, SecyurLoggingOptions, SecyurValidationError } from "./models/configuration";


export function validateLoggingConfiguration(logOptions: SecyurLoggingOptions) {
  logOptions.level = logOptions.level ?? process.env['APP_LOGLEVEL'] ?? 'info'

  if (logOptions.ecsCompatibility) {
    switch(logOptions.ecsCompatibility) {
      case EcsCompatibility.ECSv9:
      case EcsCompatibility.ECSv8:
        // Add base fields like service name
        logOptions.formatters = {
          level: (label: string) => ({ log: { level: label } })
        }
        logOptions.base = {
          service: logOptions.service ?? {
            name: 'secyur',
            version: pkg.version,
          },
          event: {
            module: 'secyur'
          },
          host: {
            architecture: process.arch,
            hostname: os.hostname(),
            type: os.platform()
          }
        }
        logOptions.base.service.environment = process.env.NODE_ENV ?? 'production'
        logOptions.timestamp = () => `,"@timestamp":${new Date().toISOString()}`
        break;
      default:
        throw new SecyurValidationError('Invalid ECS compatibility specified!')
    }
  } else {
    logOptions.timestamp = true
    logOptions.base = {
      service: logOptions.service?.name ?? 'secyur',
      version: logOptions.service?.version ?? pkg.version,
      env: logOptions.service?.environment ?? process.env.NODE_ENV ?? 'production',
      hostname: os.hostname(),
      hostType: os.platform()
    }
  }

  if (logOptions.otCompatibility) {
    Object.assign(logOptions.base, {
      deployment: {
        environment: {
          name: process.env.NODE_ENV ?? 'production'
        }
      }
    })
  }

  return logOptions
}

/**
 * Create a basic pino logger instance
 * @param logOptions 
 * @returns 
 */
export default function createLogger(logOptions?: SecyurLoggingOptions) {
  logOptions = validateLoggingConfiguration(logOptions ?? {})

  return pino(logOptions)
}
