import { StatusList, getListFromStatusListJWT } from '@sd-jwt/jwt-status-list'
import { isDid } from 'packages/core/src/utils'
import { injectable } from 'tsyringe'
import { AgentContext } from '../../../../agent'
import { JwsService, Jwt, JwtPayload } from '../../../../crypto'
import { CredoError } from '../../../../error'
import { DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../../../dids'
import { SdJwtVcModuleConfig } from '../../SdJwtVcModuleConfig'
import { SdJwtVcIssuer } from '../../SdJwtVcOptions'
import { SdJwtVcService } from '../../SdJwtVcService'
import { TokenStatusListError } from './TokenStatusListError'
import {
  PublishTokenStatusListOptions,
  TokenStatusListJwtPayload,
  TokenStatusListRegistry,
} from './TokenStatusListRegistry'

export interface CreateTokenStatusListOptions extends PublishTokenStatusListOptions {
  size: number
  publish: boolean
}

export interface CreateTokenStatusListResult {
  jwt: string
  uri?: string
}

export interface RevokeIndicesOptions {
  indices: number[]
  publish: boolean
}

/**
 * @internal
 */
@injectable()
export class TokenStatusListService {
  private sdJwtVcModuleConfig: SdJwtVcModuleConfig

  public constructor(sdJwtVcModuleConfig: SdJwtVcModuleConfig) {
    this.sdJwtVcModuleConfig = sdJwtVcModuleConfig
  }

  async createStatusList(
    agentContext: AgentContext,
    issuer: SdJwtVcIssuer,
    options: CreateTokenStatusListOptions
  ): Promise<CreateTokenStatusListResult> {
    const sdJwtService = agentContext.dependencyManager.resolve(SdJwtVcService)
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const statusList = new StatusList(new Array(options.size).fill(0), 1)

    const issuerKey = await sdJwtService.extractKeyFromIssuer(agentContext, issuer, true)

    // construct jwt payload
    const jwtPayload = new JwtPayload({
      iss: issuerKey.iss,
      iat: Math.floor(Date.now() / 1000),
      additionalClaims: {
        status_list: {
          bits: statusList.getBitsPerStatus(),
          lst: statusList.compressStatusList(),
        },
      },
    })

    // sign JWT
    const jwt = await jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: issuerKey.publicJwk.keyId,
      protectedHeaderOptions: {
        alg: issuerKey.alg,
        typ: 'statuslist+jwt',
        kid: issuerKey.kid,
      },
    })

    if (options.publish) {
      const uri = await this.publishStatusList(agentContext, issuer, jwt, options)
      return { jwt, uri }
    }

    return { jwt }
  }

  async revokeIndex(
    agentContext: AgentContext,
    issuer: SdJwtVcIssuer,
    statusListUri: SdJwtVcIssuer,
    options: RevokeIndicesOptions
  ): Promise<boolean> {
    const sdJwtService = agentContext.dependencyManager.resolve(SdJwtVcService)
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const { indices, publish, ...publishOptions } = options

    const currentStatusListJwt = await this.getStatusList(agentContext, statusListUri)
    const parsedStatusListJwt = Jwt.fromSerializedJwt(currentStatusListJwt)

    // extract and validate iss
    const iss = parsedStatusListJwt.payload.iss as string
    if (issuer.method === 'did' && parseDid(issuer.didUrl).did !== iss) {
      throw new TokenStatusListError('Invalid issuer')
    }
    if (issuer.method === 'x5c' && issuer.issuer !== iss) {
      throw new TokenStatusListError('Invalid issuer')
    }

    const header = parsedStatusListJwt.header

    const statusList = getListFromStatusListJWT(currentStatusListJwt)
    // update indices
    for (const revokedIndex of options.indices) {
      statusList.setStatus(revokedIndex, 1)
    }

    const issuerKey = await sdJwtService.extractKeyFromIssuer(agentContext, issuer, true)

    // construct jwt payload
    const jwtPayload = new JwtPayload({
      iss,
      iat: Math.floor(Date.now() / 1000),
      additionalClaims: {
        status_list: {
          bits: statusList.getBitsPerStatus(),
          lst: statusList.compressStatusList(),
        },
      },
    } satisfies TokenStatusListJwtPayload)

    const jwt = await jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: issuerKey.publicJwk.keyId,
      protectedHeaderOptions: {
        alg: issuerKey.alg,
        typ: header.typ,
        kid: issuerKey.kid,
      },
    })

    if (options.publish) {
      await this.publishStatusList(agentContext, issuer, jwt, {
        ...publishOptions,
        previousStatusListUri: statusListUri,
      })
    }

    return true
  }

  async getStatus(agentContext: AgentContext, statusListUri: SdJwtVcIssuer, index: number): Promise<number> {
    const currentStatusListJwt = await this.getStatusList(agentContext, statusListUri)
    const statusList = getListFromStatusListJWT(currentStatusListJwt)
    return statusList.getStatus(index)
  }

  async getStatusList(agentContext: AgentContext, statusListUri: SdJwtVcIssuer): Promise<string> {
    const registry = this.findRegistry(statusListUri)
    if (!registry) {
      throw new TokenStatusListError(`No token status list registry registered for statusListUri ${statusListUri}`)
    }
    const jwt = await registry.retrieve(agentContext, statusListUri)

    // verify jwt
    const verified = await this.verifyStatusList(agentContext, statusListUri, jwt)
    if (!verified.isValid) {
      throw new TokenStatusListError('Invalid Jwt in the provided statusListUri')
    }

    return jwt
  }

  getStatusListFetcher(agentContext: AgentContext) {
    return async (uri: string) => {
      const statusListUri: SdJwtVcIssuer = isDid(uri)
        ? { method: 'did', didUrl: uri }
        : { method: 'x5c', issuer: uri, x5c: [] }
      return await this.getStatusList(agentContext, statusListUri)
    }
  }

  async publishStatusList(
    agentContext: AgentContext,
    issuer: SdJwtVcIssuer,
    jwt: string,
    options: PublishTokenStatusListOptions
  ): Promise<string> {
    // verify jwt
    const verified = await this.verifyStatusList(agentContext, issuer, jwt)
    if (!verified.isValid) {
      throw new TokenStatusListError('Invalid Jwt in the provided statusListUri')
    }

    const registry = this.findRegistry(issuer)
    if (!registry) {
      throw new TokenStatusListError(`No token status list registry registered for issuer ${issuer}`)
    }
    return await registry.publish(agentContext, issuer, jwt, options)
  }

  private findRegistry(issuer: SdJwtVcIssuer): TokenStatusListRegistry | null {
    let method: string
    if (issuer.method === 'did') {
      method = parseDid(issuer.didUrl).method
    } else {
      method = 'http' // TODO: implement x5c handler
    }

    return this.sdJwtVcModuleConfig.registries.find((r) => r.supportedMethods.includes(method)) ?? null
  }

  private async verifyStatusList(agentContext: AgentContext, issuer: SdJwtVcIssuer, jwt: string) {
    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    return await jwsService.verifyJws(agentContext, {
      jws: jwt,
      resolveJwsSigner: async ({ protectedHeader: { alg, kid } }) => {
        if (issuer.method === 'did') {
          if (!kid || typeof kid !== 'string') throw new CredoError('Missing kid in protected header.')

          const { did } = parseDid(issuer.didUrl)
          const didUrl = `${did}${kid}`
          const didsApi = agentContext.dependencyManager.resolve(DidsApi)
          const didDocument = await didsApi.resolveDidDocument(did)
          const verificationMethod = didDocument.dereferenceKey(didUrl)
          const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

          return {
            alg,
            method: issuer.method,
            didUrl,
            jwk: publicJwk,
          }
        }
        throw new Error('To be implemented') // TODO: Handle x5c
      },
    })
  }
}
