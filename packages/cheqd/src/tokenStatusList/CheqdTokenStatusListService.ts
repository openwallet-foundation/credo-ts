import { AgentContext, CredoError, getKeyFromVerificationMethod, Buffer, utils } from '@credo-ts/core'
import { StatusListPayload, StatusListToken } from './types'
import { createEmptyBitmap, decodeBitmap, encodeBitmap, isBitSet, setBit } from './utils/bitmap'
import { CheqdCreateResourceOptions, CheqdDidResolver } from '../dids'
import { TokenStatusList } from './types/tokenStatusList'
import { CheqdApi } from '../CheqdApi'
import { parseCheqdDid } from '../anoncreds/utils/identifiers'
import base64url from 'base64url'

export class CheqdTokenStatusListService implements TokenStatusList {
  private async loadStatusList(
    agentContext: AgentContext,
    statusListId: string
  ): Promise<{
    metadata: any
    bitmap: Buffer
    jwt: string
  }> {
    const api = agentContext.dependencyManager.resolve(CheqdApi)
    const resource = await api.resolveResource(statusListId)
    const jwt = resource.resource?.data.toString()
    const payload = JSON.parse(Buffer.from(jwt!.split('.')[1], 'base64').toString()) as StatusListPayload
    return {
      metadata: resource.resourceMetadata,
      bitmap: decodeBitmap(payload.status_list.bits),
      jwt,
    }
  }

  async createStatusList(
    agentContext: AgentContext,
    did: string,
    name: string,
    tag: string,
    size: number,
    signer: any // what could be passed as the signer
  ): Promise<StatusListToken> {
    const api = agentContext.dependencyManager.resolve(CheqdApi)
    const bitmap = createEmptyBitmap(size)
    const payload: StatusListPayload = {
      iss: did,
      iat: Math.floor(Date.now() / 1000),
      status_list: {
        encoding: 'bitstring',
        bits: encodeBitmap(bitmap),
      },
    }

    const jwt = await signer.signJWT(payload)

    const resource = {
      collectionId: did.split(':')[3],
      id: utils.uuid(),
      name: name,
      resourceType: 'StatusList',
      data: jwt,
      version: tag || utils.uuid(),
    } satisfies CheqdCreateResourceOptions

    await api.createResource(did, resource)

    return {
      jwt,
      metadata: {
        statusListId: resource.id,
        issuedAt: payload.iat,
        size: size,
      },
    }
  }

  async revokeIndex(
    agentContext: AgentContext,
    statusListId: string,
    index: number,
    tag: string,
    signer: string
  ): Promise<StatusListToken> {
    const api = agentContext.dependencyManager.resolve(CheqdApi)
    const parsedDid = parseCheqdDid(statusListId)
    if (!parsedDid) throw new CredoError(`Invalid statusListId: ${statusListId}`)

    const { bitmap, metadata } = await this.loadStatusList(agentContext, statusListId)
    setBit(bitmap, index)

    // Build payload
    const payload: StatusListPayload = {
      iss: parsedDid.did,
      iat: Math.floor(Date.now() / 1000),
      status_list: {
        encoding: 'bitstring',
        bits: encodeBitmap(bitmap),
      },
    }

    const resolverService = agentContext.dependencyManager.resolve(CheqdDidResolver)
    const { didDocument } = await resolverService.resolve(agentContext, parsedDid.did, parsedDid)
    if (!didDocument || !didDocument.verificationMethod || !didDocument.verificationMethod.length)
      throw new Error('Did is not valid')
    const method = didDocument.verificationMethod[0]

    // Build header
    const header = {
      alg: 'ES256',
      kid: method.id, // e.g. 'did:cheqd:testnet:xyz123#key-1'
    }

    // encode
    const encodedHeader = base64url.encode(JSON.stringify(header))
    const encodedPayload = base64url.encode(JSON.stringify(payload))
    const signingInput = `${encodedHeader}.${encodedPayload}`
    // sign payload
    const key = getKeyFromVerificationMethod(method)
    const signature = await agentContext.wallet.sign({ data: Buffer.from(signingInput), key })

    // construct jwt
    const jwt = `${signingInput}.${base64url.encode(signature.toLocaleString())}`

    const resource = {
      collectionId: parsedDid.did,
      id: utils.uuid(),
      name: metadata.name,
      resourceType: metadata.type,
      data: jwt,
      version: tag || utils.uuid(),
    } satisfies CheqdCreateResourceOptions

    await api.createResource(parsedDid.did, resource)

    return {
      jwt,
      metadata: {
        statusListId,
        issuedAt: payload.iat,
        size: bitmap.length * 8,
      },
    }
  }

  async isRevoked(agentContext: AgentContext, statusListId: string, index: number): Promise<boolean> {
    const { bitmap } = await this.loadStatusList(agentContext, statusListId)
    return isBitSet(bitmap, index)
  }

  async getStatusListToken(agentContext: AgentContext, statusListId: string): Promise<StatusListToken> {
    const { jwt, metadata, bitmap } = await this.loadStatusList(agentContext, statusListId)
    const parsedDid = parseCheqdDid(statusListId)
    if (!parsedDid) throw new CredoError(`Invalid statusListId: ${statusListId}`)

    return {
      jwt,
      metadata: {
        statusListId,
        issuedAt: metadata.createdAt,
        size: bitmap.length * 8,
      },
    }
  }
}
