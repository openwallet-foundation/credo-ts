import { DidsApi, InjectionSymbols, Kms, MultiBaseEncoder } from '@credo-ts/core'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { Mldsa44Jcs2024Cryptosuite } from '../../../../core/src/modules/w3c-di/cryptosuites/mldsa44-jcs-2024/Mldsa44Jcs2024Cryptosuite'
import { getAgentConfig, getAgentContext, getAskarStoreConfig } from '../../../../core/tests'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'
import { AskarModuleConfig } from '../../AskarModuleConfig'
import { AskarStoreManager } from '../../AskarStoreManager'
import { AskarKeyManagementService } from '../AskarKeyManagementService'

describe('Mldsa44Jcs2024Cryptosuite with Askar', () => {
  test('creates and verifies an ML-DSA-44 proof using the real Askar backend', async () => {
    const verificationMethod = 'did:example:issuer#key-1'
    const askarService = new AskarKeyManagementService()
    const didsApi = {
      resolveDidDocument: vi.fn(),
      getCreatedDids: vi.fn(),
    }
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('Mldsa44Jcs2024CryptosuiteAskarTest'),
      registerInstances: [
        [InjectionSymbols.FileSystem, new NodeFileSystem()],
        [
          AskarModuleConfig,
          new AskarModuleConfig({
            askar: NativeAskar,
            store: getAskarStoreConfig('Mldsa44Jcs2024CryptosuiteAskarTest'),
          }),
        ],
        [DidsApi, didsApi],
      ],
      kmsBackends: [askarService],
    })
    const keyManagementApi = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    try {
      const { keyId, publicJwk } = await keyManagementApi.createKeyForSignatureAlgorithm({ algorithm: 'ML-DSA-44' })

      didsApi.resolveDidDocument.mockResolvedValue({
        dereferenceVerificationMethod: vi.fn().mockReturnValue({
          id: verificationMethod,
          type: 'JsonWebKey2020',
          controller: 'did:example:issuer',
          publicKeyJwk: publicJwk,
        }),
      })
      didsApi.getCreatedDids.mockResolvedValue([{ keys: [{ didDocumentRelativeKeyId: '#key-1', kmsKeyId: keyId }] }])

      const cryptosuite = new Mldsa44Jcs2024Cryptosuite(agentContext)
      const document = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: 'urn:example:credential:1',
        type: ['VerifiableCredential'],
        issuer: 'did:example:issuer',
        credentialSubject: { id: 'did:example:subject', name: 'Ada Lovelace' },
      }
      const proof = await cryptosuite.createProof(document, {
        type: 'DataIntegrityProof',
        cryptosuite: 'mldsa44-jcs-2024',
        created: '2025-01-01T00:00:00Z',
        proofPurpose: 'assertionMethod',
        verificationMethod,
      })

      const proofBytes = MultiBaseEncoder.decode(proof.proofValue).data
      expect(proofBytes).toHaveLength(2420)

      await expect(cryptosuite.verifyProof({ unsecuredDocument: document, proof })).resolves.toEqual({
        verified: true,
        verifiedDocument: document,
      })

      await expect(
        cryptosuite.verifyProof({
          unsecuredDocument: { ...document, credentialSubject: { id: 'did:example:subject', name: 'Grace Hopper' } },
          proof,
        })
      ).resolves.toEqual({ verified: false, verifiedDocument: null })
    } finally {
      await agentContext.dependencyManager.resolve(AskarStoreManager).deleteStore(agentContext)
    }
  })
})
