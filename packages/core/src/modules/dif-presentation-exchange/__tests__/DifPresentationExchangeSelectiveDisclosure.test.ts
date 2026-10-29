import { generateKeyPairSync, randomUUID } from 'crypto'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { JwsService, JwtPayload } from '../../../crypto'
import { DidKey, DidsModule, KeyDidRegistrar, KeyDidResolver } from '../../dids'
import { PublicJwk } from '../../kms'
import { type SdJwtVc, SdJwtVcRecord, SdJwtVcService } from '../../sd-jwt-vc'
import { decoy, packSdJwtPayload, sd } from '../../sd-jwt-vc/__tests__/sdJwtTemplate'
import type { ClaimPath } from '../../sd-jwt-vc/disclosureFrame'
import { DifPresentationExchangeService } from '../DifPresentationExchangeService'
import {
  type DifPexQueryResult,
  type DifPresentationExchangeDefinitionV2,
  DifPresentationExchangeSubmissionLocation,
} from '../models'

/**
 * Proves that presenting a selectively disclosable credential with DIF Presentation Exchange discloses exactly
 * the claims the input descriptors select: every claim a field path resolves to, with everything below it, the
 * claims that are not selectively disclosable, and nothing else.
 *
 * Every case runs the whole holder flow (query, select, present), and checks for the presentation that:
 * - the disclosure output the wallet shows is what the verifier receives,
 * - the SD-JWT and its key binding verify,
 * - the verifier finds it satisfies the presentation definition,
 * - it discloses exactly the expected claims.
 */

const agent = new Agent(
  getAgentOptions(
    'pex-selective-disclosure',
    {},
    {},
    { dids: new DidsModule({ resolvers: [new KeyDidResolver()], registrars: [new KeyDidRegistrar()] }) }
  )
)

type Field = DifPresentationExchangeDefinitionV2['input_descriptors'][number]['constraints']['fields'] extends
  | Array<infer F>
  | undefined
  ? F
  : never
type InputDescriptor = DifPresentationExchangeDefinitionV2['input_descriptors'][number]

