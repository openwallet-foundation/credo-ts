import type { AgentContext } from '../../agent'
import type { Jwt } from '../../crypto'
import { X509Service } from './X509Service'
import type { EncodedX509Certificate } from './X509ServiceOptions'

/**
 * Parses the certificates of an `x5c` header through the X.509 module, which reuses parsed certificates.
 */
export function parseX5c(agentContext: AgentContext, x5c: EncodedX509Certificate[]) {
  return x5c.map((certificate) => X509Service.parseCertificate(agentContext, { encodedCertificate: certificate }))
}

export function extractX509CertificatesFromJwt(agentContext: AgentContext, jwt: Jwt) {
  return jwt.header.x5c ? parseX5c(agentContext, jwt.header.x5c) : undefined
}
