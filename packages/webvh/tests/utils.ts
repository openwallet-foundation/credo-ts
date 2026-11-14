import { type AgentContext, DidDocument, DidDocumentService, Kms, VerificationMethod } from '@credo-ts/core'
import type { WebVhDidCreateOptions } from '../src'

export const validDid = 'did:webvh:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE:domain.example'

export function validVerificationMethod(did: string) {
  return new VerificationMethod({
    id: `${did}#key-1`,
    type: 'Multikey',
    controller: did,
    publicKeyMultibase: 'z6MkkBaWtQKyx7Mr54XaXyMAEpNKqphK4x7ztuBpSfR6Wqwr',
  })
}

export function validService(did: string) {
  return new DidDocumentService({
    id: `${did}#service-1`,
    type: 'CustomType',
    serviceEndpoint: 'https://example.com',
  })
}

export function validDidDoc() {
  const service = [validService(validDid)]
  const verificationMethod = [validVerificationMethod(validDid)]

  return new DidDocument({
    id: validDid,
    verificationMethod,
    service,
  })
}

export async function createWebVhTestKey(agentContext: AgentContext) {
  const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
  const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
  return { keyId: key.keyId, multikey: Kms.PublicJwk.fromPublicJwk(key.publicJwk).fingerprint }
}

export async function createWebVhTestOptions(
  agentContext: AgentContext,
  address = 'id.test-suite.app',
  paths?: string[]
): Promise<WebVhDidCreateOptions> {
  const { keyId, multikey } = await createWebVhTestKey(agentContext)
  return {
    method: 'webvh',
    didDocument: DidDocument.fromJSON({
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
      id: '{DID}',
      controller: '{DID}',
      verificationMethod: [
        {
          id: '{DID}#assertion-key',
          type: 'Multikey',
          controller: '{DID}',
          publicKeyMultibase: multikey,
        },
      ],
      authentication: ['{DID}#assertion-key'],
      assertionMethod: ['{DID}#assertion-key'],
    }),
    options: {
      address,
      paths,
      keys: [{ didDocumentRelativeKeyId: '#assertion-key', kmsKeyId: keyId }],
      updateKeys: [multikey],
      updateKeyKmsKeyIds: { [multikey]: keyId },
    },
  }
}
