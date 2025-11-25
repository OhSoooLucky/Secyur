import { DnsRecord } from './dns';
/**
 * DANE TLSA RR record's CA Usage policy 
 * @see https://en.wikipedia.org/wiki/DNS-based_Authentication_of_Named_Entities#Certificate_usage
 */
export enum TLSACAUsage {
  /**
   * The certificate provided when establishing TLS must be issued by the listed root-CA or one of its intermediate CAs,
   */
  CAConstraint = 0,
  /**
   * The certificate used must match the TLSA record, and it must also pass PKIX certification path validation to a trusted root-CA
   */
  PKIX_EE = 1,
  /**
   * The certification path must be valid up to the matching certificate, but there is no need for a trusted root-CA
   */
  DANE_TA = 2,
  /**
   * The TLSA record matches the used certificate itself. The used certificate does not need to be signed by other parties
   */
  DANE_EE = 3
}

/**
 * DANE TLSA RR record's certificate selector policy
 */
export enum TLSASelector {
  /**
   * Use the entire certificate from the service
   */
  EntireCertificate = 0,
  /**
   * Only use the public key from the certificate
   */
  MatchPublicKey = 1
}

export enum TLSAMatchingType {
  /**
   * The entire information selected is present in the certificate association data.
   */
  InformationPresent = 0,
  /**
   * Do a SHA-256 hash of the selected data.
   */
  SHA256 = 1,
  /**
   * Do a SHA-512 hash of the selected data.
   */
  SHA512 = 2
}

/**
 * 
 * 
 * MODELS
 * 
 */
export interface DaneRecord extends DnsRecord {
  /**
   * 
   */
  usage: TLSACAUsage
  /**
   * 
   */
  selector: TLSASelector
  /**
   * 
   */
  matcher: TLSAMatchingType
  /**
   * 
   */
  certificateAssociationData: string
}
