import { generateKeyPairSync, randomUUID } from 'crypto'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { Hasher, JwsService, JwtPayload } from '../../../crypto'
import { TypedArrayEncoder } from '../../../utils'
import { DidKey, DidsModule, KeyDidRegistrar, KeyDidResolver } from '../../dids'
import { PublicJwk } from '../../kms'
import { type SdJwtVc, SdJwtVcRecord, SdJwtVcService } from '../../sd-jwt-vc'
import { type ClaimPath, getClaimPathsForDcqlClaimSet } from '../../sd-jwt-vc/disclosureFrame'
import { W3cV2CredentialRecord } from '../../vc'
import { W3cV2SdJwtVerifiablePresentation } from '../../vc/sd-jwt-vc'
import { DcqlService } from '../DcqlService'
import type { DcqlQueryResult } from '../models'

/**
 * Proves that presenting a selectively disclosable credential with DCQL discloses exactly the claims the
 * query selects: every claim a claims query selects, with everything below it, the claims that are not
 * selectively disclosable, and nothing else.
 *
 * Every case runs the whole holder flow (query, select, present), and checks for the presentation that:
 * - the claim set output the wallet shows is what the verifier receives,
 * - the SD-JWT and its key binding verify,
 * - the verifier finds it satisfies the query,
 * - it discloses exactly the expected claims.
 */

const agent = new Agent(
  getAgentOptions(
    'dcql-selective-disclosure',
    {},
    {},
    { dids: new DidsModule({ resolvers: [new KeyDidResolver()], registrars: [new KeyDidRegistrar()] }) }
  )
)

type DcqlQuery = Parameters<DcqlService['getCredentialsForRequest']>[1]

// Marks a claim or array element as selectively disclosable
const SELECTIVELY_DISCLOSABLE = Symbol('selectively disclosable')
const sd = (value: unknown) => ({ [SELECTIVELY_DISCLOSABLE]: value })
const isSd = (value: unknown): value is { [SELECTIVELY_DISCLOSABLE]: unknown } =>
  typeof value === 'object' && value !== null && SELECTIVELY_DISCLOSABLE in value

// Marks a decoy digest, as a property (with any name) of an object or an element of an array
const DECOY = Symbol('decoy')
const decoy = () => ({ [DECOY]: true })
const isDecoy = (value: unknown) => typeof value === 'object' && value !== null && DECOY in value

/**
 * Packs a template into a signed SD-JWT payload and its disclosures. Unlike signing with a disclosure
 * frame, this can place a decoy anywhere, such as between array elements.
 */
function packSdJwtPayload(template: Record<string, unknown>, saltPrefix: string) {
  const disclosures: string[] = []
  let saltCount = 0
  const salt = () => `${saltPrefix}-${saltCount++}`
  const digest = (value: string) => TypedArrayEncoder.toBase64Url(Hasher.hash(value, 'sha-256'))

  const disclose = (disclosure: unknown[]) => {
    const encoded = TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String(JSON.stringify(disclosure)))
    disclosures.push(encoded)
    return digest(encoded)
  }

  const pack = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (isDecoy(item)) return { '...': digest(salt()) }
        if (isSd(item)) return { '...': disclose([salt(), pack(item[SELECTIVELY_DISCLOSABLE])]) }
        return pack(item)
      })
    }

    if (typeof value === 'object' && value !== null) {
      const packed: Record<string, unknown> = {}
      const digests: string[] = []

      for (const [key, claim] of Object.entries(value)) {
        if (isDecoy(claim)) digests.push(digest(salt()))
        else if (isSd(claim)) digests.push(disclose([salt(), key, pack(claim[SELECTIVELY_DISCLOSABLE])]))
        else packed[key] = pack(claim)
      }

      if (digests.length > 0) packed._sd = digests.sort()
      return packed
    }

    return value
  }

  return { payload: pack(template) as Record<string, unknown>, disclosures }
}

