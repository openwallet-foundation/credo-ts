import type { AgentContext } from '../../agent'
import type { Key, Wallet } from '@aries-framework/core'

import { IndySdkWallet } from '../../../../indy-sdk/src'
import { indySdk } from '../../../../indy-sdk/tests/setupIndySdkModule'
import { getAgentConfig, getAgentContext } from '../../../tests/helpers'
import { DidKey } from '../../modules/dids'
import { Buffer, JsonEncoder, TypedArrayEncoder } from '../../utils'
import { JwsService } from '../JwsService'
import { KeyType } from '../KeyType'
import { SigningProviderRegistry } from '../signing-provider'

import * as didJwsz6Mkf from './__fixtures__/didJwsz6Mkf'
import * as didJwsz6Mkv from './__fixtures__/didJwsz6Mkv'

describe('JwsService', () => {
  let wallet: Wallet
  let agentContext: AgentContext
  let jwsService: JwsService
  let didJwsz6MkfKey: Key
  let didJwsz6MkvKey: Key
  beforeAll(async () => {
    const config = getAgentConfig('JwsService')
    // TODO: update to InMemoryWallet
    wallet = new IndySdkWallet(indySdk, config.logger, new SigningProviderRegistry([]))
    agentContext = getAgentContext({
      wallet,
    })
    await wallet.createAndOpen(config.walletConfig)

    jwsService = new JwsService()
    didJwsz6MkfKey = await wallet.createKey({
      privateKey: TypedArrayEncoder.fromString(didJwsz6Mkf.SEED),
      keyType: KeyType.Ed25519,
    })
    didJwsz6MkvKey = await wallet.createKey({
      privateKey: TypedArrayEncoder.fromString(didJwsz6Mkv.SEED),
      keyType: KeyType.Ed25519,
    })
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('createJws', () => {
    it('creates a jws for the payload with the key associated with the verkey', async () => {
      const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)
      const kid = new DidKey(didJwsz6MkfKey).did

      const jws = await jwsService.createJws(agentContext, {
        payload,
        key: didJwsz6MkfKey,
        header: { kid },
        protectedHeaderOptions: {
          alg: 'EdDSA',
          jwk: didJwsz6MkfKey.toJwk(),
        },
      })

      expect(jws).toEqual(didJwsz6Mkf.JWS_JSON)
    })
  })

  describe('verifyJws', () => {
    it('returns true if the jws signature matches the payload', async () => {
      const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)

      const { isValid, signerKeys } = await jwsService.verifyJws(agentContext, {
        payload,
        jws: didJwsz6Mkf.JWS_JSON,
      })

      expect(isValid).toBe(true)
      expect(signerKeys).toEqual([didJwsz6MkfKey])
    })

    it('returns all verkeys that signed the jws', async () => {
      const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)

      const { isValid, signerKeys } = await jwsService.verifyJws(agentContext, {
        payload,
        jws: { signatures: [didJwsz6Mkf.JWS_JSON, didJwsz6Mkv.JWS_JSON] },
      })

      expect(isValid).toBe(true)
      expect(signerKeys).toEqual([didJwsz6MkfKey, didJwsz6MkvKey])
    })

    it('returns false if the jws signature does not match the payload', async () => {
      const payload = JsonEncoder.toBuffer({ ...didJwsz6Mkf.DATA_JSON, did: 'another_did' })

      const { isValid, signerKeys } = await jwsService.verifyJws(agentContext, {
        payload,
        jws: didJwsz6Mkf.JWS_JSON,
      })

      expect(isValid).toBe(false)
      expect(signerKeys).toMatchObject([])
    })

    it('throws an error if the jws signatures array does not contain a JWS', async () => {
      await expect(
        jwsService.verifyJws(agentContext, {
          payload: new Buffer([]),
          jws: { signatures: [] },
        })
      ).rejects.toThrowError('Unable to verify JWS: No entries in JWS signatures array.')
    })
  })
})
