import type { Key, Logger } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import { utils, KeyType, Jwt, Agent, TypedArrayEncoder } from '@aries-framework/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'

import { agentDependencies } from '../../../core/tests'
import { SdJwtService } from '../SdJwtService'

const logger = jest.fn() as unknown as Logger

const agent = new Agent({
  config: { label: 'sdjwtserviceagent', walletConfig: { id: utils.uuid(), key: utils.uuid() } },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  modules: { askar: new AskarModule({ ariesAskar }) },
  dependencies: agentDependencies,
})

describe('SdJwtService', () => {
  let issuerKey: Key
  let sdJwtService: SdJwtService

  beforeAll(async () => {
    await agent.initialize()

    issuerKey = await agent.context.wallet.createKey({
      keyType: KeyType.Ed25519,
      seed: TypedArrayEncoder.fromString('testseed000000000000000000000001'),
    })

    agent.context.wallet.generateNonce = jest.fn(() => Promise.resolve('salt'))

    sdJwtService = new SdJwtService(logger)
  })

  describe('SdJwtService.create', () => {
    test('Create sd-jwt from jwt', async () => {
      const jwt = Jwt.fromSerializedJwt('eyJhbGciOiAiRVMyNTYifQ.eyJpc3MiOiAiaHR0cHM6Ly9leGFtcGxlLm9yZyJ9.')

      const sdJwtRecord = await sdJwtService.create(agent.context, jwt, {
        issuerKey,
        disclosureFrame: { iss: true },
      })

      expect(sdJwtRecord.sdJwt).toStrictEqual(
        'eyJhbGciOiJFUzI1NiJ9.eyJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyJXREI0NVFkTy05TmhINUxaci1sam5uNkM0UFByZV9CNlpENzZzX2s0dTVZIl19.iPZNMfZya6HRSxnDdgfW4v_aivzpGJ3zuJ_fQ_cebFoxyXDqGeSQds2KBci4rM1FhAdy8GhK9BP6DiTRTafmBQ~WyJzYWx0IiwiaXNzIiwiaHR0cHM6Ly9leGFtcGxlLm9yZyJd~'
      )
    })

    test('Create sd-jwt from payload without disclosures', async () => {
      const payload = {
        hello: 'world!',
      }

      const sdJwtRecord = await sdJwtService.create(agent.context, payload, {
        issuerKey,
      })

      expect(sdJwtRecord.sdJwt).toStrictEqual(
        'eyJhbGciOiJFZERTQSJ9.eyJoZWxsbyI6IndvcmxkISIsIl9zZF9hbGciOiJzaGEtMjU2In0.KEAdW_EVeqgNmMpb6EGu0NFGaYFHz2nXcd8Gs6vimHy1XGiV3cFKyxZZwkapH6gEyq6bjSarj5K-XBK21iUOBw'
      )
    })

    test('Create sd-jwt from payload with disclosures', async () => {
      const payload = {
        hello: 'world!',
        selectivelyDiscloseMe: 'secret_value',
      }

      const sdJwtRecord = await sdJwtService.create(agent.context, payload, {
        issuerKey,
        disclosureFrame: { selectivelyDiscloseMe: true },
      })

      expect(sdJwtRecord.sdJwt).toStrictEqual(
        'eyJhbGciOiJFZERTQSJ9.eyJoZWxsbyI6IndvcmxkISIsIl9zZF9hbGciOiJzaGEtMjU2IiwiX3NkIjpbIjJWOElKclZvcWx1bnRFOWUwdTRxY2VVT2ttUkRNd1hBZlItREVVeDJBck0iXX0.Yr3nVwq_-1NSCpW6S_UdGe-LLuKSHhk7BG8Jsb50VjQFsTP54ILbIAQHXHvMl0qx7c6Vq5oGov4-jxWGqpyDAA~WyJzYWx0Iiwic2VsZWN0aXZlbHlEaXNjbG9zZU1lIiwic2VjcmV0X3ZhbHVlIl0~'
      )
    })
  })
})
