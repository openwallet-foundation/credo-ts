import { readFileSync } from 'node:fs'
import path from 'node:path'

import { InjectionSymbols, JsonEncoder, Kms } from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from '../../../../../askar/src/AskarModuleConfig'
import { AskarKeyManagementService } from '../../../../../askar/src/kms/AskarKeyManagementService'
import { getAgentConfig, getAgentContext } from '../../../../../core/tests/helpers'
import testLogger from '../../../../../core/tests/logger'
import { NodeInMemoryKeyManagementStorage } from '../../../../../node/src/kms/NodeInMemoryKeyManagementStorage'
import { NodeKeyManagementService } from '../../../../../node/src/kms/NodeKeyManagementService'
import { NodeFileSystem } from '../../../../../node/src/NodeFileSystem'

import { DidCommV2EnvelopeService } from '../../DidCommV2EnvelopeService'
import type { DidCommV2EncryptedMessage, DidCommV2KeyAgreementJwk } from '../../types'

const vectors = JSON.parse(
  readFileSync(
    path.join(__dirname, '../../../../../node/src/kms/__fixtures__/didcomm-v2.1-encrypted-messages.json'),
    'utf-8'
  )
) as {
  senderSecrets: Kms.KmsJwkPrivate[]
  recipientSecrets: Kms.KmsJwkPrivate[]
  encryptedMessages: Record<string, DidCommV2EncryptedMessage>
}

// The envelope does not support the optional P-521 curve
const messages = Object.entries(vectors.encryptedMessages).filter(
  ([, jwe]) => JsonEncoder.fromBase64Url(jwe.protected).epk.crv !== 'P-521'
)

describe.each([new AskarKeyManagementService(), new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())])(
  'DIDComm v2.1 Appendix C.3 multi-recipient messages with the $backend KMS',
  (kmsBackend) => {
    const agentContext = getAgentContext({
      contextCorrelationId: 'spec-multi-recipient',
      agentConfig: getAgentConfig('SpecMultiRecipientInterop'),
      kmsBackends: [kmsBackend],
      registerInstances: [
        [InjectionSymbols.Logger, testLogger],
        [InjectionSymbols.FileSystem, new NodeFileSystem()],
        [
          AskarModuleConfig,
          new AskarModuleConfig({
            multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
            askar,
            store: {
              id: 'spec-multi-recipient',
              key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
              keyDerivationMethod: 'raw',
              database: { type: 'sqlite', config: { inMemory: true } },
            },
          }),
        ],
      ],
    })

    let envelopeService: DidCommV2EnvelopeService

    beforeAll(() => {
      agentContext.dependencyManager.registerSingleton(DidCommV2EnvelopeService)
      envelopeService = agentContext.dependencyManager.resolve(DidCommV2EnvelopeService)
    })

    it.each(messages)('unpacks %s as every recipient', async (_, jwe) => {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const { skid } = JsonEncoder.fromBase64Url(jwe.protected)
      const sender = vectors.senderSecrets.find(({ kid }) => kid === skid)

      for (const { header } of jwe.recipients) {
        const privateJwk = vectors.recipientSecrets.find(({ kid }) => kid === header.kid) as Kms.KmsJwkPrivate
        const { keyId, publicJwk } = await kms.importKey({ privateJwk })
        const recipientKey = Kms.PublicJwk.fromUnknown(publicJwk) as DidCommV2KeyAgreementJwk & { keyId: string }
        recipientKey.keyId = keyId

        const { plaintext } = await envelopeService.unpack(agentContext, jwe, {
          recipientKey,
          matchedKid: header.kid,
          resolveSenderKey: async () =>
            sender ? Kms.PublicJwk.fromUnknown(Kms.publicJwkFromPrivateJwk(sender)) : null,
        })

        // The C.3 P-256 authcrypt message is signed before it is encrypted
        const message = typeof plaintext.payload === 'string' ? JsonEncoder.fromBase64Url(plaintext.payload) : plaintext
        expect(message).toMatchObject({
          id: '1234567890',
          from: 'did:example:alice',
          to: ['did:example:bob'],
          body: { messagespecificattribute: 'and its value' },
        })
      }
    })
  }
)
