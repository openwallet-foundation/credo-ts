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

interface P256PrivateJwk {
  kty: 'EC'
  crv: 'P-256'
  d: string
  x: string
  y: string
}

interface P256PublicJwk {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
}

interface SicpaAuthcryptP256Fixture {
  encryptedMessage: DidCommV2EncryptedMessage
  expectedPlaintext: DidCommV2PlaintextMessage
  recipient: { kid: string; privateJwk: P256PrivateJwk }
  sender: { kid: string; publicJwk: P256PublicJwk }
}

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, '../__fixtures__/sicpa/authcrypt-p256-a256cbc.json'), 'utf-8')
) as SicpaAuthcryptP256Fixture

describe('SICPA authcrypt P-256 + A256CBC-HS512 interop', () => {
  const agentContext = getAgentContext({
    contextCorrelationId: 'sicpa-authcrypt-p256',
    agentConfig: getAgentConfig('SicpaAuthcryptP256Interop'),
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
            id: 'sicpa-authcrypt-p256',
            key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
            keyDerivationMethod: 'raw',
            database: { type: 'sqlite', config: { inMemory: true } },
          },
        }),
      ],
    ],
  })

  let envelopeService: DidCommV2EnvelopeService
  let recipientKey: Kms.PublicJwk<Kms.P256PublicJwk> & { keyId: string }
  let senderPublicJwk: Kms.PublicJwk<Kms.P256PublicJwk>

  beforeAll(async () => {
    agentContext.dependencyManager.registerSingleton(DidCommV2EnvelopeService)
    envelopeService = agentContext.dependencyManager.resolve(DidCommV2EnvelopeService)

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const imported = await kms.importKey({ privateJwk: fixture.recipient.privateJwk })
    const recipient = Kms.PublicJwk.fromPublicJwk(imported.publicJwk) as Kms.PublicJwk<Kms.P256PublicJwk>
    recipient.keyId = imported.keyId
    recipientKey = recipient as Kms.PublicJwk<Kms.P256PublicJwk> & { keyId: string }

    senderPublicJwk = Kms.PublicJwk.fromPublicJwk(fixture.sender.publicJwk) as Kms.PublicJwk<Kms.P256PublicJwk>
    senderPublicJwk.keyId = fixture.sender.kid
  })

  it('decrypts SICPA TEST_ENCRYPTED_DIDCOMM_MESSAGE_AUTH_P256', async () => {
    const { plaintext, senderKey } = await envelopeService.unpack(agentContext, fixture.encryptedMessage, {
      recipientKey: recipientKey as unknown as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
      matchedKid: fixture.recipient.kid,
      resolveSenderKey: async (skid) =>
        skid === fixture.sender.kid ? (senderPublicJwk as unknown as Kms.PublicJwk<Kms.X25519PublicJwk>) : null,
    })

    expect(plaintext).toEqual(fixture.expectedPlaintext)
    expect(senderKey).not.toBeNull()
  })
})
