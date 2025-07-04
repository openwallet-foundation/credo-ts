import { type AgentContext, Buffer, CredoError, Jwt, utils } from '@credo-ts/core'
import {
  PublishTokenStatusListOptions,
  TokenStatusListRegistry,
} from 'packages/core/src/modules/sd-jwt-vc/credential-status/token-status-list/TokenStatusListRegistry'
import { parseCheqdDid } from '../anoncreds/utils/identifiers'
import { CheqdCreateResourceOptions, CheqdDidRegistrar, CheqdDidResolver } from '../dids'

export interface CheqdPublishTokenStatusListOptions extends PublishTokenStatusListOptions {
  name: string
}

export class CheqdTokenStatusListRegistry implements TokenStatusListRegistry {
  public readonly supportedMethods = ['cheqd']
  public readonly allowsCaching = true

  /**
   * Publish a verified token status list JWT to the registry
   */
  async publish(
    agentContext: AgentContext,
    statusListId: string,
    jwt: string,
    options: CheqdPublishTokenStatusListOptions
  ): Promise<string> {
    const parsedDid = parseCheqdDid(statusListId)
    if (!parsedDid) {
      throw new Error('Invalid did:cheqd')
    }
    const { did } = parsedDid

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

    const kid = parsedJwt.header.kid
    if (!kid) throw new CredoError(`JWT is missing 'kid' header`)

    const method = didDocument.verificationMethod?.find((vm) => vm.id === kid)
    if (!method) throw new CredoError(`No verification method found for kid ${kid}`)

    // Upload to Cheqd
    const cheqdDidRegistrar = agentContext.dependencyManager.resolve(CheqdDidRegistrar)

    const resourcePayload: CheqdCreateResourceOptions = {
      collectionId: did.split(':')[3],
      id: utils.uuid(),
      name: options.name,
      resourceType: 'TokenStatusList',
      data: Buffer.from(jwt),
      version: options.version ?? utils.uuid(),
    }

    const response = await cheqdDidRegistrar.createResource(agentContext, did, resourcePayload)
    if (response.resourceState.state !== 'finished') {
      throw new CredoError(response.resourceState.reason ?? 'Unknown error')
    }

    return `${did}?resourceName=${options.name}&resourceType=TokenStatusList`
  }

  /**
   * Retrieve a token status list JWT from the registry
   */
  async retrieve(agentContext: AgentContext, statusListId: string): Promise<string> {
    const cheqdDidResolver = agentContext.dependencyManager.resolve(CheqdDidResolver)

    const response = await cheqdDidResolver.resolveResource(agentContext, statusListId)
    if (response.error) {
      throw new CredoError(response.message)
    }

    return response.resource
  }
}