describe('DIF Presentation Exchange selective disclosure', () => {
  let pexService: DifPresentationExchangeService
  let sdJwtVcService: SdJwtVcService
  let issuerDid: string
  let issuerDidUrl: string
  let issuerKeyId: string
  let holderKey: PublicJwk

  const challenge = 'challenge'
  const domain = 'https://verifier.example.com'

  beforeAll(async () => {
    await agent.initialize()
    pexService = agent.dependencyManager.resolve(DifPresentationExchangeService)
    sdJwtVcService = agent.dependencyManager.resolve(SdJwtVcService)

    const issuerKey = PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
    )
    issuerKeyId = issuerKey.keyId
    const issuerDidDocument = new DidKey(issuerKey).didDocument
    issuerDid = issuerDidDocument.id
    issuerDidUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({
      did: issuerDid,
      didDocument: issuerDidDocument,
      keys: [{ didDocumentRelativeKeyId: `#${issuerDidUrl.split('#')[1]}`, kmsKeyId: issuerKeyId }],
    })

    const holderPrivateJwk = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' }) as {
      kty: 'OKP'
      crv: 'Ed25519'
      x: string
      d: string
    }
    const holderKid = PublicJwk.fromPublicJwk({ kty: 'OKP', crv: 'Ed25519', x: holderPrivateJwk.x }).legacyKeyId
    holderKey = PublicJwk.fromPublicJwk(
      (await agent.kms.importKey({ privateJwk: { ...holderPrivateJwk, kid: holderKid } })).publicJwk
    )
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  /**
   * Stores an SD-JWT VC signed from the template, and returns its vct.
   */
  async function storeSdJwtVc(template: Record<string, unknown>) {
    const vct = `urn:vct:${randomUUID()}`
    const { payload, disclosures } = packSdJwtPayload({ vct, ...template }, randomUUID())

    const jwt = await agent.dependencyManager.resolve(JwsService).createJwsCompact(agent.context, {
      keyId: issuerKeyId,
      payload: new JwtPayload({
        iss: issuerDid,
        additionalClaims: { ...payload, cnf: { jwk: holderKey.toJson() }, _sd_alg: 'sha-256' },
      }),
      protectedHeaderOptions: { alg: 'EdDSA', typ: 'dc+sd-jwt', kid: issuerDidUrl },
    })
    const compactSdJwtVc = `${jwt}~${disclosures.map((disclosure) => `${disclosure}~`).join('')}`

    await agent.sdJwtVc.store({
      record: new SdJwtVcRecord({ credentialInstances: [{ compactSdJwtVc, kmsKeyId: holderKey.keyId }] }),
    })

    return vct
  }

  // An input descriptor for the SD-JWT VC with the vct, asking for the fields
  const inputDescriptor = (vct: string, fields: Field[], id = 'credential'): InputDescriptor => ({
    id,
    constraints: {
      limit_disclosure: 'required',
      fields: [{ path: ['$.vct'], filter: { type: 'string', const: vct } }, ...fields],
    },
  })

  // The disclosure of the first match for the input descriptor, which is what is presented
  const getDisclosure = (queryResult: DifPexQueryResult, inputDescriptorId: string) => {
    const result = queryResult.input_descriptors.find(
      ({ input_descriptor_id }) => input_descriptor_id === inputDescriptorId
    )
    const match = result?.matching_credentials[0]
    if (!match || !('disclosed_paths' in match.disclosure)) throw new Error('Expected an SD-JWT VC match')
    return match.disclosure
  }

  /**
   * Presents the credentials the presentation definition selects, and checks what every presentation must
   * satisfy.
   *
   * Returns per input descriptor the claims the verifier receives, without the claims every credential has.
   */
  async function present(
    definition: DifPresentationExchangeDefinitionV2,
    { withoutDisclosedPaths = false }: { withoutDisclosedPaths?: boolean } = {}
  ) {
    const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
    expect(queryResult.can_be_satisfied).toBe(true)

    const credentialsForInputDescriptor = pexService.selectCredentialsForRequest(queryResult)
    if (withoutDisclosedPaths) {
      for (const credential of Object.values(credentialsForInputDescriptor).flat()) {
        Object.assign(credential, { disclosedPaths: undefined })
      }
    }

    const { verifiablePresentations, encodedVerifiablePresentations, presentationSubmission } =
      await pexService.createPresentation(agent.context, {
        credentialsForInputDescriptor,
        presentationDefinition: definition,
        presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.External,
        challenge,
        domain,
      })

    // The SD-JWTs are valid, so they have no disclosure without the disclosure of the claim above it
    for (const encoded of encodedVerifiablePresentations) {
      const verification = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: encoded as string,
        keyBinding: { audience: domain, nonce: challenge },
      })
      expect(verification.isValid).toBe(true)
    }

    // The verifier finds the presentations satisfy the presentation definition
    pexService.validatePresentation(
      definition,
      verifiablePresentations.length === 1 ? verifiablePresentations[0] : verifiablePresentations,
      presentationSubmission
    )

    const disclosed: Record<string, Record<string, unknown>> = {}
    for (const descriptor of presentationSubmission.descriptor_map) {
      const index = descriptor.path === '$' ? 0 : Number(descriptor.path.slice(2, -1))
      const presentation = verifiablePresentations[index] as SdJwtVc

      // What the wallet shows is what the verifier receives, unless presenting without the paths
      if (!withoutDisclosedPaths) {
        expect(presentation.prettyClaims).toStrictEqual(getDisclosure(queryResult, descriptor.id).output)
      }

      const { vct: _vct, iss: _iss, cnf: _cnf, ...claims } = presentation.prettyClaims
      disclosed[descriptor.id] = claims
    }

    return { disclosed, queryResult }
  }

  /**
   * Presents an SD-JWT VC, signed from the template, for an input descriptor with the fields, as
   * {@link present} does.
   */
  async function presentSdJwtVc(
    template: Record<string, unknown>,
    fields: Field[],
    options?: { withoutDisclosedPaths?: boolean }
  ) {
    const vct = await storeSdJwtVc(template)
    const { disclosed, queryResult } = await present(
      { id: randomUUID(), input_descriptors: [inputDescriptor(vct, fields)] },
      options
    )

    return {
      disclosed: disclosed.credential,
      disclosedPaths: getDisclosure(queryResult, 'credential').disclosed_paths,
    }
  }

  // The order of the paths does not matter
  const sortPaths = (paths: ClaimPath[]) =>
    [...paths].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  // The disclosed paths below a claim, leaving out those of the claims every credential has
  const pathsBelow = (paths: ClaimPath[], claim: string) => sortPaths(paths.filter((path) => path[0] === claim))

  describe('objects', () => {
    const person = { given_name: sd('Erika'), family_name: sd('Mustermann'), birthdate: '1963-08-12' }

    test('discloses a requested selectively disclosable claim, and the claims that are not', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(person, [{ path: ['$.given_name'] }])

      expect(disclosed).toStrictEqual({ given_name: 'Erika', birthdate: '1963-08-12' })
      expect(sortPaths(disclosedPaths)).toStrictEqual(
        sortPaths([['vct'], ['iss'], ['cnf'], ['birthdate'], ['given_name']])
      )
    })

    test('discloses no selectively disclosable claim when requesting a claim that is not', async () => {
      const { disclosed } = await presentSdJwtVc(person, [{ path: ['$.birthdate'] }])

      expect(disclosed).toStrictEqual({ birthdate: '1963-08-12' })
    })

    test('discloses no selectively disclosable claim without other fields', async () => {
      const { disclosed } = await presentSdJwtVc(person, [])

      expect(disclosed).toStrictEqual({ birthdate: '1963-08-12' })
    })

    test('discloses the selectively disclosable object of a requested claim, without its other claims', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        { address: sd({ street: sd('Main St'), city: sd('Anytown'), country: 'DE' }) },
        [{ path: ['$.address.city'] }]
      )

      expect(disclosed).toStrictEqual({ address: { city: 'Anytown', country: 'DE' } })
      expect(pathsBelow(disclosedPaths, 'address')).toStrictEqual([
        ['address', 'city'],
        ['address', 'country'],
      ])
    })

    test('discloses a requested claim in an object that is not selectively disclosable', async () => {
      const { disclosed } = await presentSdJwtVc(
        { address: { street: sd('Main St'), city: sd('Anytown'), country: 'DE' } },
        [{ path: ["$['address']['street']"] }]
      )

      expect(disclosed).toStrictEqual({ address: { street: 'Main St', country: 'DE' } })
    })

    test('discloses every selectively disclosable claim on the way to a deeply nested claim, and only those', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        {
          a: sd({ b: sd({ c: sd('c'), d: sd('d'), e: 'e' }), f: sd('f') }),
          g: sd('g'),
        },
        [{ path: ['$.a.b.c'] }]
      )

      expect(disclosed).toStrictEqual({ a: { b: { c: 'c', e: 'e' } } })
      expect(pathsBelow(disclosedPaths, 'a')).toStrictEqual([
        ['a', 'b', 'c'],
        ['a', 'b', 'e'],
      ])
    })

    test('discloses everything below a requested object, with a single path', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        {
          address: sd({
            street: sd('Main St'),
            decoy: decoy(),
            country: sd({ code: sd('DE'), name: sd('Germany'), region: 'EU' }),
          }),
          other: sd('other'),
        },
        [{ path: ['$.address'], filter: { type: 'object' } }]
      )

      expect(disclosed).toStrictEqual({
        address: { street: 'Main St', country: { code: 'DE', name: 'Germany', region: 'EU' } },
      })
      expect(pathsBelow(disclosedPaths, 'address')).toStrictEqual([['address']])
    })

    test('discloses several requested claims in one object', async () => {
      const { disclosed } = await presentSdJwtVc(
        { address: sd({ street: sd('Main St'), city: sd('Anytown'), zip: sd('12345') }) },
        [{ path: ['$.address.street'] }, { path: ['$.address.city'] }]
      )

      expect(disclosed).toStrictEqual({ address: { street: 'Main St', city: 'Anytown' } })
    })

    test('discloses a requested empty object', async () => {
      const { disclosed } = await presentSdJwtVc({ empty: sd({}), other: sd('other') }, [{ path: ['$.empty'] }])

      expect(disclosed).toStrictEqual({ empty: {} })
    })

    test('discloses claims requested with filters', async () => {
      const { disclosed } = await presentSdJwtVc(
        { age: sd(42), over_18: sd(true), nationality: sd('DE'), other: sd('other') },
        [
          { path: ['$.age'], filter: { type: 'integer', minimum: 18 } },
          { path: ['$.over_18'], filter: { type: 'boolean', const: true } },
          { path: ['$.nationality'], filter: { type: 'string', enum: ['NL', 'DE'] } },
        ]
      )

      expect(disclosed).toStrictEqual({ age: 42, over_18: true, nationality: 'DE' })
    })

    test('discloses a requested claim between decoys', async () => {
      const { disclosed } = await presentSdJwtVc(
        { given_name: sd('Erika'), decoy1: decoy(), family_name: sd('Mustermann'), decoy2: decoy() },
        [{ path: ['$.family_name'] }]
      )

      expect(disclosed).toStrictEqual({ family_name: 'Mustermann' })
    })

    test('discloses only the first path of a field that resolves', async () => {
      const { disclosed } = await presentSdJwtVc({ given_name: sd('Erika'), family_name: sd('Mustermann') }, [
        { path: ['$.missing', '$.family_name', '$.given_name'] },
      ])

      expect(disclosed).toStrictEqual({ family_name: 'Mustermann' })
    })

    test('discloses only the first path whose value satisfies the filter', async () => {
      const { disclosed } = await presentSdJwtVc({ given_name: sd('Erika'), family_name: sd('Mustermann') }, [
        { path: ['$.given_name', '$.family_name'], filter: { type: 'string', const: 'Mustermann' } },
      ])

      expect(disclosed).toStrictEqual({ family_name: 'Mustermann' })
    })

    test('discloses an optional claim that is present, and passes without one that is missing', async () => {
      const { disclosed } = await presentSdJwtVc({ given_name: sd('Erika'), family_name: sd('Mustermann') }, [
        { path: ['$.given_name'], optional: true },
        { path: ['$.missing'], optional: true },
      ])

      expect(disclosed).toStrictEqual({ given_name: 'Erika' })
    })
  })

  describe('array positions', () => {
    test('discloses the whole of an array whose elements are not selectively disclosable', async () => {
      const { disclosed } = await presentSdJwtVc({ nationalities: ['DE', 'NL', 'FR'] }, [
        { path: ['$.nationalities[1]'] },
      ])

      expect(disclosed).toStrictEqual({ nationalities: ['DE', 'NL', 'FR'] })
    })

    test('discloses only the requested selectively disclosable element', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc({ nationalities: [sd('DE'), sd('NL'), sd('FR')] }, [
        { path: ['$.nationalities[1]'] },
      ])

      expect(disclosed).toStrictEqual({ nationalities: ['NL'] })
      expect(pathsBelow(disclosedPaths, 'nationalities')).toStrictEqual([['nationalities', 1]])
    })

    test('discloses the requested element of a selectively disclosable array', async () => {
      const { disclosed } = await presentSdJwtVc({ nationalities: sd([sd('DE'), sd('NL'), sd('FR')]) }, [
        { path: ['$.nationalities[2]'] },
      ])

      expect(disclosed).toStrictEqual({ nationalities: ['FR'] })
    })

    test('discloses the elements that are not selectively disclosable with a requested element', async () => {
      const template = { list: [sd('a'), 'b', sd('c'), 'd'] }

      expect((await presentSdJwtVc(template, [{ path: ['$.list[2]'] }])).disclosed).toStrictEqual({
        list: ['b', 'c', 'd'],
      })
      expect((await presentSdJwtVc(template, [{ path: ['$.list[1]'] }])).disclosed).toStrictEqual({
        list: ['b', 'd'],
      })
    })

    test('gives elements the position they have without the decoys', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        { nationalities: [decoy(), sd('DE'), decoy(), decoy(), sd('NL'), sd('FR'), decoy()] },
        [{ path: ['$.nationalities[1]'] }]
      )

      expect(disclosed).toStrictEqual({ nationalities: ['NL'] })
      expect(pathsBelow(disclosedPaths, 'nationalities')).toStrictEqual([['nationalities', 1]])
    })

    test('discloses a requested claim in an element', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        {
          addresses: [
            sd({ street: sd('Main St'), city: sd('Anytown') }),
            sd({ street: sd('Second St'), city: sd('Othertown') }),
          ],
        },
        [{ path: ['$.addresses[1].city'] }]
      )

      expect(disclosed).toStrictEqual({ addresses: [{ city: 'Othertown' }] })
      expect(pathsBelow(disclosedPaths, 'addresses')).toStrictEqual([['addresses', 1, 'city']])
    })

    test('discloses a requested element of a nested array', async () => {
      const { disclosed } = await presentSdJwtVc({ matrix: sd([sd([sd(1), sd(2)]), sd([sd(3), decoy(), sd(4)])]) }, [
        { path: ['$.matrix[1][1]'] },
      ])

      expect(disclosed).toStrictEqual({ matrix: [[4]] })
    })

    test('discloses everything below a requested array, with a single path', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        {
          addresses: sd([
            sd({ street: sd('Main St'), tags: sd([sd('home'), decoy(), sd('primary')]) }),
            decoy(),
            sd({ street: sd('Second St') }),
          ]),
          other: sd('other'),
        },
        [{ path: ['$.addresses'], filter: { type: 'array' } }]
      )

      expect(disclosed).toStrictEqual({
        addresses: [{ street: 'Main St', tags: ['home', 'primary'] }, { street: 'Second St' }],
      })
      expect(pathsBelow(disclosedPaths, 'addresses')).toStrictEqual([['addresses']])
    })

    test('discloses several requested elements, and not the ones between them', async () => {
      const { disclosed } = await presentSdJwtVc({ list: [sd('a'), sd('b'), sd('c')] }, [
        { path: ['$.list[0]'] },
        { path: ['$.list[2]'] },
      ])

      expect(disclosed).toStrictEqual({ list: ['a', 'c'] })
    })

    test('discloses a requested empty array', async () => {
      const { disclosed } = await presentSdJwtVc({ list: sd([]), other: sd('other') }, [{ path: ['$.list'] }])

      expect(disclosed).toStrictEqual({ list: [] })
    })
  })

  describe('wildcards selecting every element', () => {
    test('discloses every element', async () => {
      const { disclosed } = await presentSdJwtVc({ nationalities: [sd('DE'), decoy(), sd('NL'), 'FR'] }, [
        { path: ['$.nationalities[*]'] },
      ])

      expect(disclosed).toStrictEqual({ nationalities: ['DE', 'NL', 'FR'] })
    })

    test('discloses every element with the .* notation', async () => {
      const { disclosed } = await presentSdJwtVc({ nationalities: [sd('DE'), sd('NL')] }, [
        { path: ['$.nationalities.*'] },
      ])

      expect(disclosed).toStrictEqual({ nationalities: ['DE', 'NL'] })
    })

    test('discloses only the elements satisfying the filter', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        { nationalities: [sd('DE'), decoy(), sd('NL'), sd('FR'), 'NL'] },
        [{ path: ['$.nationalities[*]'], filter: { type: 'string', const: 'NL' } }]
      )

      expect(disclosed).toStrictEqual({ nationalities: ['NL', 'NL'] })
      expect(pathsBelow(disclosedPaths, 'nationalities')).toStrictEqual([
        ['nationalities', 1],
        ['nationalities', 3],
      ])
    })

    test('discloses a requested claim of every element', async () => {
      const { disclosed } = await presentSdJwtVc(
        {
          people: [
            sd({ name: sd('A'), age: sd(1) }),
            { name: sd('B'), age: sd(2) },
            sd({ name: 'C', age: sd(3) }),
            sd({ age: sd(5) }),
            decoy(),
          ],
        },
        [{ path: ['$.people[*].name'] }]
      )

      expect(disclosed).toStrictEqual({ people: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] })
    })

    test('discloses a requested claim only of the elements satisfying the filter', async () => {
      const { disclosed } = await presentSdJwtVc(
        {
          people: [
            sd({ name: sd('A'), role: sd('admin') }),
            sd({ name: sd('B'), role: sd('user') }),
            { name: sd('C'), role: sd('admin') },
            sd({ name: 'D', role: 'admin' }),
          ],
        },
        [{ path: ['$.people[*].role'], filter: { type: 'string', const: 'admin' } }]
      )

      expect(disclosed).toStrictEqual({ people: [{ role: 'admin' }, { role: 'admin' }, { name: 'D', role: 'admin' }] })
    })

    test('discloses the claims of nested arrays satisfying the filter', async () => {
      const { disclosed } = await presentSdJwtVc(
        {
          privileges: sd([
            sd({ category: sd('A'), codes: sd([sd({ code: sd('D') }), sd({ code: sd('E') })]) }),
            sd({ category: sd('B'), codes: sd([decoy(), sd({ code: sd('D') })]) }),
            sd({ category: sd('C'), codes: [] }),
          ]),
        },
        [{ path: ['$.privileges[*].codes[*].code'], filter: { type: 'string', const: 'D' } }]
      )

      expect(disclosed).toStrictEqual({ privileges: [{ codes: [{ code: 'D' }] }, { codes: [{ code: 'D' }] }] })
    })
  })

  describe('several input descriptors', () => {
    const person = { given_name: sd('Erika'), family_name: sd('Mustermann'), birthdate: sd('1963-08-12') }

    test('discloses for each input descriptor only what it asks for, also for the same credential', async () => {
      const vct = await storeSdJwtVc(person)
      const { disclosed } = await present({
        id: randomUUID(),
        input_descriptors: [
          inputDescriptor(vct, [{ path: ['$.given_name'] }], 'name'),
          inputDescriptor(vct, [{ path: ['$.birthdate'] }], 'age'),
        ],
      })

      expect(disclosed).toStrictEqual({ name: { given_name: 'Erika' }, age: { birthdate: '1963-08-12' } })
    })

    test('does not disclose what an input descriptor that is not submitted asks for', async () => {
      const vct = await storeSdJwtVc(person)
      const { disclosed } = await present({
        id: randomUUID(),
        submission_requirements: [{ rule: 'pick', count: 1, from: 'A' }],
        input_descriptors: [
          { ...inputDescriptor(vct, [{ path: ['$.given_name'] }], 'name'), group: ['A'] },
          { ...inputDescriptor(vct, [{ path: ['$.birthdate'] }], 'age'), group: ['A'] },
        ],
      })

      expect(disclosed).toStrictEqual({ name: { given_name: 'Erika' } })
    })

    test('does not disclose what an optional requirement asks for', async () => {
      const vct = await storeSdJwtVc(person)
      const { disclosed } = await present({
        id: randomUUID(),
        submission_requirements: [
          { rule: 'all', from: 'A' },
          { rule: 'pick', min: 0, from: 'B' },
        ],
        input_descriptors: [
          { ...inputDescriptor(vct, [{ path: ['$.given_name'] }], 'name'), group: ['A'] },
          { ...inputDescriptor(vct, [{ path: ['$.family_name'] }], 'family'), group: ['B'] },
        ],
      })

      expect(disclosed).toStrictEqual({ name: { given_name: 'Erika' } })
    })
  })

  describe('definitions that cannot be satisfied', () => {
    const cannotBeSatisfied = async (template: Record<string, unknown>, fields: Field[]) => {
      const vct = await storeSdJwtVc(template)
      const queryResult = await pexService.getCredentialsForRequest(agent.context, {
        id: randomUUID(),
        input_descriptors: [inputDescriptor(vct, fields)],
      })
      return !queryResult.can_be_satisfied
    }

    test('with a filter the value does not satisfy', async () => {
      expect(
        await cannotBeSatisfied({ age: sd(42) }, [{ path: ['$.age'], filter: { type: 'integer', maximum: 18 } }])
      ).toBe(true)
    })

    test('with a position after the last element', async () => {
      expect(await cannotBeSatisfied({ list: [sd('a'), decoy()] }, [{ path: ['$.list[1]'] }])).toBe(true)
    })

    test('with a wildcard and a filter that no element satisfies', async () => {
      expect(
        await cannotBeSatisfied({ list: [sd('a'), 'b'] }, [
          { path: ['$.list[*]'], filter: { type: 'string', const: 'c' } },
        ])
      ).toBe(true)
    })

    test('with a missing claim', async () => {
      expect(await cannotBeSatisfied({ given_name: sd('Erika') }, [{ path: ['$.family_name'] }])).toBe(true)
    })
  })

  describe('presenting', () => {
    test('still discloses based on the payload without the disclosed paths', async () => {
      const { disclosed } = await presentSdJwtVc(
        { given_name: sd('Erika'), family_name: sd('Mustermann'), address: sd({ city: sd('Anytown') }) },
        [{ path: ['$.address.city'] }],
        { withoutDisclosedPaths: true }
      )

      expect(disclosed).toStrictEqual({ address: { city: 'Anytown' } })
    })
  })
})
