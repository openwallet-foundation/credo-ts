import { randomUUID } from 'crypto'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { DidKey, DidsModule, KeyDidRegistrar, KeyDidResolver } from '../../dids'
import { PublicJwk } from '../../kms'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { DifPresentationExchangeService } from '../DifPresentationExchangeService'
import { type DifPresentationExchangeDefinitionV2, DifPresentationExchangeSubmissionLocation } from '../models'

/**
 * Proves that the credentials selected for submission requirements satisfy all of them as the verifier checks a
 * submission, also when an input descriptor is in more than one group: the verifier counts a submitted input
 * descriptor for every group it is in.
 */

const agent = new Agent(
  getAgentOptions(
    'pex-submission-requirements',
    {},
    {},
    { dids: new DidsModule({ resolvers: [new KeyDidResolver()], registrars: [new KeyDidRegistrar()] }) }
  )
)

type SubmissionRequirements = NonNullable<DifPresentationExchangeDefinitionV2['submission_requirements']>

describe('DIF Presentation Exchange submission requirements', () => {
  let pexService: DifPresentationExchangeService
  let vct: string

  beforeAll(async () => {
    await agent.initialize()
    pexService = agent.dependencyManager.resolve(DifPresentationExchangeService)

    const issuerKey = PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
    )
    const issuerDidDocument = new DidKey(issuerKey).didDocument
    const issuerDidUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({
      did: issuerDidDocument.id,
      didDocument: issuerDidDocument,
      keys: [{ didDocumentRelativeKeyId: `#${issuerDidUrl.split('#')[1]}`, kmsKeyId: issuerKey.keyId }],
    })
    const holderKey = PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
    )

    vct = `urn:vct:${randomUUID()}`
    const { compact } = await agent.sdJwtVc.sign({
      holder: { method: 'jwk', jwk: holderKey },
      issuer: { method: 'did', didUrl: issuerDidUrl },
      payload: { vct, x: 'x', y: 'y', z: 'z' },
      disclosureFrame: { _sd: ['x', 'y', 'z'] },
    })
    await agent.sdJwtVc.store({
      record: new SdJwtVcRecord({ credentialInstances: [{ compactSdJwtVc: compact, kmsKeyId: holderKey.keyId }] }),
    })
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  // A definition with an input descriptor per claim, which the credential satisfies, in the groups
  const getDefinition = (
    groups: Record<'x' | 'y' | 'z', string[]>,
    submissionRequirements: SubmissionRequirements
  ): DifPresentationExchangeDefinitionV2 => ({
    id: randomUUID(),
    submission_requirements: submissionRequirements,
    input_descriptors: Object.entries(groups).map(([claim, group]) => ({
      id: claim,
      group,
      constraints: {
        fields: [{ path: ['$.vct'], filter: { type: 'string', const: vct } }, { path: [`$.${claim}`] }],
      },
    })),
  })

  /**
   * Selects the credentials for the definition, presents them, and checks the verifier accepts the presentation.
   * Returns the selected input descriptors.
   */
  async function select(definition: DifPresentationExchangeDefinitionV2) {
    const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
    expect(queryResult.can_be_satisfied).toBe(true)

    const credentialsForInputDescriptor = pexService.selectCredentialsForRequest(queryResult)
    const { verifiablePresentations, presentationSubmission } = await pexService.createPresentation(agent.context, {
      credentialsForInputDescriptor,
      presentationDefinition: definition,
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.External,
      challenge: 'challenge',
      domain: 'https://verifier.example.com',
    })
    pexService.validatePresentation(definition, verifiablePresentations, presentationSubmission)

    return Object.keys(credentialsForInputDescriptor)
  }

  test('selects the first input descriptors a pick needs', async () => {
    const definition = getDefinition({ x: ['A'], y: ['A'], z: ['A'] }, [{ rule: 'pick', count: 2, from: 'A' }])

    expect(await select(definition)).toStrictEqual(['x', 'y'])
  })

  test('selects an input descriptor in two groups once, for a pick that allows one member', async () => {
    // Picking x for A, and y for B, would submit two members of A
    const definition = getDefinition({ x: ['A'], y: ['A', 'B'], z: [] }, [
      { rule: 'pick', count: 1, from: 'A' },
      { rule: 'all', from: 'B' },
    ])

    expect(await select(definition)).toStrictEqual(['y'])
  })

  test('selects the input descriptor in both groups for picks with a maximum', async () => {
    const definition = getDefinition({ x: ['A'], y: ['A', 'B'], z: ['B'] }, [
      { rule: 'pick', min: 1, max: 1, from: 'A' },
      { rule: 'pick', min: 1, max: 1, from: 'B' },
    ])

    expect(await select(definition)).toStrictEqual(['y'])
  })

  test('selects the fewest input descriptors, also when an all requirement already satisfies a pick', async () => {
    const definition = getDefinition({ x: ['A'], y: ['A', 'B'], z: [] }, [
      { rule: 'pick', min: 1, from: 'A' },
      { rule: 'all', from: 'B' },
    ])

    expect(await select(definition)).toStrictEqual(['y'])
  })

  test('selects for nested submission requirements', async () => {
    const definition = getDefinition({ x: ['A'], y: ['A', 'B'], z: ['C'] }, [
      {
        rule: 'pick',
        count: 1,
        from_nested: [
          { rule: 'all', from: 'A' },
          { rule: 'all', from: 'C' },
        ],
      },
      { rule: 'pick', count: 1, from: 'B' },
    ])

    // No single input descriptor satisfies both. Of the pairs that do, [x, y] and [y, z], x comes first.
    expect(await select(definition)).toStrictEqual(['x', 'y'])
  })

  test('throws when no selection satisfies all submission requirements', async () => {
    // B needs both x and y, while A allows only one of them
    const definition = getDefinition({ x: ['A', 'B'], y: ['A', 'B'], z: [] }, [
      { rule: 'pick', count: 1, from: 'A' },
      { rule: 'all', from: 'B' },
    ])

    const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
    expect(() => pexService.selectCredentialsForRequest(queryResult)).toThrow(
      'no selection of the available credentials satisfies all submission requirements'
    )
  })
})
