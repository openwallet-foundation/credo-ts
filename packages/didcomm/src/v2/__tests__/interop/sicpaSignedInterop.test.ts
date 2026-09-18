import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { JwsFlattenedFormat } from '@credo-ts/core'
import { InjectionSymbols, JsonEncoder, JwsService, Kms } from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'
import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from '../../../../../askar/src/AskarModuleConfig'
import { AskarKeyManagementService } from '../../../../../askar/src/kms/AskarKeyManagementService'
import { getAgentConfig, getAgentContext } from '../../../../../core/tests/helpers'
import testLogger from '../../../../../core/tests/logger'
import { NodeFileSystem } from '../../../../../node/src/NodeFileSystem'

interface SicpaSignedFixture {
  signedMessage: {
    payload: string
    signatures: Array<{ protected: string; signature: string; header: { kid: string } }>
  }
  expectedPlaintext: Record<string, unknown>
  signer: { kid: string; alg: string; publicJwk: Kms.KmsJwkPublicAsymmetric }
}

const fixturesDir = path.join(__dirname, '../__fixtures__/sicpa')
const fixtures: Array<{ name: string; file: string }> = [
  { name: 'EdDSA / Ed25519', file: 'signed-eddsa.json' },
  { name: 'ES256 / P-256', file: 'signed-es256.json' },
  { name: 'ES256K / secp256k1', file: 'signed-es256k.json' },
]

describe('SICPA DIDComm v2 signed message interop', () => {
  const agentContext = getAgentContext({
    contextCorrelationId: 'sicpa-signed-interop',
    agentConfig: getAgentConfig('SicpaSignedInterop'),
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
            id: 'sicpa-signed-interop',
            key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
            keyDerivationMethod: 'raw',
            database: { type: 'sqlite', config: { inMemory: true } },
          },
        }),
      ],
    ],
  })

  let jwsService: JwsService

  beforeAll(async () => {
    agentContext.dependencyManager.registerSingleton(JwsService)
    jwsService = agentContext.dependencyManager.resolve(JwsService)
  })

  it.each(fixtures)('verifies SICPA signed envelope $name', async ({ file }) => {
    const fixture = JSON.parse(readFileSync(path.join(fixturesDir, file), 'utf-8')) as SicpaSignedFixture
    const jwk = Kms.PublicJwk.fromPublicJwk(fixture.signer.publicJwk)

    const protectedJson = JsonEncoder.fromBase64Url(fixture.signedMessage.signatures[0].protected)
    expect(protectedJson).toMatchObject({
      typ: 'application/didcomm-signed+json',
      alg: fixture.signer.alg,
    })

    const result = await jwsService.verifyJws(agentContext, {
      jws: fixture.signedMessage satisfies JwsFlattenedFormat,
      jwsSigner: { method: 'jwk', jwk },
      allowedJwsSignerMethods: ['jwk'],
    })

    expect(result.isValid).toBe(true)
    expect(result.jwsSigners[0].jwk.fingerprint).toBe(jwk.fingerprint)

    const decodedPayload = JsonEncoder.fromBase64Url(fixture.signedMessage.payload)
    expect(decodedPayload).toEqual(fixture.expectedPlaintext)
  })
})