describe('DCQL selective disclosure', () => {
  let dcqlService: DcqlService
  let sdJwtVcService: SdJwtVcService
  let issuerDid: string
  let issuerDidUrl: string
  let issuerKeyId: string
  let holderKey: PublicJwk

  const challenge = 'challenge'
  const domain = 'https://verifier.example.com'

  beforeAll(async () => {
    await agent.initialize()
    dcqlService = agent.dependencyManager.resolve(DcqlService)
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

    // With the key id Credo derives from a holder binding without a key id in the KMS, as W3C VCs have
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

  async function signSdJwt(template: Record<string, unknown>, typ: 'dc+sd-jwt' | 'vc+sd-jwt') {
    const { payload, disclosures } = packSdJwtPayload(template, randomUUID())

    const jwt = await agent.dependencyManager.resolve(JwsService).createJwsCompact(agent.context, {
      keyId: issuerKeyId,
      payload: new JwtPayload({
        iss: issuerDid,
        additionalClaims: { ...payload, cnf: { jwk: holderKey.toJson() }, _sd_alg: 'sha-256' },
      }),
      protectedHeaderOptions: { alg: 'EdDSA', typ, kid: issuerDidUrl },
    })

    return `${jwt}~${disclosures.map((disclosure) => `${disclosure}~`).join('')}`
  }

  // The claim set used when presenting: the first valid one, of the first valid credential
  const getClaimSet = (queryResult: DcqlQueryResult) => {
    const match = queryResult.credential_matches.credential
    if (!match.success) throw new Error('Expected the credential query to match')
    return match.valid_credentials[0].claims.valid_claim_sets[0]
  }

  type ClaimsQuery = { id?: string; path: Array<string | number | null>; values?: Array<string | number | boolean> }

  /**
   * Stores an SD-JWT VC record with an instance signed from each template, and returns its vct and the
   * compact SD-JWT of each instance.
   */
  async function storeSdJwtVc(templates: Array<Record<string, unknown>>) {
    const vct = `urn:vct:${randomUUID()}`
    const compacts = await Promise.all(templates.map((template) => signSdJwt({ vct, ...template }, 'dc+sd-jwt')))

    await agent.sdJwtVc.store({
      record: new SdJwtVcRecord({
        credentialInstances: compacts.map((compactSdJwtVc) => ({ compactSdJwtVc, kmsKeyId: holderKey.keyId })) as [
          { compactSdJwtVc: string; kmsKeyId: string },
        ],
      }),
    })

    return { vct, compacts }
  }

  /**
   * Presents an SD-JWT VC, signed from the template, for a DCQL query with the given claims queries, and
   * checks what every presentation must satisfy.
   *
   * Returns the claims the verifier receives, without the claims every credential has.
   */
  async function presentSdJwtVc(
    template: Record<string, unknown>,
    claims?: ClaimsQuery[],
    claimSets?: string[][],
    options?: { withoutDisclosedPaths?: boolean }
  ) {
    const { vct } = await storeSdJwtVc([template])
    return presentStoredSdJwtVc(vct, claims, claimSets, options)
  }

  /**
   * Presents the stored SD-JWT VC with the vct, as {@link presentSdJwtVc} does. Also returns the compact
   * SD-JWT presented, without its disclosures and key binding, to tell which instance was presented.
   */
  async function presentStoredSdJwtVc(
    vct: string,
    claims?: ClaimsQuery[],
    claimSets?: string[][],
    { withoutDisclosedPaths = false }: { withoutDisclosedPaths?: boolean } = {}
  ) {
    const dcqlQuery = {
      credentials: [
        { id: 'credential', format: 'dc+sd-jwt', meta: { vct_values: [vct] }, claims, claim_sets: claimSets },
      ],
    } as unknown as DcqlQuery

    const queryResult = await dcqlService.getCredentialsForRequest(agent.context, dcqlQuery)
    expect(queryResult.can_be_satisfied).toBe(true)

    const credentialQueryToCredential = dcqlService.selectCredentialsForRequest(queryResult)
    const [selected] = credentialQueryToCredential.credential
    if (selected.claimFormat !== 'dc+sd-jwt') throw new Error('Expected an SD-JWT VC to be selected')
    if (withoutDisclosedPaths) Object.assign(selected, { disclosedPaths: undefined })

    const { dcqlPresentation, encodedDcqlPresentation } = await dcqlService.createPresentation(agent.context, {
      credentialQueryToCredential,
      challenge,
      domain,
    })
    const presentation = dcqlPresentation.credential[0] as SdJwtVc

    // The SD-JWT is valid, so it has no disclosure without the disclosure of the claim above it
    const verification = await sdJwtVcService.verify(agent.context, {
      compactSdJwtVc: encodedDcqlPresentation.credential[0] as string,
      keyBinding: { audience: domain, nonce: challenge },
    })
    expect(verification.isValid).toBe(true)

    // The verifier finds the presentation satisfies the query
    await dcqlService.assertValidDcqlPresentation(agent.context, dcqlPresentation, dcqlQuery)

    const claimSet = getClaimSet(queryResult)
    // What the wallet shows is what the verifier receives, unless presenting without the paths
    if (!withoutDisclosedPaths) expect(presentation.prettyClaims).toStrictEqual(claimSet.output)

    const { vct: _vct, iss: _iss, cnf: _cnf, ...disclosed } = presentation.prettyClaims
    return {
      disclosed,
      disclosedPaths: claimSet.disclosed_paths as ClaimPath[],
      jwt: (encodedDcqlPresentation.credential[0] as string).split('~')[0],
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
      const { disclosed, disclosedPaths } = await presentSdJwtVc(person, [{ path: ['given_name'] }])

      expect(disclosed).toStrictEqual({ given_name: 'Erika', birthdate: '1963-08-12' })
      expect(sortPaths(disclosedPaths)).toStrictEqual(
        sortPaths([['vct'], ['iss'], ['cnf'], ['birthdate'], ['given_name']])
      )
    })

    test('discloses no selectively disclosable claim when requesting a claim that is not', async () => {
      const { disclosed } = await presentSdJwtVc(person, [{ path: ['birthdate'] }])

      expect(disclosed).toStrictEqual({ birthdate: '1963-08-12' })
    })

    test('discloses no selectively disclosable claim without claims queries', async () => {
      const { disclosed } = await presentSdJwtVc(person)

      expect(disclosed).toStrictEqual({ birthdate: '1963-08-12' })
    })

    test('discloses the selectively disclosable object of a requested claim, without its other claims', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        { address: sd({ street: sd('Main St'), city: sd('Anytown'), country: 'DE' }) },
        [{ path: ['address', 'city'] }]
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
        [{ path: ['address', 'street'] }]
      )

      expect(disclosed).toStrictEqual({ address: { street: 'Main St', country: 'DE' } })
    })

    test('discloses every selectively disclosable claim on the way to a deeply nested claim, and only those', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        {
          a: sd({ b: sd({ c: sd('c'), d: sd('d'), e: 'e' }), f: sd('f') }),
          g: sd('g'),
        },
        [{ path: ['a', 'b', 'c'] }]
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
        [{ path: ['address'] }]
      )

      expect(disclosed).toStrictEqual({
        address: { street: 'Main St', country: { code: 'DE', name: 'Germany', region: 'EU' } },
      })
      expect(pathsBelow(disclosedPaths, 'address')).toStrictEqual([['address']])
    })

    test('discloses everything below a requested object that is not selectively disclosable', async () => {
      const { disclosed } = await presentSdJwtVc(
        { address: { street: sd('Main St'), country: sd({ code: sd('DE') }) }, other: sd('other') },
        [{ path: ['address'] }]
      )

      expect(disclosed).toStrictEqual({ address: { street: 'Main St', country: { code: 'DE' } } })
    })

    test('discloses the claims that are not selectively disclosable in a selectively disclosable object', async () => {
      const template = { address: sd({ street: 'Main St', city: 'Anytown' }) }

      expect((await presentSdJwtVc(template, [{ path: ['address'] }])).disclosed).toStrictEqual({
        address: { street: 'Main St', city: 'Anytown' },
      })
      expect((await presentSdJwtVc(template, [{ path: ['address', 'street'] }])).disclosed).toStrictEqual({
        address: { street: 'Main St', city: 'Anytown' },
      })
    })

    test('discloses several requested claims in one object', async () => {
      const { disclosed } = await presentSdJwtVc(
        { address: sd({ street: sd('Main St'), city: sd('Anytown'), zip: sd('12345') }) },
        [{ path: ['address', 'street'] }, { path: ['address', 'city'] }]
      )

      expect(disclosed).toStrictEqual({ address: { street: 'Main St', city: 'Anytown' } })
    })

    test('discloses everything below an object when requesting both it and a claim in it', async () => {
      const { disclosed } = await presentSdJwtVc({ address: sd({ street: sd('Main St'), city: sd('Anytown') }) }, [
        { path: ['address', 'street'] },
        { path: ['address'] },
      ])

      expect(disclosed).toStrictEqual({ address: { street: 'Main St', city: 'Anytown' } })
    })

    test('discloses a requested empty object', async () => {
      const { disclosed } = await presentSdJwtVc({ empty: sd({}), other: sd('other') }, [{ path: ['empty'] }])

      expect(disclosed).toStrictEqual({ empty: {} })
    })

    test('discloses claims requested with values', async () => {
      const { disclosed } = await presentSdJwtVc(
        { age: sd(42), over_18: sd(true), nationality: sd('DE'), other: sd('other') },
        [
          { path: ['age'], values: [42] },
          { path: ['over_18'], values: [true] },
          { path: ['nationality'], values: ['NL', 'DE'] },
        ]
      )

      expect(disclosed).toStrictEqual({ age: 42, over_18: true, nationality: 'DE' })
    })

    test('discloses a requested claim between decoys', async () => {
      const { disclosed } = await presentSdJwtVc(
        { given_name: sd('Erika'), decoy1: decoy(), family_name: sd('Mustermann'), decoy2: decoy() },
        [{ path: ['family_name'] }]
      )

      expect(disclosed).toStrictEqual({ family_name: 'Mustermann' })
    })

    test('discloses a requested claim with a name that is a number', async () => {
      const { disclosed } = await presentSdJwtVc({ '0': sd('zero'), '1': sd('one') }, [{ path: ['1'] }])

      expect(disclosed).toStrictEqual({ '1': 'one' })
    })

    test('discloses the claims of the first claim set that can be satisfied, and only those', async () => {
      const { disclosed } = await presentSdJwtVc(
        { a: sd('a'), b: sd('b'), c: sd('c') },
        [
          { id: 'missing', path: ['missing'] },
          { id: 'a', path: ['a'] },
          { id: 'b', path: ['b'] },
          { id: 'c', path: ['c'] },
        ],
        [['missing'], ['a', 'b'], ['c']]
      )

      expect(disclosed).toStrictEqual({ a: 'a', b: 'b' })
    })
  })

  describe('array positions', () => {
    test('discloses the whole of an array whose elements are not selectively disclosable', async () => {
      const { disclosed } = await presentSdJwtVc({ nationalities: ['DE', 'NL', 'FR'] }, [
        { path: ['nationalities', 1] },
      ])

      expect(disclosed).toStrictEqual({ nationalities: ['DE', 'NL', 'FR'] })
    })

    test('discloses only the requested selectively disclosable element', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc({ nationalities: [sd('DE'), sd('NL'), sd('FR')] }, [
        { path: ['nationalities', 1] },
      ])

      expect(disclosed).toStrictEqual({ nationalities: ['NL'] })
      expect(pathsBelow(disclosedPaths, 'nationalities')).toStrictEqual([['nationalities', 1]])
    })

    test('discloses the requested element of a selectively disclosable array', async () => {
      const { disclosed } = await presentSdJwtVc({ nationalities: sd([sd('DE'), sd('NL'), sd('FR')]) }, [
        { path: ['nationalities', 2] },
      ])

      expect(disclosed).toStrictEqual({ nationalities: ['FR'] })
    })

    test('discloses the elements that are not selectively disclosable with a requested element', async () => {
      const template = { list: [sd('a'), 'b', sd('c'), 'd'] }

      expect((await presentSdJwtVc(template, [{ path: ['list', 2] }])).disclosed).toStrictEqual({
        list: ['b', 'c', 'd'],
      })
      expect((await presentSdJwtVc(template, [{ path: ['list', 1] }])).disclosed).toStrictEqual({ list: ['b', 'd'] })
    })

    test('gives elements the position they have without the decoys', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        { nationalities: [decoy(), sd('DE'), decoy(), decoy(), sd('NL'), sd('FR'), decoy()] },
        [{ path: ['nationalities', 1] }]
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
        [{ path: ['addresses', 1, 'city'] }]
      )

      expect(disclosed).toStrictEqual({ addresses: [{ city: 'Othertown' }] })
      expect(pathsBelow(disclosedPaths, 'addresses')).toStrictEqual([['addresses', 1, 'city']])
    })

    test('discloses a requested element of a nested array', async () => {
      const { disclosed } = await presentSdJwtVc({ matrix: sd([sd([sd(1), sd(2)]), sd([sd(3), decoy(), sd(4)])]) }, [
        { path: ['matrix', 1, 1] },
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
        [{ path: ['addresses'] }]
      )

      expect(disclosed).toStrictEqual({
        addresses: [{ street: 'Main St', tags: ['home', 'primary'] }, { street: 'Second St' }],
      })
      expect(pathsBelow(disclosedPaths, 'addresses')).toStrictEqual([['addresses']])
    })

    test('discloses several requested elements, and not the ones between them', async () => {
      const { disclosed } = await presentSdJwtVc({ list: [sd('a'), sd('b'), sd('c')] }, [
        { path: ['list', 0] },
        { path: ['list', 2] },
      ])

      expect(disclosed).toStrictEqual({ list: ['a', 'c'] })
    })

    test('discloses everything below an element when requesting both it and a claim in it', async () => {
      const { disclosed } = await presentSdJwtVc(
        { addresses: [sd({ street: sd('Main St'), city: sd('Anytown') }), sd({ street: sd('Second St') })] },
        [{ path: ['addresses', 0, 'street'] }, { path: ['addresses', 0] }]
      )

      expect(disclosed).toStrictEqual({ addresses: [{ street: 'Main St', city: 'Anytown' }] })
    })

    test('discloses a requested empty array', async () => {
      const { disclosed } = await presentSdJwtVc({ list: sd([]), other: sd('other') }, [{ path: ['list'] }])

      expect(disclosed).toStrictEqual({ list: [] })
    })
  })

  describe('null selecting every element', () => {
    test('discloses every element', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        { nationalities: [sd('DE'), decoy(), sd('NL'), 'FR'] },
        [{ path: ['nationalities', null] }]
      )

      expect(disclosed).toStrictEqual({ nationalities: ['DE', 'NL', 'FR'] })
      expect(pathsBelow(disclosedPaths, 'nationalities')).toStrictEqual([['nationalities']])
    })

    test('discloses only the elements matching the values', async () => {
      const { disclosed, disclosedPaths } = await presentSdJwtVc(
        { nationalities: [sd('DE'), decoy(), sd('NL'), sd('FR'), 'NL'] },
        [{ path: ['nationalities', null], values: ['NL'] }]
      )

      expect(disclosed).toStrictEqual({ nationalities: ['NL', 'NL'] })
      expect(pathsBelow(disclosedPaths, 'nationalities')).toStrictEqual([
        ['nationalities', 1],
        ['nationalities', 3],
      ])
    })

    test('discloses a requested claim of every element, whether the element and the claim are selectively disclosable or not', async () => {
      const { disclosed } = await presentSdJwtVc(
        {
          people: [
            sd({ name: sd('A'), age: sd(1) }),
            { name: sd('B'), age: sd(2) },
            sd({ name: 'C', age: sd(3) }),
            { name: 'D', age: sd(4) },
            sd({ age: sd(5) }),
            { age: sd(6) },
            sd({ name: sd({ first: sd('F'), last: 'L' }), age: sd(7) }),
            decoy(),
            sd('selectively disclosable text'),
            'text',
          ],
        },
        [{ path: ['people', null, 'name'] }]
      )

      expect(disclosed).toStrictEqual({
        people: [
          { name: 'A' },
          { name: 'B' },
          { name: 'C' },
          { name: 'D' },
          // The element without a name is not disclosed, but one that is not selectively disclosable is
          {},
          { name: { first: 'F', last: 'L' } },
          'text',
        ],
      })
    })

    test('discloses a requested claim only of the elements matching the values', async () => {
      const { disclosed } = await presentSdJwtVc(
        {
          people: [
            sd({ name: sd('A'), role: sd('admin') }),
            sd({ name: sd('B'), role: sd('user') }),
            { name: sd('C'), role: sd('admin') },
            sd({ name: 'D', role: 'admin' }),
            { name: sd('E'), role: sd('user') },
          ],
        },
        [{ path: ['people', null, 'role'], values: ['admin'] }]
      )

      expect(disclosed).toStrictEqual({
        people: [{ role: 'admin' }, { role: 'admin' }, { name: 'D', role: 'admin' }, {}],
      })
    })

    test('discloses the matching claims of nested arrays', async () => {
      const { disclosed } = await presentSdJwtVc(
        {
          privileges: sd([
            sd({
              category: sd('A'),
              codes: sd([sd({ code: sd('D'), value: sd('1') }), sd({ code: sd('E'), value: sd('2') })]),
            }),
            sd({ category: sd('B'), codes: sd([decoy(), sd({ code: sd('D'), value: sd('3') })]) }),
            sd({ category: sd('C'), codes: [] }),
          ]),
        },
        [{ path: ['privileges', null, 'codes', null, 'code'], values: ['D'] }]
      )

      expect(disclosed).toStrictEqual({ privileges: [{ codes: [{ code: 'D' }] }, { codes: [{ code: 'D' }] }] })
    })

    test('discloses everything below every element', async () => {
      const { disclosed } = await presentSdJwtVc(
        {
          people: sd([sd({ name: sd('A'), address: sd({ city: sd('X') }) }), decoy(), sd({ name: sd('B') })]),
          other: sd('other'),
        },
        [{ path: ['people', null] }]
      )

      expect(disclosed).toStrictEqual({ people: [{ name: 'A', address: { city: 'X' } }, { name: 'B' }] })
    })

    test('does not disclose the claims of an element that matches another claims query of the claim set', async () => {
      const { disclosed } = await presentSdJwtVc(
        {
          people: [
            sd({ name: sd('A'), role: sd('admin'), age: sd(1) }),
            sd({ name: sd('B'), role: sd('user'), age: sd(2) }),
          ],
        },
        [{ path: ['people', null, 'role'], values: ['admin'] }, { path: ['people', 1, 'name'] }]
      )

      expect(disclosed).toStrictEqual({ people: [{ role: 'admin' }, { name: 'B' }] })
    })
  })

  describe('credentials with several instances', () => {
    test('discloses the same claims with every instance, wherever its decoys are', async () => {
      const people = [
        sd({ name: sd('A'), role: sd('admin') }),
        sd({ name: sd('B'), role: sd('user') }),
        sd({ name: sd('C'), role: sd('admin') }),
      ]

      // The same claims, but in each instance with other salts, and with decoys in other places
      const instances = [
        {
          nationalities: [sd('DE'), sd('NL'), sd('FR')],
          people,
          address: sd({ street: sd('Main St'), city: sd('Anytown') }),
        },
        {
          nationalities: [decoy(), sd('DE'), decoy(), decoy(), sd('NL'), sd('FR')],
          people: [decoy(), decoy(), people[0], people[1], decoy(), people[2]],
          address: sd({ decoy: decoy(), street: sd('Main St'), city: sd('Anytown') }),
          decoy: decoy(),
        },
        {
          nationalities: [sd('DE'), sd('NL'), decoy(), sd('FR'), decoy()],
          people: [
            people[0],
            sd({ name: sd('B'), decoy1: decoy(), role: sd('user'), decoy2: decoy() }),
            decoy(),
            people[2],
          ],
          address: sd({ street: sd('Main St'), city: sd('Anytown'), decoy: decoy() }),
        },
      ]

      const claims = [
        { path: ['nationalities', 1] },
        { path: ['people', null, 'role'], values: ['admin'] },
        { path: ['address', 'city'] },
      ]

      // DCQL finds the paths with the first instance of a record, while presenting uses a new instance: the
      // last one. So every instance is presented after finding the paths with every other instance.
      for (const [first, last] of instances.flatMap((_, first) =>
        instances.flatMap((_, last) => (first === last ? [] : [[first, last]]))
      )) {
        const { vct, compacts } = await storeSdJwtVc([instances[first], instances[last]])
        const { disclosed, disclosedPaths, jwt } = await presentStoredSdJwtVc(vct, claims)

        expect(jwt).toStrictEqual(compacts[1].split('~')[0])
        expect(disclosed).toStrictEqual({
          nationalities: ['NL'],
          people: [{ role: 'admin' }, { role: 'admin' }],
          address: { city: 'Anytown' },
        })
        expect(
          sortPaths(disclosedPaths.filter((path) => !['vct', 'iss', 'cnf'].includes(path[0] as string)))
        ).toStrictEqual(
          sortPaths([
            ['nationalities', 1],
            ['people', 0, 'role'],
            ['people', 2, 'role'],
            ['address', 'city'],
          ])
        )
      }
    })
  })

  describe('limitations', () => {
    // @sd-jwt/core (up to 0.21.0) replaces the `_sd` in the values of disclosures with their claims while
    // presenting, and presents twice to add the key binding. The second time, a disclosure below a claim
    // that is not selectively disclosable in a selectively disclosable claim is no longer referenced.
    // Tests above make such claims selectively disclosable to avoid this. Remove `.fails` once fixed.
    test.fails('presents claims in a claim that is not selectively disclosable in a selectively disclosable claim', async () => {
      const { disclosed } = await presentSdJwtVc({ address: sd({ geo: { lat: sd(1) }, tags: [sd('home')] }) }, [
        { path: ['address'] },
      ])

      expect(disclosed).toStrictEqual({ address: { geo: { lat: 1 }, tags: ['home'] } })
    })
  })

  describe('queries that cannot be satisfied', () => {
    const cannotBeSatisfied = async (template: Record<string, unknown>, claims: ClaimsQuery[]) => {
      const vct = `urn:vct:${randomUUID()}`
      await agent.sdJwtVc.store({
        record: new SdJwtVcRecord({
          credentialInstances: [{ compactSdJwtVc: await signSdJwt({ vct, ...template }, 'dc+sd-jwt') }],
        }),
      })

      const queryResult = await dcqlService.getCredentialsForRequest(agent.context, {
        credentials: [{ id: 'credential', format: 'dc+sd-jwt', meta: { vct_values: [vct] }, claims }],
      } as unknown as DcqlQuery)
      return !queryResult.can_be_satisfied
    }

    test('with values that do not match', async () => {
      expect(await cannotBeSatisfied({ age: sd(42) }, [{ path: ['age'], values: [18] }])).toBe(true)
    })

    test('with a position after the last element', async () => {
      expect(await cannotBeSatisfied({ list: [sd('a'), decoy()] }, [{ path: ['list', 1] }])).toBe(true)
    })

    test('with null and values that no element matches', async () => {
      expect(await cannotBeSatisfied({ list: [sd('a'), 'b'] }, [{ path: ['list', null], values: ['c'] }])).toBe(true)
    })
  })

  describe('presenting', () => {
    test('still discloses based on the payload without the disclosed paths', async () => {
      const { disclosed } = await presentSdJwtVc(
        { given_name: sd('Erika'), family_name: sd('Mustermann'), address: sd({ city: sd('Anytown') }) },
        [{ path: ['address', 'city'] }],
        undefined,
        { withoutDisclosedPaths: true }
      )

      expect(disclosed).toStrictEqual({ address: { city: 'Anytown' } })
    })

    test('discloses the claims of a W3C VC SD-JWT', async () => {
      const type = `urn:type:${randomUUID()}`
      const compact = await signSdJwt(
        {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential', type],
          issuer: issuerDid,
          credentialSubject: {
            given_name: sd('Erika'),
            family_name: sd('Mustermann'),
            nationalities: [sd('DE'), decoy(), sd('NL')],
            degrees: [sd({ name: sd('BSc'), year: sd(2000) }), sd({ name: sd('MSc'), year: sd(2002) })],
          },
        },
        'vc+sd-jwt'
      )
      const record = new W3cV2CredentialRecord({ credentialInstances: [{ credential: compact }] })
      await agent.w3cV2Credentials.store({ record })

      const dcqlQuery = {
        credentials: [
          {
            id: 'credential',
            format: 'vc+sd-jwt',
            meta: { type_values: [[type]] },
            claims: [
              { path: ['credentialSubject', 'nationalities', 1] },
              { path: ['credentialSubject', 'degrees', null, 'name'], values: ['MSc'] },
            ],
          },
        ],
      } as unknown as DcqlQuery

      const queryResult = await dcqlService.getCredentialsForRequest(agent.context, dcqlQuery)
      expect(queryResult.can_be_satisfied).toBe(true)

      const { dcqlPresentation } = await dcqlService.createPresentation(agent.context, {
        credentialQueryToCredential: dcqlService.selectCredentialsForRequest(queryResult),
        challenge,
        domain,
      })
      await dcqlService.assertValidDcqlPresentation(agent.context, dcqlPresentation, dcqlQuery)

      const presentation = dcqlPresentation.credential[0] as W3cV2SdJwtVerifiablePresentation
      const [credential] = presentation.resolvedPresentation.verifiableCredential as never as Array<{
        envelopedCredential: { sdJwt: { prettyClaims: Record<string, unknown> } }
      }>
      const claimSet = getClaimSet(queryResult)

      expect(credential.envelopedCredential.sdJwt.prettyClaims.credentialSubject).toStrictEqual({
        nationalities: ['NL'],
        degrees: [{ name: 'MSc' }],
      })
      expect((claimSet.output as Record<string, unknown>).credentialSubject).toStrictEqual({
        nationalities: ['NL'],
        degrees: [{ name: 'MSc' }],
      })
    })
  })
})

