import type { AgentContext } from '@credo-ts/core'
import { JwsService, JwtPayload, X509Certificate } from '@credo-ts/core'
import { createHeaderAndPayload, StatusList } from '@owf/token-status-list'
import { PublicJwk } from '../../kms'

export const generateStatusList = async (
  agentContext: AgentContext,
  key: PublicJwk,
  issuerDidUrl: string,
  length: number,
  revokedIndexes: number[],
  // `createHeaderAndPayload` always sets the `typ`, so a wrong `typ` is set on the JWS header instead
  overrides: { typ?: string; sub?: string } = {}
): Promise<string> => {
  const statusList = new StatusList(
    Array.from({ length }, (_, i) => (revokedIndexes.includes(i) ? 1 : 0)),
    1
  )

  const [did, keyId] = issuerDidUrl.split('#')
  const { header, payload } = createHeaderAndPayload(
    statusList,
    {
      iss: did,
      sub: overrides.sub ?? 'https://example.com/status-list',
      iat: Date.now() / 1000,
    },
    {
      alg: 'EdDSA',
      typ: 'statuslist+jwt',
      kid: `#${keyId}`,
    }
  )

  const jwsService = agentContext.dependencyManager.resolve(JwsService)
  return jwsService.createJwsCompact(agentContext, {
    keyId: key.keyId,
    payload: JwtPayload.fromJson(payload),
    protectedHeaderOptions: {
      ...header,
      alg: 'EdDSA',
      ...(overrides.typ ? { typ: overrides.typ } : {}),
    },
  })
}

// Generates a status list JWT signed with an `x5c` header (x509), instead of a `kid` (did).
export const generateX509StatusList = async (
  agentContext: AgentContext,
  key: PublicJwk,
  certificate: X509Certificate,
  length: number,
  revokedIndexes: number[]
): Promise<string> => {
  const statusList = new StatusList(
    Array.from({ length }, (_, i) => (revokedIndexes.includes(i) ? 1 : 0)),
    1
  )

  const { payload } = createHeaderAndPayload(
    statusList,
    {
      iss: 'https://example.com',
      sub: 'https://example.com/status-list',
      iat: Date.now() / 1000,
    },
    {
      alg: 'ES256',
      typ: 'statuslist+jwt',
    }
  )

  const jwsService = agentContext.dependencyManager.resolve(JwsService)
  return jwsService.createJwsCompact(agentContext, {
    keyId: key.keyId,
    payload: JwtPayload.fromJson(payload),
    protectedHeaderOptions: {
      alg: 'ES256',
      typ: 'statuslist+jwt',
      x5c: [certificate.toString('base64')],
    },
  })
}
