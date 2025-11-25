b# E-mail essentials
A complete guide on securing an insecure mean of communication (by initial design).

## Email delivery
### Mailservers (MX)
MX records specify what servers should receive e-mail destined for the domain.


### Protocol security
Throughout the years, secondary patches have been implemented to try and secure
e-mail communications

#### SMTPS/STARTTLS
To secure mail delivery, SMTPS was born, running SSL/TLS on port 465 to encrypt
emails. A STARTTLS command was created on the normal SMTP port 25 to allow servers
to connect securily to deliver email to another smtp server using the standard
port as defined in RFC 5321.

> [!IMPORTANT]
> These remediations secure data from packet captures or information leaking in
> transit. None of them provide any means of authenticity


#### SMTP Submission
Port 587 was created to resolve misunderstandings and a reassigning of the port
to another service by IANA. Today this port is mainly used for receiving client
submissions, like a mailclient sending their email to their own mailserver for
scheduling delivery to the recipient. While port 25 is used for receiving
mailserver-to-mailserver delivery.

> [!NOTE]
> STARTTLS is available on port 587 in most applications, securing traffic implicitly.


#### Sender Policy Framework (SPF)
RFC 7208 proposes a standard built upon the experimental RFC 4408 to create a
TXT DNS record specifying a list of allowed senders.


Mailservers can pull the TXT record of type SPF from DNS to check if a sender is 
allowed to send as this domain.


The record consists of the following scheme
* **Version**: *v=spf1* -  specifies the record type (spf version 1)
* **Mechanisms**
  * **ip4:<cidr_ipv4>/<cidr_subnet_mask>** - Specifies an allowed IP range (allowed SMTP senders)
  * **ip6:<cidr_ipv6>/<cidr_subnet_mask>** - Specified an allowed IPv6 range to send.
  * **mx** - Authorizes all mail servers listed in the domain's DNS MX records
  * **a** - Authorizes all hosts defined in a DNS A-record
  * **include:<domain.tld>** - Includes all mechanisms specified on another domain or subdomain
* **Qualifiers**
  * **-*all*** - HARD FAIL; Reject mail from all unauthorized servers.
  * **~*all*** - SOFT FAIL; Mark mail as suspicious or send to quarantine.
  * **?*all*** - NEUTRAL; Do not mark mail at all, effectively **nullifying SPF**.

> [!TIP]
> When owning multiple domain variants (eg. domain.fr, domain.nl, domain.co.uk)
> you can configure the domains that are not used for sending mail with
> "v=spf1 -all" to reduce the risk of spam impersonating said domain.


Examples (BIND): 
```dns
# Allow Microsoft Office 365/Exchange Online to send as domain.tld
@ IN TXT "v=spf1 include:spf.protection.outlook.com ~all"


# Allow Google Workspace to send as domain.tld
# See https://support.google.com/a/answer/33786?hl=en
@ IN TXT "v=spf1 include:_spf.google.com ~all"

# Allow Mailchimp to send email as domain.tld
@ IN TXT "v=spf1 include:servers.mcsv.net ~all"


# Allow Microsoft Office 365/Exchange Online and all MX records to send as domain.tld
@ IN TXT "v=spf1 include:spf.protection.outlook.com mx ~all"
```

#### Domain-Key Identified Mail (DKIM)
DKIM can be setup to ensure mail authenticity and prove an email has not been
tampered with. DKIM cryptographically signs the mail headers with a private key. 
The public key is hosted in DNS for recipients to read and use in validation.


Benefits:
* **Tamper protection**: Mail headers are signed and any tampering will be
reflected in a failing DKIM check.
* **Sender verification**: (Ideally) only the authorized server(s) have access
to the private key to sign the e-mail. Access to DNS is required to modify the
public key(s).


The public key is published as a _domainkey TXT record prefixed with a selector.
Multiple selectors are allowed to uniquely identify an allowed sender or to allow
key rotation without e-mail delivery failures.
* **Version**: *v=DKIM1* - Specifies DKIM version 1
* **Key type**: *k=\<algorithm\>* - Type of key algorithm used
  * **rsa** - Commonly used. Supported key lengths are 1024-bit (obsolete imho)
  and 2048-bit (fine for now)
  * **ed25519** - Not widely supported still. Shorter keys with equal or better security.
* **Public key**: *p=\<base64\>* - Specifies the public key to be used in verification.
This key is encoded in base64 for DNS support. 


