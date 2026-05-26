import { CoseKey } from '@owf/cose'
import {
  createHeaderAndPayload,
  fetchStatusList,
  getListFromStatusListJWT,
  StatusList,
  StatusListCwt,
} from '@owf/token-status-list'
import type { AgentContext } from '../../agent'
import { type JwsProtectedHeaderOptions, JwsService, Jwt, JwtPayload } from '../../crypto'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'
import { KeyManagementApi } from '../kms'
import { getMac0Context } from './context/mac0Context'
import { getSign1Context } from './context/sign1Context'
import type {
  BatchUpdateTokenStatusListOptions,
  CreateTokenStatusListOptions,
  FetchTokenStatusListOptions,
  UpdateTokenStatusListOptions,
} from './TokenStatusListOptions'

/**
 * @internal
 *
 * @todo with what value should we initialize the array? Valid or Invalid?
 */
@injectable()
export class TokenStatusListService {
  public async createTokenStatusList(
    agentContext: AgentContext,
    options: CreateTokenStatusListOptions
  ): Promise<Uint8Array | string> {
    const statusList = new StatusList(
      new Array(options.statusListLength).fill(0),
      options.bitsPerStatus,
      options.aggregationUri
    )
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId: options.keyId })
    if (!jwk.alg) {
      throw new CredoError(`Found JWK for key id '${options.keyId}', but did not find a required algorithm`)
    }
    if (options.format === 'cwt') {
      const cwt = StatusListCwt.createFromStatusListAndSubject(statusList, options.hostingUri)
      const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')
      if (shouldAuthenticate) {
        const mac0Context = getMac0Context(agentContext)
        return await cwt.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, mac0Context)
      } else {
        const sign1Context = getSign1Context(agentContext)
        return await cwt.signAndEncode({ signingKey: CoseKey.fromJwk(jwk) }, sign1Context)
      }
    }

    if (options.format === 'jwt') {
      const { header, payload } = createHeaderAndPayload(
        statusList,
        { cnf: { jwk } },
        { alg: jwk.alg, typ: 'statuslist+jwt' }
      )
      const jwsService = agentContext.dependencyManager.resolve(JwsService)
      return await jwsService.createJwsCompact(agentContext, {
        payload: new JwtPayload({ additionalClaims: payload }),
        keyId: options.keyId,
        protectedHeaderOptions: header as JwsProtectedHeaderOptions,
      })
    }

    throw new CredoError(`Could not create token status list with format '${options.format}'`)
  }

  public async updateTokenStatusList<TSL extends Uint8Array | string>(
    agentContext: AgentContext,
    options: UpdateTokenStatusListOptions<TSL>
  ): Promise<TSL> {
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId: options.keyId })
    if (!jwk.alg) {
      throw new CredoError(`Found JWK for key id '${options.keyId}', but did not find a required algorithm`)
    }
    if (options.token instanceof Uint8Array) {
      const cwt = StatusListCwt.fromToken(options.token)
      cwt.updateStatusList(options.index, options.value)
      const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')
      if (shouldAuthenticate) {
        const mac0Context = getMac0Context(agentContext)
        return (await cwt.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, mac0Context)) as TSL
      } else {
        const sign1Context = getSign1Context(agentContext)
        return (await cwt.signAndEncode({ signingKey: CoseKey.fromJwk(jwk) }, sign1Context)) as TSL
      }
    } else if (typeof options.token === 'string') {
      // TODO: we need to update the token-status-list library JWT code to be in sync with CWT
      const statusList = getListFromStatusListJWT(options.token)
      const jwt = Jwt.fromSerializedJwt(options.token)
      statusList.setStatus(options.index, options.value)
      const jwsService = agentContext.dependencyManager.resolve(JwsService)
      return (await jwsService.createJwsCompact(agentContext, {
        payload: new JwtPayload({ additionalClaims: { ...jwt, status_list: statusList } }),
        keyId: options.keyId,
        protectedHeaderOptions: jwt.header as JwsProtectedHeaderOptions,
      })) as TSL
    }

    throw new CredoError(`Could not update status list in token for token '${options.token}'`)
  }

  public async batchUpdateTokenStatusList<TSL extends Uint8Array | string>(
    agentContext: AgentContext,
    options: BatchUpdateTokenStatusListOptions<TSL>
  ): Promise<TSL> {
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId: options.keyId })
    if (!jwk.alg) {
      throw new CredoError(`Found JWK for key id '${options.keyId}', but did not find a required algorithm`)
    }
    if (options.token instanceof Uint8Array) {
      const cwt = StatusListCwt.fromToken(options.token)
      for (const [idx, value] of options.indexAndValue) {
        cwt.updateStatusList(idx, value)
      }
      const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')
      if (shouldAuthenticate) {
        const mac0Context = getMac0Context(agentContext)
        return (await cwt.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, mac0Context)) as TSL
      } else {
        const sign1Context = getSign1Context(agentContext)
        return (await cwt.signAndEncode({ signingKey: CoseKey.fromJwk(jwk) }, sign1Context)) as TSL
      }
    } else if (typeof options.token === 'string') {
      // TODO: we need to update the token-status-list library JWT code to be in sync with CWT
      const statusList = getListFromStatusListJWT(options.token)
      const jwt = Jwt.fromSerializedJwt(options.token)
      for (const [idx, value] of options.indexAndValue) {
        statusList.setStatus(idx, value)
      }
      const jwsService = agentContext.dependencyManager.resolve(JwsService)
      return (await jwsService.createJwsCompact(agentContext, {
        payload: new JwtPayload({ additionalClaims: { ...jwt, status_list: statusList } }),
        keyId: options.keyId,
        protectedHeaderOptions: jwt.header as JwsProtectedHeaderOptions,
      })) as TSL
    }

    throw new CredoError(`Could not update status list in token for token '${options.token}'`)
  }

  public async fetchTokenStatusList<TSL extends Uint8Array | string = Uint8Array | string>(
    agentContext: AgentContext,
    options: FetchTokenStatusListOptions
  ): Promise<TSL> {
    return (await fetchStatusList({
      uri: options.uri,
      customFetcher: agentContext.config.agentDependencies.fetch,
    })) as TSL
  }
}
