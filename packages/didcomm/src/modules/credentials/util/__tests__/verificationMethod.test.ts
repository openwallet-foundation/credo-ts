import type { AgentContext } from '@credo-ts/core'
import { CredoError, DidDocument, JsonTransformer } from '@credo-ts/core'
import { getIssuerVerificationMethod } from '../verificationMethod'

const issuerDid = 'did:example:issuer'

const verificationMethodJson = {
  id: `${issuerDid}#key-1`,
  type: 'Ed25519VerificationKey2018',
  controller: issuerDid,
  publicKeyBase58: 'ByHnpUCFb1vAfh9CFZ8ZkmUZguURW8nSw889hy6rD8L7',
}

const authenticationOnlyVerificationMethodJson = {
  id: `${issuerDid}#key-2`,
  type: 'Ed25519VerificationKey2018',
  controller: issuerDid,
  publicKeyBase58: 'ByHnpUCFb1vAfh9CFZ8ZkmUZguURW8nSw889hy6rD8L7',
}

/**
 * Builds an agent context resolving `issuerDid` to the given did document.
 */
function getAgentContextForDidDocument(didDocument: DidDocument): AgentContext {
  return {
    dependencyManager: {
      resolve: () => ({
        resolveDidDocument: async () => didDocument,
      }),
    },
  } as unknown as AgentContext
}

function getDidDocument(options: {
  assertionMethod?: string[]
  authentication?: string[]
  verificationMethod?: object[]
}): DidDocument {
  return JsonTransformer.fromJSON(
    {
      id: issuerDid,
      verificationMethod: options.verificationMethod ?? [verificationMethodJson],
      ...(options.assertionMethod ? { assertionMethod: options.assertionMethod } : {}),
      ...(options.authentication ? { authentication: options.authentication } : {}),
    },
    DidDocument
  )
}

describe('getIssuerVerificationMethod', () => {
  test('discovers a verification method from the requested purpose', async () => {
    const agentContext = getAgentContextForDidDocument(getDidDocument({ assertionMethod: [`${issuerDid}#key-1`] }))

    const { verificationMethod } = await getIssuerVerificationMethod(agentContext, {
      issuerId: issuerDid,
      allowedPurposes: ['assertionMethod'],
    })

    expect(verificationMethod.id).toBe(`${issuerDid}#key-1`)
  })

  test('throws when no verification method exists for the requested purpose', async () => {
    const agentContext = getAgentContextForDidDocument(getDidDocument({ authentication: [`${issuerDid}#key-1`] }))

    await expect(
      getIssuerVerificationMethod(agentContext, { issuerId: issuerDid, allowedPurposes: ['assertionMethod'] })
    ).rejects.toThrow(CredoError)
  })

  test('prefers the purposes in the order they are given', async () => {
    const agentContext = getAgentContextForDidDocument(
      getDidDocument({
        assertionMethod: [`${issuerDid}#key-1`],
        authentication: [`${issuerDid}#key-2`],
        verificationMethod: [verificationMethodJson, authenticationOnlyVerificationMethodJson],
      })
    )

    const { verificationMethod } = await getIssuerVerificationMethod(agentContext, {
      issuerId: issuerDid,
      allowedPurposes: ['authentication', 'assertionMethod'],
    })

    expect(verificationMethod.id).toBe(`${issuerDid}#key-2`)
  })

  test('uses discoveryPurposes over allowedPurposes when searching', async () => {
    const agentContext = getAgentContextForDidDocument(getDidDocument({}))

    const { verificationMethod } = await getIssuerVerificationMethod(agentContext, {
      issuerId: issuerDid,
      allowedPurposes: ['assertionMethod'],
      discoveryPurposes: ['assertionMethod', 'verificationMethod'],
    })

    expect(verificationMethod.id).toBe(`${issuerDid}#key-1`)
  })

  test('resolves a supplied verification method listed under an allowed purpose', async () => {
    const agentContext = getAgentContextForDidDocument(getDidDocument({ assertionMethod: [`${issuerDid}#key-1`] }))

    const { verificationMethod } = await getIssuerVerificationMethod(agentContext, {
      issuerId: issuerDid,
      verificationMethodId: `${issuerDid}#key-1`,
      allowedPurposes: ['assertionMethod'],
    })

    expect(verificationMethod.id).toBe(`${issuerDid}#key-1`)
  })

  test('rejects a supplied verification method that is not listed under an allowed purpose', async () => {
    const agentContext = getAgentContextForDidDocument(
      getDidDocument({
        authentication: [`${issuerDid}#key-2`],
        verificationMethod: [verificationMethodJson, authenticationOnlyVerificationMethodJson],
      })
    )

    await expect(
      getIssuerVerificationMethod(agentContext, {
        issuerId: issuerDid,
        verificationMethodId: `${issuerDid}#key-2`,
        allowedPurposes: ['assertionMethod'],
      })
    ).rejects.toThrow(CredoError)
  })

  test('rejects a supplied verification method belonging to another did', async () => {
    const agentContext = getAgentContextForDidDocument(getDidDocument({ assertionMethod: [`${issuerDid}#key-1`] }))

    await expect(
      getIssuerVerificationMethod(agentContext, {
        issuerId: issuerDid,
        verificationMethodId: 'did:example:attacker#key-1',
        allowedPurposes: ['assertionMethod'],
      })
    ).rejects.toThrow(CredoError)
  })
})
