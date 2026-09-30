import { InjectionSymbols, type Kms, TypedArrayEncoder } from '@credo-ts/core'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { getAgentConfig, getAgentContext } from '../../../../core/tests'
import { NodeInMemoryKeyManagementStorage } from '../../../../node/src/kms/NodeInMemoryKeyManagementStorage'
import { NodeKeyManagementService } from '../../../../node/src/kms/NodeKeyManagementService'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'
import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from '../../AskarModuleConfig'
import { AskarKeyManagementService } from '../AskarKeyManagementService'

const agentContext = getAgentContext({
  contextCorrelationId: 'default',
  agentConfig: getAgentConfig('AskarKeyManagementServiceNodeInterop'),
  registerInstances: [
    [InjectionSymbols.FileSystem, new NodeFileSystem()],
    [
      AskarModuleConfig,
      new AskarModuleConfig({
        multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
        askar: NativeAskar,
        store: {
          id: 'default',
          key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
          keyDerivationMethod: 'raw',
          database: { type: 'sqlite', config: { inMemory: true } },
        },
      }),
    ],
  ],
})

const services = {
  askar: new AskarKeyManagementService(),
  node: new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()),
}

const apu = TypedArrayEncoder.fromUtf8String('did:example:alice#key-1')
const apv = TypedArrayEncoder.fromUtf8String('did:example:bob#key-1')
const aad = TypedArrayEncoder.fromUtf8String('eyJhbGciOiJFQ0RILTFQVStBMjU2S1cifQ')

describe('AskarKeyManagementService ECDH-1PU+A256KW interop with NodeKeyManagementService', () => {
  describe.each([
    { from: 'node', to: 'askar' },
    { from: 'askar', to: 'node' },
  ] as const)('$from encrypts, $to decrypts', ({ from, to }) => {
    it.each([
      { kty: 'OKP', crv: 'X25519' },
      { kty: 'EC', crv: 'P-256' },
      { kty: 'EC', crv: 'P-384' },
    ] as const)('with $crv keys', async (type) => {
      const sender = await services[from].createKey(agentContext, { type })
      const ephemeral = await services[from].createKey(agentContext, { type })
      const recipient = await services[to].createKey(agentContext, { type })

      const { encrypted, iv, tag, encryptedKey } = await services[from].encrypt(agentContext, {
        key: {
          keyAgreement: {
            algorithm: 'ECDH-1PU+A256KW',
            keyId: sender.keyId,
            ephemeralKeyId: ephemeral.keyId,
            externalPublicJwk: recipient.publicJwk as Kms.KmsJwkPublicEcdh,
            apu,
            apv,
          },
        },
        encryption: { algorithm: 'A256CBC-HS512', aad },
        data: TypedArrayEncoder.fromUtf8String(`${from} to ${to}`),
      })

      const { data } = await services[to].decrypt(agentContext, {
        key: {
          keyAgreement: {
            algorithm: 'ECDH-1PU+A256KW',
            keyId: recipient.keyId,
            encryptedKey: { encrypted: encryptedKey?.encrypted as Uint8Array },
            ephemeralPublicJwk: ephemeral.publicJwk as Kms.KmsJwkPublicEcdh,
            senderPublicJwk: sender.publicJwk as Kms.KmsJwkPublicEcdh,
            apu,
            apv,
          },
        },
        decryption: { algorithm: 'A256CBC-HS512', iv: iv as Uint8Array, tag: tag as Uint8Array, aad },
        encrypted,
      })

      expect(TypedArrayEncoder.toUtf8String(data)).toEqual(`${from} to ${to}`)
    })
  })
})
