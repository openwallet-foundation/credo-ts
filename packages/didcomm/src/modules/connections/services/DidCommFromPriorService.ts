import {
  type AgentContext,
  CredoError,
  type DidDocument,
  DidResolverService,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  injectable,
  JsonEncoder,
  JwsService,
  JwtPayload,
  type VerificationMethod,
} from '@credo-ts/core'

export interface FromPriorPayload {
  iss: string
  sub?: string
  iat: number
}

@injectable()
export class DidCommFromPriorService {
  private jwsService: JwsService

  public constructor(jwsService: JwsService) {
    this.jwsService = jwsService
  }

  /**
   * Build a `from_prior` JWT that signals termination of the relationship.
   *
   * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#ending-a-relationship
   * Payload contains `iss` (prior DID) and `iat`; `sub` is omitted to indicate
   * rotation to nothing. Signed by an authentication key authorized by `priorDid`.
   */
  public async createForTermination(agentContext: AgentContext, priorDid: string): Promise<string> {
    const dids = agentContext.dependencyManager.resolve(DidsApi)
    const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(priorDid)

    const authVm = this.findAuthenticationVerificationMethod(didDocument)
    const kmsKey = keys?.find(({ didDocumentRelativeKeyId }) => authVm.id.endsWith(didDocumentRelativeKeyId))
    if (!kmsKey) {
      throw new CredoError(`No KMS key for authentication verification method '${authVm.id}' of '${priorDid}'`)
    }

    const payload = new JwtPayload({
      iss: priorDid,
      iat: Math.floor(Date.now() / 1000),
    })

    return this.jwsService.createJwsCompact(agentContext, {
      keyId: kmsKey.kmsKeyId,
      payload,
      protectedHeaderOptions: {
        alg: 'EdDSA',
        kid: authVm.id,
        typ: 'JWT',
        crv: 'Ed25519',
      },
    })
  }

  /**
   * Verify a `from_prior` JWT and return its parsed payload.
   *
   * The signing key MUST be authorized in the `authentication` relationship of
   * the `iss` DID document, per
   * https://identity.foundation/didcomm-messaging/spec/v2.1/#did-rotation
   */
  public async verify(agentContext: AgentContext, jws: string): Promise<FromPriorPayload> {
    const resolver = agentContext.dependencyManager.resolve(DidResolverService)
    const dids = agentContext.dependencyManager.resolve(DidsApi)

    const result = await this.jwsService.verifyJws(agentContext, {
      jws,
      allowedJwsSignerMethods: ['did'],
      resolveJwsSigner: async ({ payload, protectedHeader }) => {
        const claims = JsonEncoder.fromBase64Url(payload)
        if (typeof claims.iss !== 'string') {
          throw new CredoError("from_prior JWT payload missing or invalid 'iss'")
        }
        const kid = typeof protectedHeader.kid === 'string' ? protectedHeader.kid : undefined
        if (!kid) {
          throw new CredoError("from_prior JWT protected header missing 'kid'")
        }

        const didDocument = await this.resolveDidDocument(agentContext, claims.iss, dids, resolver)
        const vm = didDocument.dereferenceKey(kid, ['authentication'])
        const publicJwk = getPublicJwkFromVerificationMethod(vm)

        return { method: 'did', didUrl: kid, jwk: publicJwk }
      },
    })

    if (!result.isValid) throw new CredoError('from_prior JWT signature verification failed')

    const payloadJson = JsonEncoder.fromBase64Url(result.jws.payload) as Record<string, unknown>
    if (typeof payloadJson.iss !== 'string') throw new CredoError("from_prior JWT missing 'iss'")
    if (typeof payloadJson.iat !== 'number') throw new CredoError("from_prior JWT missing 'iat'")
    if (payloadJson.sub !== undefined && typeof payloadJson.sub !== 'string') {
      throw new CredoError("from_prior JWT 'sub' must be a string if present")
    }

    return {
      iss: payloadJson.iss,
      sub: payloadJson.sub as string | undefined,
      iat: payloadJson.iat,
    }
  }

  private findAuthenticationVerificationMethod(didDocument: DidDocument): VerificationMethod {
    if (!didDocument.authentication?.length) {
      throw new CredoError(`DID document '${didDocument.id}' has no authentication verification methods`)
    }
    const first = didDocument.authentication[0]
    return typeof first === 'string' ? didDocument.dereferenceKey(first, ['authentication']) : first
  }

  private async resolveDidDocument(
    agentContext: AgentContext,
    did: string,
    dids: DidsApi,
    resolver: DidResolverService
  ): Promise<DidDocument> {
    try {
      const { didDocument } = await dids.resolveCreatedDidDocumentWithKeys(did)
      return didDocument
    } catch {
      return resolver.resolveDidDocument(agentContext, did)
    }
  }
}
