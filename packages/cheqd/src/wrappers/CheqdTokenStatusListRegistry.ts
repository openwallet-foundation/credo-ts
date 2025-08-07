import {
  type AgentContext,
  CredoError,
  Jwt,
  PublishTokenStatusListOptions,
  SdJwtVcIssuerDid,
  TokenStatusListRegistry,
  TypedArrayEncoder,
  parseDid,
  utils,
} from '@credo-ts/core'
import { cheqdSdkAnonCredsRegistryIdentifierRegex, parseCheqdDid } from '../anoncreds/utils/identifiers'
import { CheqdCreateResourceOptions, CheqdDidRegistrar, CheqdDidResolver } from '../dids'

export class CheqdTokenStatusListRegistry implements TokenStatusListRegistry {
  methodName = 'cheqd'
  supportedIdentifier: RegExp = cheqdSdkAnonCredsRegistryIdentifierRegex

  /**
   * Publish a verified token status list JWT to the registry
   */
  async publish(
    agentContext: AgentContext,
    issuer: SdJwtVcIssuerDid,
    jwt: string,
    options: PublishTokenStatusListOptions
  ): Promise<string> {
    const cheqdDidRegistrar = agentContext.dependencyManager.resolve(CheqdDidRegistrar)
    const cheqdDidResolver = agentContext.dependencyManager.resolve(CheqdDidResolver)

    const parsedDid = parseCheqdDid(issuer.didUrl)
    if (!parsedDid) {
      throw new Error('Invalid did:cheqd')
    }
    const { did } = parsedDid

    if (options.uri) {
      const response = await cheqdDidResolver.resolveResource(agentContext, options.uri)
      if (response.error || !response.resourceMetadata) {
        throw new CredoError(response.message)
      }

      options.name = response.resourceMetadata.name
    }

    if (!options.name) {
      throw new CredoError('Status List Name is Required')
    }

    // Parse the JWT
    let parsedJwt: Jwt
    try {
      parsedJwt = Jwt.fromSerializedJwt(jwt)
    } catch (_error) {
      throw new CredoError('Invalid JWT format')
    }

    // Validate iss
    if (parsedJwt.payload.iss !== did) {
      throw new CredoError(`JWT 'iss' (${parsedJwt.payload.iss}) does not match expected DID (${did})`)
    }

    // Validate signature
    const didResolver = agentContext.dependencyManager.resolve(CheqdDidResolver)

    const { didDocument } = await didResolver.resolve(agentContext, did, parsedDid)
    if (!didDocument) throw new CredoError(`Unable to resolve DID Document for ${did}`)

    const method = didDocument.verificationMethod?.find((vm) => vm.id === issuer.didUrl)
    if (!method) throw new CredoError(`No verification method found for issuer ${issuer.didUrl}`)

    // Upload to Cheqd
    const resourcePayload: CheqdCreateResourceOptions = {
      collectionId: parseDid(did).id,
      id: utils.uuid(),
      name: options.name,
      resourceType: 'TokenStatusList',
      data: TypedArrayEncoder.toBase64(TypedArrayEncoder.fromString(jwt)),
      version: options.version ?? utils.uuid(),
    }

    const response = await cheqdDidRegistrar.createResource(agentContext, did, resourcePayload)
    if (response.resourceState.state !== 'finished') {
      throw new CredoError(response.resourceState.reason ?? 'Unknown error')
    }

    // return statusListUri
    return `${did}?resourceName=${options.name}&resourceType=TokenStatusList`
  }

  /**
   * Retrieve a token status list JWT from the registry
   */
  async resolve(agentContext: AgentContext, uri: string): Promise<string> {
    const cheqdDidResolver = agentContext.dependencyManager.resolve(CheqdDidResolver)

    const response = await cheqdDidResolver.resolveResource(agentContext, uri)
    if (response.error || !response.resourceMetadata) {
      throw new CredoError(response.message)
    }

    return TypedArrayEncoder.fromBase64(response.resource).toString()
  }
}
