import { InjectionSymbols, JsonEncoder, Kms, TypedArrayEncoder } from '@credo-ts/core'
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
const aadFor = (ephemeralPublicJwk: Kms.KmsJwkPublicEcdh) => JsonEncoder.toUint8Array({ epk: ephemeralPublicJwk })
const toKeyAgreementJwk = (publicJwk: Kms.KmsJwkPublic): Kms.KmsJwkPublicEcdh =>
  publicJwk.kty === 'OKP' && publicJwk.crv === 'Ed25519'
    ? Kms.PublicJwk.fromPublicJwk(publicJwk).convertTo(Kms.X25519PublicJwk).toJson()
    : (publicJwk as Kms.KmsJwkPublicEcdh)

describe('AskarKeyManagementService ECDH interop with NodeKeyManagementService', () => {
  describe.each([
    { from: 'node', to: 'askar' },
    { from: 'askar', to: 'node' },
  ] as const)('$from encrypts, $to decrypts', ({ from, to }) => {
    it.each([
      { algorithm: 'ECDH-ES', encryption: 'A256GCM', type: { kty: 'OKP', crv: 'X25519' } },
      { algorithm: 'ECDH-ES', encryption: 'A256GCM', type: { kty: 'EC', crv: 'P-256' } },
      { algorithm: 'ECDH-ES', encryption: 'A256GCM', type: { kty: 'EC', crv: 'P-384' } },
      { algorithm: 'ECDH-ES+A256KW', encryption: 'A256CBC-HS512', type: { kty: 'OKP', crv: 'X25519' } },
      { algorithm: 'ECDH-ES+A256KW', encryption: 'A256CBC-HS512', type: { kty: 'EC', crv: 'P-256' } },
      { algorithm: 'ECDH-ES+A256KW', encryption: 'A256CBC-HS512', type: { kty: 'EC', crv: 'P-384' } },
      { algorithm: 'ECDH-ES+A256KW', encryption: 'A256CBC-HS512', type: { kty: 'OKP', crv: 'Ed25519' } },
      { algorithm: 'ECDH-1PU+A256KW', encryption: 'A256CBC-HS512', type: { kty: 'OKP', crv: 'X25519' } },
      { algorithm: 'ECDH-1PU+A256KW', encryption: 'A256CBC-HS512', type: { kty: 'EC', crv: 'P-256' } },
      { algorithm: 'ECDH-1PU+A256KW', encryption: 'A256CBC-HS512', type: { kty: 'EC', crv: 'P-384' } },
      { algorithm: 'ECDH-1PU+A256KW', encryption: 'A256CBC-HS512', type: { kty: 'OKP', crv: 'Ed25519' } },
    ] as const)('$algorithm with $encryption and $type.crv keys', async ({ algorithm, encryption, type }) => {
      const sender = await services[from].createKey(agentContext, { type })
      const recipients = await Promise.all(
        Array.from({ length: algorithm === 'ECDH-ES' ? 1 : 2 }, () => services[to].createKey(agentContext, { type }))
      )
      const recipientJwks = recipients.map(({ publicJwk }) => ({ externalPublicJwk: toKeyAgreementJwk(publicJwk) }))

      const { encrypted, iv, tag, ephemeralPublicJwk, encryptedKeys } = await services[from].encrypt(agentContext, {
        key: {
          keyAgreement:
            algorithm === 'ECDH-ES'
              ? { algorithm, externalPublicJwk: recipientJwks[0].externalPublicJwk, apu, apv }
              : algorithm === 'ECDH-ES+A256KW'
                ? { algorithm, recipients: recipientJwks, apu, apv }
                : { algorithm, keyId: sender.keyId, recipients: recipientJwks, apu, apv },
        },
        encryption: { algorithm: encryption, aad: ({ ephemeralPublicJwk }) => aadFor(ephemeralPublicJwk) },
        data: TypedArrayEncoder.fromUtf8String(`${from} to ${to}`),
      })
      if (!ephemeralPublicJwk || !iv || !tag) throw new Error('Expected ephemeralPublicJwk, iv and tag')

      for (const [index, recipient] of recipients.entries()) {
        const keyAgreement = { keyId: recipient.keyId, ephemeralPublicJwk, apu, apv }
        const encryptedKey = { encrypted: encryptedKeys?.[index].encrypted as Uint8Array }
        const { data } = await services[to].decrypt(agentContext, {
          key: {
            keyAgreement:
              algorithm === 'ECDH-ES'
                ? { ...keyAgreement, algorithm }
                : algorithm === 'ECDH-ES+A256KW'
                  ? { ...keyAgreement, algorithm, encryptedKey }
                  : {
                      ...keyAgreement,
                      algorithm,
                      encryptedKey,
                      senderPublicJwk: toKeyAgreementJwk(sender.publicJwk),
                    },
          },
          decryption: { algorithm: encryption, iv, tag, aad: aadFor(ephemeralPublicJwk) },
          encrypted,
        })

        expect(TypedArrayEncoder.toUtf8String(data)).toEqual(`${from} to ${to}`)
      }
    })
  })
})
