import type { AgentContext } from '../../agent'
import type { Jwt } from '../../crypto'
import { X509Service } from './X509Service'

export function extractX509CertificatesFromJwt(agentContext: AgentContext, jwt: Jwt) {
  return jwt.header.x5c?.map((cert) => X509Service.parseCertificate(agentContext, { encodedCertificate: cert }))
}
