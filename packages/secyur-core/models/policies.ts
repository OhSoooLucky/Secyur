/**
 * SPF policy Mode based on the TXT selector
 */
export enum SpfPolicy {
  /**
   * Do not mark mail at all, effectively nullifying SPF
   */
  Neutral = 0,
  /**
   * Mark failing mail as suspicious or quarantine the item (vendor/recipient policies)
   */
  SoftFail = 1,
  /**
   * Reject failing mail
   */
  HardFail = 2
}

/**
 * DMARC Policy Mode based on the TXT selector
 */
export enum DmarcPolicy {
  /**
   * Test-mode. Report failures to the rua and/or ruf recipients.
   * No policy is applied to the actual mail traffic.
   */
  None = 0,
  /**
   * Send failing e-mails to spam or quarantine (vendor/recipient policies)
   */
  Quarantine = 1,
  /**
   * Do not accept the mail. Reply to the server with a reject statuscode
   */
  Reject = 2
}

/**
 * The DMARC policy to be applied to a domain
 */
export enum DmarcFailurePolicy {
  /**
   * Report when both DKIM and SPF fail
   */
  DkimAndSpf = 0,
  /**
   * Report when either DKIM or SPF fails
   */
  DkimOrSpf = 1,
  /**
   * Report only when DKIM fails
   */
  Dkim = 2,
  /**
   * Report only when SPF fails
   */
  Spf = 3
}

/**
 * MTA-STS Policy to be applied and hosted for the domain
 */
export enum MtaStsPolicy {
  /**
   * Disable/Do not apply this MTA-STS policy
   */
  None = 0,
  /**
   *  Do not force TLS but report abilities via TLSRPT
   */
  Testing = 1,
  /**
   * Enforce and report abilities via TLSRPT
   */
  Enforce = 2
}