Example _domainkey TXT-record
*(Source: [Wikipedia](https://en.wikipedia.org/wiki/DomainKeys_Identified_Mail))*
```bind
brisbane._domainkey.domain.tld IN TXT "k=rsa; t=s; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDDmzRmJRQxLEuyYiyMg4suA2Sy
MwR5MGHpP9diNT1hRiwUd/mZp1ro7kIDTKS8ttkI6z6eTRW9e9dDOxzSxNuXmume60Cjbu08gOyhPG3
GfWdg7QkdN6kR4V75MFlw624VY35DaXBvnlTJTgRg/EW72O1DiYVThkyCgpSYS8nmEQIDAQAB"
```


Example DKIM-Signature header
*(Source: [Wikipedia](https://en.wikipedia.org/wiki/DomainKeys_Identified_Mail))*
```http
DKIM-Signature: v=1; a=rsa-sha256; d=example.net; s=brisbane;
     c=relaxed/simple; q=dns/txt; i=foo@eng.example.net;
     t=1117574938; x=1118006938; l=200;
     h=from:to:subject:date:keywords:keywords;
     z=From:foo@eng.example.net|To:joe@example.com|
       Subject:demo=20run|Date:July=205,=202005=203:44:08=20PM=20-0700;
     bh=MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=;
     b=dzdVyOfAKCdLXdJOc9G2q8LoXSlEniSbav+yuU4zGeeruD00lszZ
              VoG4ZHRNiYzR
```

#### DMARC
DMARC combines the power of SPF (Sender restrictions) and DKIM (Sender verification)
in a way that both policies have to be satisfied (configurable) for email to be
considered valid.


Using a _dmarc TXT record, a domain can specify what policies should be enforced.
* **Version**: *v=DMARC1* - Specified DMARC version 1
* **Policy**: *p=\<policy\>* - Policy tag (what to do when DMARC fails)
  * **none** - Test-mode. Report failure to rua and/or ruf recipients. Doesn't
  actually enfore or secure your domain.
  * **quarantine** - Send all failing e-mails to spam or quarantine
  * **reject** - Do not accept the mail, reply to the server with a reject message.
* **Aggregate report addres**: *rua=mailto:<dmarc_report_mailbox>* - A mail
recipient to send aggregated reports of mail failures using your domain. Most 
providers will send aggregated reports daily.
* **Percentage**: *pct=<0-100>* - Specifies the percentage of mails that get
tested against the policy. Default is 100%
* **Subdomain policy**: *sp=\<policy\>* - Specifies a seperate policy for
subdomains for this domain. Useful to reject all failing mail from subdomains,
while quarantining the main domain e-mails on failure.
* **SPF Alignment mode**: *aspf=\<mode\>* - Specifies strict or relaxed alignment
for SPF (default is **Relaxed**)
  * **r** - Relaxed - Allows SPF to fail without DMARC automatically failing too.
  * **s** - Strict - Requires SPF to succeed for DMARC to succeed.
* **DKIM Alignment mode**: *adkim=\<mode\>* - Strict or relaxed alignment for DKIM
(default is **Relaxed**)
  * **r** - Relaxed - Allows DKIM to fail without DMARC automatically failing too.
  * **s** - Strict - Requires DKIM to succeed for DMARC to succeed.
* **Forensic reports**: *ruf=mailto:<dmarc_report_mailbox>* - A mail recipient to
send detailed (possibly containing PII) reports. 
> [!NOTE]
> Forensic reports are rarely used or generated these days.
* **Forensic options**: *fo=\<mode\>* - DMARC Failure report mode (default is **0**)
  * **0** - Generate failure report if ALL undelying auth mechanisms fail (DKIM & 
  SPF)
  * **1** - Generate failure report if ANY underlying auth mechanism fails (DKIM 
  or SPF)
  * **d** - Generate failure report on signature evaluation
  failure, regardless if DMARC passed.
  * **s** - Generate SPF failure reports if SPF fails, regardless if DMARC passed
> [!TIP]
> The fo options can be combined with a comma delimiter, eg. 0,1,s -> Generate on
> any or all machanism failures and on SPF evaluation failures.
* **Report format**: *rf=\<format\>* - Specify a report format to receive
  * 


> [!TIP]
> Much like SPF, you can configure DMARC to strictly reject any mail coming from
> domains not used for sending mails.
> ```dns
> _dmarc  IN TXT     "v=DMARC1; p=reject; aspf=s; adkim=s;"
> ```

#### TLSRPT

