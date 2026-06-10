import { readFileSync } from 'node:fs'
import path from 'node:path'

import { InjectionSymbols, Kms } from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from '../../../../../askar/src/AskarModuleConfig'
import { AskarKeyManagementService } from '../../../../../askar/src/kms/AskarKeyManagementService'
import { getAgentConfig, getAgentContext } from '../../../../../core/tests/helpers'
import testLogger from '../../../../../core/tests/logger'
import { NodeFileSystem } from '../../../../../node/src/NodeFileSystem'

import { DidCommV2EnvelopeService } from '../../DidCommV2EnvelopeService'
import type { DidCommV2EncryptedMessage, DidCommV2PlaintextMessage } from '../../types'

interface X25519PrivateJwk {
  kty: 'OKP'
  crv: 'X25519'
  d: string
  x: string
}

interface SicpaAnoncryptFixture {
  encryptedMessage: DidCommV2EncryptedMessage
  expectedPlaintext: DidCommV2PlaintextMessage
  recipient: { kid: string; privateJwk: X25519PrivateJwk }
}

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, '../__fixtures__/sicpa/anoncrypt-x25519-xc20p.json'), 'utf-8')
) as SicpaAnoncryptFixture

describe('SICPA anoncrypt X25519 + XC20P interop', () => {
  const agentContext = getAgentContext({
    contextCorrelationId: 'sicpa-anoncrypt-x25519-xc20p',
    agentConfig: getAgentConfig('SicpaAnoncryptXC20PInterop'),
    kmsBackends: [new AskarKeyManagementService()],
    registerInstances: [
      [InjectionSymbols.Logger, testLogger],
      [InjectionSymbols.FileSystem, new NodeFileSystem()],
      [
        AskarModuleConfig,
        new AskarModuleConfig({
          multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
          askar,
          store: {
            id: 'sicpa-anoncrypt-x25519-xc20p',
            key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
            keyDerivationMethod: 'raw',
            database: { type: 'sqlite', config: { inMemory: true } },
          },
        }),
      ],
    ],
  })

  let envelopeService: DidCommV2EnvelopeService
  let recipientKey: Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }

  beforeAll(async () => {
    agentContext.dependencyManager.registerSingleton(DidCommV2EnvelopeService)
    envelopeService = agentContext.dependencyManager.resolve(DidCommV2EnvelopeService)

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const imported = await kms.importKey({ privateJwk: fixture.recipient.privateJwk })
    const recipient = Kms.PublicJwk.fromPublicJwk(imported.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
    recipient.keyId = imported.keyId
    recipientKey = recipient as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }
  })

  it('decrypts SICPA TEST_ENCRYPTED_DIDCOMM_MESSAGE_ANON_XC20P_1', async () => {
    const { plaintext, senderKey } = await envelopeService.unpack(agentContext, fixture.encryptedMessage, {
      recipientKey,
      matchedKid: fixture.recipient.kid,
      resolveSenderKey: async () => null,
    })

    expect(plaintext).toEqual(fixture.expectedPlaintext)
    expect(senderKey).toBeNull()
  })
})
