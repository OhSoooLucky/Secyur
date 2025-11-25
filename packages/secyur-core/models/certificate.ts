export interface Certificate {
  subject: string
  commonName: string
  serial: string
  signatureAlgorithm: string

  issuer: string

  notBefore: Date
  notAfter: Date 
}

export interface X509Certificate extends Certificate {
  extendedKeyUsages: string[]
  authorityKeyIdentifier: string

  subjectKeyIdentifier: string
  subjectAlternativeNames: string

  caIssuers: string
  ocsp: string
}