describe('getClaimPathsForDcqlClaimSet', () => {
  test('ends a path where the claims query path ends', () => {
    expect(
      getClaimPathsForDcqlClaimSet([['address']], { address: { street: 'Main St', country: { code: 'DE' } } })
    ).toStrictEqual([['address']])
  })

  test('selects the elements DCQL did not leave null, undefined or nothing for', () => {
    // `null`, as in the output of a claims query
    expect(getClaimPathsForDcqlClaimSet([['list', 2]], { list: [null, null, 'c'] })).toStrictEqual([['list', 2]])
    // `undefined` and holes, as in the output of a claim set
    expect(getClaimPathsForDcqlClaimSet([['list', null]], { list: [undefined, 'b', undefined, 'd'] })).toStrictEqual([
      ['list', 1],
      ['list', 3],
    ])
    const list: unknown[] = []
    list[1] = 'b'
    list[3] = 'd'
    expect(getClaimPathsForDcqlClaimSet([['list', null]], { list })).toStrictEqual([
      ['list', 1],
      ['list', 3],
    ])
    expect(
      getClaimPathsForDcqlClaimSet([['list', null, 'name']], { list: [{ name: 'a' }, null, { name: 'c' }] })
    ).toStrictEqual([
      ['list', 0, 'name'],
      ['list', 2, 'name'],
    ])
  })

  test('has no path where the output has no claim', () => {
    expect(getClaimPathsForDcqlClaimSet([['list', null, 'name']], { list: [{ other: 'a' }] })).toStrictEqual([])
    expect(getClaimPathsForDcqlClaimSet([['a', 'b']], { a: ['b'] })).toStrictEqual([])
    expect(getClaimPathsForDcqlClaimSet([['a', 0]], { a: { 0: 'b' } })).toStrictEqual([])
    expect(getClaimPathsForDcqlClaimSet([], {})).toStrictEqual([])
  })
})
