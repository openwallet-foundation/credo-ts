import { randomBytes } from 'node:crypto'

import {
  Agent,
  ClaimFormat,
  JsonTransformer,
  Kms,
  SdJwtVcModule,
  StatusListCwt,
  W3cCredential,
  W3cJwtVerifiableCredential,
  X509Service,
} from '@credo-ts/core'

import { getAgentOptions } from '../../core/tests/helpers'
import type { CheqdDidCreateOptions } from '../src'
import { createCheqdStatusListFetcher, createLegacyStatusEntry } from '../src'
import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'

// Payer seed [4] is unused elsewhere, and shared by the describes in this file, which run in order. The holder has no
// cheqd module: it never touches the ledger.
const issuer = new Agent(getAgentOptions('SD-JWT VC issuer', {}, {}, getCheqdModules(cheqdPayerSeeds[4])))
const holder = new Agent(getAgentOptions('SD-JWT VC holder', {}, {}, {}))
const verifier = new Agent(getAgentOptions('SD-JWT VC verifier', {}, {}, getCheqdModules(cheqdPayerSeeds[4])))

describe('SD-JWT VC lifecycle with a did:cheqd P-256 issuer', () => {
  let issuerDidUrl: string
  let compact: string
  let holderKmsKeyId: string

  beforeAll(async () => {
    await Promise.all([issuer.initialize(), holder.initialize(), verifier.initialize()])

    const created = await issuer.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: { createKey: { type: { kty: 'EC', crv: 'P-256' } }, network: 'testnet' },
    })
    expect(created.didState.state).toBe('finished')
    issuerDidUrl = `${created.didState.did}#key-1`

    // The holder creates its own key and shares only the public key with the issuer
    const holderKey = await holder.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const issued = await issuer.sdJwtVc.sign({
      payload: { vct: 'https://example.com/vct/test', given_name: 'Alice', family_name: 'Doe', age: 30 },
      issuer: { method: 'did', didUrl: issuerDidUrl },
      holder: { method: 'jwk', jwk: Kms.PublicJwk.fromPublicJwk(holderKey.publicJwk) },
      disclosureFrame: { _sd: ['given_name', 'family_name', 'age'] },
    })
    compact = issued.compact
    holderKmsKeyId = holderKey.keyId
  })

  afterAll(async () => {
    await Promise.all([issuer.shutdown(), holder.shutdown(), verifier.shutdown()])
  })

  const verifierMetadata = {
    audience: 'https://verifier.example.com',
    nonce: 'nonce-123',
    issuedAt: Math.floor(Date.now() / 1000),
  }

  it('issues, then verifies the issuer signature through did:cheqd resolution', async () => {
    const result = await verifier.sdJwtVc.verify({ compactSdJwtVc: compact })
    expect(result.isValid).toBe(true)
    expect(result.sdJwtVc?.header.alg).toBe('ES256')
  })

  it('presents selectively with a key binding JWT and verifies it', async () => {
    const presentation = await holder.sdJwtVc.present({
      sdJwtVc: { ...holder.sdJwtVc.fromCompact(compact), kmsKeyId: holderKmsKeyId },
      presentationFrame: { given_name: true },
      verifierMetadata,
    })

    const result = await verifier.sdJwtVc.verify({
      compactSdJwtVc: presentation,
      keyBinding: { audience: verifierMetadata.audience, nonce: verifierMetadata.nonce },
      requiredClaimKeys: ['given_name'],
    })
    expect(result.isValid).toBe(true)
    expect(result.sdJwtVc?.prettyClaims).toMatchObject({ given_name: 'Alice' })
    // Not disclosed in this presentation
    expect(result.sdJwtVc?.prettyClaims).not.toHaveProperty('family_name')
    expect(result.sdJwtVc?.prettyClaims).not.toHaveProperty('age')
  })

  it('rejects a presentation for a different nonce or audience', async () => {
    const presentation = await holder.sdJwtVc.present({
      sdJwtVc: { ...holder.sdJwtVc.fromCompact(compact), kmsKeyId: holderKmsKeyId },
      presentationFrame: { given_name: true },
      verifierMetadata,
    })

    const wrongNonce = await verifier.sdJwtVc.verify({
      compactSdJwtVc: presentation,
      keyBinding: { audience: verifierMetadata.audience, nonce: 'other-nonce' },
    })
    expect(wrongNonce.isValid).toBe(false)

    const wrongAudience = await verifier.sdJwtVc.verify({
      compactSdJwtVc: presentation,
      keyBinding: { audience: 'https://evil.example.com', nonce: verifierMetadata.nonce },
    })
    expect(wrongAudience.isValid).toBe(false)
  })

  it('rejects a presentation without a key binding JWT when one is required', async () => {
    const noBinding = await holder.sdJwtVc.present({
      sdJwtVc: { ...holder.sdJwtVc.fromCompact(compact), kmsKeyId: holderKmsKeyId },
      presentationFrame: { given_name: true },
    })
    const result = await verifier.sdJwtVc.verify({
      compactSdJwtVc: noBinding,
      keyBinding: { audience: verifierMetadata.audience, nonce: verifierMetadata.nonce },
    })
    expect(result.isValid).toBe(false)
  })

  it('rejects a presentation missing a required claim', async () => {
    const presentation = await holder.sdJwtVc.present({
      sdJwtVc: { ...holder.sdJwtVc.fromCompact(compact), kmsKeyId: holderKmsKeyId },
      presentationFrame: { given_name: true },
      verifierMetadata,
    })
    const result = await verifier.sdJwtVc.verify({
      compactSdJwtVc: presentation,
      keyBinding: { audience: verifierMetadata.audience, nonce: verifierMetadata.nonce },
      requiredClaimKeys: ['family_name'],
    })
    expect(result.isValid).toBe(false)
  })
})

describe('Token Status List stored as a did:cheqd linked resource', () => {
  const statusListName = 'revocation list'
  let issuer: Agent<ReturnType<typeof getCheqdModules>>
  let verifier: Agent<ReturnType<typeof getCheqdModules> & { sdJwtVc: SdJwtVcModule }>
  let didUrl: string
  let did: string
  let statusListUri: string

  const signer = () => ({ method: 'did' as const, didUrl })
  const issueCredential = (idx: number) =>
    issuer.sdJwtVc.sign({
      payload: {
        vct: 'https://example.com/vct/test',
        given_name: 'Alice',
        status: { status_list: { idx, uri: statusListUri } },
      },
      issuer: { method: 'did', didUrl },
      disclosureFrame: { _sd: ['given_name'] },
    })

  beforeAll(async () => {
    issuer = new Agent(getAgentOptions('Status list issuer', {}, {}, getCheqdModules(cheqdPayerSeeds[4])))
    verifier = new Agent(
      getAgentOptions(
        'Status list verifier',
        {},
        {},
        {
          ...getCheqdModules(cheqdPayerSeeds[4]),
          // reads the list from the ledger; the verifier never writes
          sdJwtVc: new SdJwtVcModule({ customStatusListFetcher: createCheqdStatusListFetcher(() => verifier.context) }),
        }
      )
    )
    await Promise.all([issuer.initialize(), verifier.initialize()])

    const created = await issuer.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: { createKey: { type: { kty: 'EC', crv: 'P-256' } }, network: 'testnet' },
    })
    expect(created.didState.state).toBe('finished')
    did = created.didState.did as string
    didUrl = `${did}#key-1`
    // the name has a space, so the uri has to be percent-encoded
    statusListUri = issuer.modules.cheqdSdk.getTokenStatusListUri({ did, name: statusListName })
  })

  afterAll(async () => {
    await Promise.all([issuer.shutdown(), verifier.shutdown()])
  })

  it('publishes a JWT list, verifies a credential against it, and rejects the credential once it is revoked', async () => {
    const list = await issuer.tokenStatusList.createTokenStatusList<'jwt'>({
      format: 'jwt',
      alg: 'ES256',
      statusList: { statusListLength: 64, bitsPerStatus: 1 },
      statusListUri,
      signer: signer(),
    })
    await issuer.modules.cheqdSdk.publishTokenStatusList(did, { name: statusListName, statusList: list.statusList })

    const credential = await issueCredential(5)
    const valid = await verifier.sdJwtVc.verify({ compactSdJwtVc: credential.compact })
    expect(valid.isValid, valid.isValid ? '' : String(valid.error)).toBe(true)

    // revoke index 5 and publish the new version under the same name: the uri does not change
    const updated = await issuer.tokenStatusList.updateTokenStatusList<'jwt'>({
      format: 'jwt',
      alg: 'ES256',
      token: list.statusList,
      status: { index: 5, status: 1 },
      signer: signer(),
    })
    await issuer.modules.cheqdSdk.publishTokenStatusList(did, { name: statusListName, statusList: updated.statusList })

    expect((await verifier.sdJwtVc.verify({ compactSdJwtVc: credential.compact })).isValid).toBe(false)
    expect((await verifier.sdJwtVc.verify({ compactSdJwtVc: (await issueCredential(6)).compact })).isValid).toBe(true)

    const fetched = await verifier.modules.cheqdSdk.fetchTokenStatusList(did, statusListName)
    expect(fetched).toMatchObject({ format: 'jwt', statusList: updated.statusList })
  })

  it('needs a gas limit for a large list', async () => {
    // Incompressible, about 40 KB: more than the 1,000,000 gas the SDK sets by default (about 41 gas per byte)
    const statusList = randomBytes(30_000).toString('base64url')

    await expect(
      issuer.modules.cheqdSdk.publishTokenStatusList(did, { name: 'large list', statusList })
    ).rejects.toThrow(/out of gas/)

    const { resourceId } = await issuer.modules.cheqdSdk.publishTokenStatusList(did, {
      name: 'large list',
      statusList,
      feeOptions: { slippageBps: 1000, gasLimit: '3000000' },
    })
    expect(resourceId).toBeDefined()
  })

  it('publishes a CWT list and reads it back as the same bytes', async () => {
    // Credo signs a CWT list only with an X.509 certificate, not with a did key
    const key = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const certificate = await X509Service.createCertificate(issuer.context, {
      authorityKey: Kms.PublicJwk.fromPublicJwk(key.publicJwk),
      validity: { notBefore: new Date(Date.now() - 86_400_000), notAfter: new Date(Date.now() + 86_400_000) },
      issuer: 'C=DE',
    })
    const list = await issuer.tokenStatusList.createTokenStatusList<'cwt'>({
      format: 'cwt',
      alg: 'ES256',
      statusList: { statusListLength: 64, bitsPerStatus: 1 },
      statusListUri: issuer.modules.cheqdSdk.getTokenStatusListUri({ did, name: 'cwt list' }),
      signer: { method: 'x5c', x5c: [certificate] },
    })
    await issuer.modules.cheqdSdk.publishTokenStatusList(did, { name: 'cwt list', statusList: list.statusList })

    const fetched = await verifier.modules.cheqdSdk.fetchTokenStatusList(did, 'cwt list')
    expect(fetched.format).toBe('cwt')
    expect(fetched.statusList).toEqual(list.statusList)
    expect(StatusListCwt.fromToken(fetched.statusList as Uint8Array).payload.statusList).toBeDefined()
  })

  it('refuses a CWT list for an SD-JWT VC, and leaves other uris to the default fetcher', async () => {
    const fetcher = createCheqdStatusListFetcher(() => verifier.context)
    const unexpected = async () => {
      throw new Error('default fetcher should not be used')
    }

    await expect(
      fetcher(issuer.modules.cheqdSdk.getTokenStatusListUri({ did, name: 'cwt list' }), { defaultFetcher: unexpected })
    ).rejects.toThrow(/CWT/)
    await expect(fetcher('https://example.com/status/1', { defaultFetcher: async () => 'default' })).resolves.toBe(
      'default'
    )
  })

  it('fails for a list that was never published', async () => {
    await expect(verifier.modules.cheqdSdk.fetchTokenStatusList(did, 'never published')).rejects.toThrow()
  })
})

describe('StatusList2021 and Bitstring status lists stored as did:cheqd linked resources', () => {
  let issuer: Agent<ReturnType<typeof getCheqdModules>>
  let did: string
  let otherDid: string

  beforeAll(async () => {
    issuer = new Agent(getAgentOptions('Legacy status list issuer', {}, {}, getCheqdModules(cheqdPayerSeeds[4])))
    await issuer.initialize()
    const create = async () => {
      const created = await issuer.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: { createKey: { type: { kty: 'EC', crv: 'P-256' } }, network: 'testnet' },
      })
      expect(created.didState.state).toBe('finished')
      return created.didState.did as string
    }
    did = await create()
    otherDid = await create()
  })

  afterAll(async () => {
    await issuer.shutdown()
  })

  const check = (credential: Parameters<typeof issuer.modules.cheqdSdk.checkLegacyCredentialStatus>[0]) =>
    issuer.modules.cheqdSdk.checkLegacyCredentialStatus(credential)

  it('creates a StatusList2021 revocation list, checks an entry, and sees it revoked after an update', async () => {
    const { uri, resourceType } = await issuer.modules.cheqdSdk.createLegacyStatusList(did, {
      format: 'StatusList2021',
      name: 'revocation list',
      statusPurpose: 'revocation',
    })
    expect(resourceType).toBe('StatusList2021Revocation')

    const entry = createLegacyStatusEntry({
      format: 'StatusList2021',
      statusListCredential: uri,
      statusPurpose: 'revocation',
      index: 42,
    })
    const credential = { issuer: { id: did }, credentialStatus: entry }

    expect(await check(credential)).toMatchObject([{ status: 0, valid: true, revoked: false, statusListIndex: 42 }])

    await issuer.modules.cheqdSdk.updateLegacyStatusList(did, {
      name: 'revocation list',
      resourceType,
      updates: [{ index: 42, value: 1 }],
    })

    expect(await check(credential)).toMatchObject([{ status: 1, valid: false, revoked: true, suspended: false }])
    // other entries are untouched
    expect(await check({ issuer: did, credentialStatus: { ...entry, statusListIndex: '43' } })).toMatchObject([
      { valid: true, revoked: false },
    ])

    // and the entry can be reinstated
    await issuer.modules.cheqdSdk.updateLegacyStatusList(did, {
      name: 'revocation list',
      resourceType,
      updates: [{ index: 42, value: 0 }],
    })
    expect(await check(credential)).toMatchObject([{ valid: true, revoked: false }])
  })

  it('creates a Bitstring list with 2 bits per entry, and tells revoked from suspended', async () => {
    const { uri, resourceType } = await issuer.modules.cheqdSdk.createLegacyStatusList(did, {
      format: 'BitstringStatusList',
      name: 'bitstring list',
      signerDidUrl: `${did}#key-1`,
    })
    expect(resourceType).toBe('BitstringStatusListCredential')

    const entryFor = (index: number, statusPurpose: 'revocation' | 'suspension' | 'message') =>
      createLegacyStatusEntry({ format: 'BitstringStatusList', statusListCredential: uri, statusPurpose, index })

    await issuer.modules.cheqdSdk.updateLegacyStatusList(did, {
      name: 'bitstring list',
      resourceType,
      updates: [
        { index: 10, value: 1 },
        { index: 11, value: 2 },
      ],
    })

    expect(await check({ issuer: did, credentialStatus: entryFor(10, 'message') })).toMatchObject([
      { status: 1, message: 'revoked', revoked: true, suspended: false },
    ])
    expect(await check({ issuer: did, credentialStatus: entryFor(11, 'message') })).toMatchObject([
      { status: 2, message: 'suspended', revoked: false, suspended: true },
    ])
    expect(await check({ issuer: did, credentialStatus: entryFor(12, 'revocation') })).toMatchObject([
      { status: 0, valid: true, message: 'valid' },
    ])
  })

  it('refuses a list that is not a resource of the issuer of the credential', async () => {
    const { uri } = await issuer.modules.cheqdSdk.createLegacyStatusList(did, {
      format: 'StatusList2021',
      name: 'issuer binding',
      statusPurpose: 'suspension',
    })
    const entry = createLegacyStatusEntry({
      format: 'StatusList2021',
      statusListCredential: uri,
      statusPurpose: 'suspension',
      index: 1,
    })

    await expect(check({ issuer: otherDid, credentialStatus: entry })).rejects.toThrow('not of the issuer')
    // checking with the issuer works
    await expect(check({ issuer: did, credentialStatus: entry })).resolves.toMatchObject([{ valid: true }])
  })

  it('refuses a purpose the list does not have, an index outside the list, and a url that is not a did:cheqd list', async () => {
    const { uri } = await issuer.modules.cheqdSdk.createLegacyStatusList(did, {
      format: 'StatusList2021',
      name: 'purpose and range',
      statusPurpose: 'revocation',
    })
    const entry = createLegacyStatusEntry({
      format: 'StatusList2021',
      statusListCredential: uri,
      statusPurpose: 'revocation',
      index: 0,
    })

    await expect(check({ issuer: did, credentialStatus: { ...entry, statusPurpose: 'suspension' } })).rejects.toThrow(
      "does not have the purpose 'suspension'"
    )
    await expect(check({ issuer: did, credentialStatus: { ...entry, statusListIndex: '140000' } })).rejects.toThrow(
      'out of range'
    )
    await expect(
      check({ issuer: did, credentialStatus: { ...entry, statusListCredential: 'https://example.com/status/1' } })
    ).rejects.toThrow('not the uri of a did:cheqd status list')
  })

  describe('revoking, suspending and reinstating a credential, and several indices in an entry', () => {
    const sdk = () => issuer.modules.cheqdSdk

    it('writes a StatusList2021 revocation and suspension, and refuses what the entry does not allow', async () => {
      const revocation = await sdk().createLegacyStatusList(did, {
        format: 'StatusList2021',
        name: 'actions revocation',
        statusPurpose: 'revocation',
      })
      const suspension = await sdk().createLegacyStatusList(did, {
        format: 'StatusList2021',
        name: 'actions suspension',
        statusPurpose: 'suspension',
      })
      const revocable = {
        issuer: did,
        credentialStatus: createLegacyStatusEntry({
          format: 'StatusList2021',
          statusListCredential: revocation.uri,
          statusPurpose: 'revocation',
          index: 5,
        }),
      }
      const suspendable = {
        issuer: did,
        credentialStatus: createLegacyStatusEntry({
          format: 'StatusList2021',
          statusListCredential: suspension.uri,
          statusPurpose: 'suspension',
          index: 6,
        }),
      }

      await sdk().setLegacyCredentialStatus(suspendable, 'suspend')
      expect(await check(suspendable)).toMatchObject([{ suspended: true, valid: false }])
      await sdk().setLegacyCredentialStatus(suspendable, 'reinstate')
      expect(await check(suspendable)).toMatchObject([{ suspended: false, valid: true }])

      const written = await sdk().setLegacyCredentialStatus(revocable, 'revoke')
      expect(written).toMatchObject([{ did, indices: [5], value: 1 }])
      expect(await check(revocable)).toMatchObject([{ revoked: true }])

      // a revocation is not undone, and an entry only takes the action of its purpose
      await expect(sdk().setLegacyCredentialStatus(revocable, 'reinstate')).rejects.toThrow('cannot be undone')
      await expect(sdk().setLegacyCredentialStatus(revocable, 'suspend')).rejects.toThrow(
        "Cannot suspend an entry of the purpose 'revocation'"
      )
      await expect(sdk().setLegacyCredentialStatus({ issuer: did }, 'revoke')).rejects.toThrow('no credentialStatus')
      // and only for the issuer of the credential
      await expect(sdk().setLegacyCredentialStatus({ ...revocable, issuer: otherDid }, 'revoke')).rejects.toThrow(
        'not of the issuer'
      )
    })

    it('updates a list named by resource id on top of its latest version, and flags that the entry stays pinned', async () => {
      const created = await sdk().createLegacyStatusList(did, {
        format: 'StatusList2021',
        name: 'pinned revocation',
        statusPurpose: 'revocation',
      })
      const entryFor = (statusListCredential: string, index: number) => ({
        issuer: did,
        credentialStatus: createLegacyStatusEntry({
          format: 'StatusList2021',
          statusListCredential,
          statusPurpose: 'revocation',
          index,
        }),
      })
      const pinned = entryFor(`${did}/resources/${created.resourceId}`, 7)
      const named = entryFor(created.uri, 8)

      // a later change by name moves the latest version on; the pinned entry is now based on an older version
      await sdk().updateLegacyStatusList(did, {
        name: 'pinned revocation',
        resourceType: 'StatusList2021Revocation',
        updates: [{ index: 8, value: 1 }],
      })

      const written = await sdk().setLegacyCredentialStatus(pinned, 'revoke')
      expect(written).toMatchObject([{ did, name: 'pinned revocation', indices: [7], value: 1, pinned: true }])
      expect(written[0].resourceId).not.toBe(created.resourceId)

      // the change did not drop the earlier one, because it was written on the latest version...
      expect(await check(named)).toMatchObject([{ revoked: true, resourceId: written[0].resourceId }])
      // ...and the pinned entry still reads the version it names, which has neither change
      expect(await check(pinned)).toMatchObject([{ revoked: false, valid: true, resourceId: created.resourceId }])

      expect(
        await sdk().updateLegacyStatusList(did, { resourceId: created.resourceId, updates: [{ index: 9, value: 1 }] })
      ).toMatchObject({ name: 'pinned revocation', resourceType: 'StatusList2021Revocation' })
      await expect(
        sdk().updateLegacyStatusList(did, { resourceId: '00000000-0000-4000-8000-000000000000', updates: [] })
      ).rejects.toThrow('Unable to read the status list')
    })

    it('writes the values Studio uses to a Bitstring list, for an entry with several indices', async () => {
      const list = await sdk().createLegacyStatusList(did, {
        format: 'BitstringStatusList',
        name: 'actions bitstring',
        signerDidUrl: `${did}#key-1`,
      })
      const entry = {
        ...createLegacyStatusEntry({
          format: 'BitstringStatusList',
          statusListCredential: list.uri,
          statusPurpose: 'message',
          index: 0,
        }),
        statusListIndex: undefined,
        statusListIndices: ['20-22', 30],
      }
      const credential = { issuer: did, credentialStatus: entry }

      await sdk().setLegacyCredentialStatus(credential, 'revoke')
      expect(
        (await check(credential)).map((result) => [result.statusListIndex, result.status, result.message])
      ).toEqual([
        [20, 1, 'revoked'],
        [21, 1, 'revoked'],
        [22, 1, 'revoked'],
        [30, 1, 'revoked'],
      ])

      await sdk().setLegacyCredentialStatus(credential, 'suspend')
      expect((await check(credential)).every((result) => result.status === 2 && result.suspended)).toBe(true)

      await sdk().setLegacyCredentialStatus(credential, 'reinstate')
      expect((await check(credential)).every((result) => result.valid)).toBe(true)
    })

    it('reads the status of a whole presentation, a JWT credential among them', async () => {
      const list = await sdk().createLegacyStatusList(did, {
        format: 'StatusList2021',
        name: 'presentation list',
        statusPurpose: 'revocation',
      })
      const entry = (index: number) =>
        createLegacyStatusEntry({
          format: 'StatusList2021',
          statusListCredential: list.uri,
          statusPurpose: 'revocation',
          index,
        })

      const jwt = await issuer.w3cCredentials.signCredential({
        format: ClaimFormat.JwtVc,
        credential: JsonTransformer.fromJSON(
          {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential'],
            issuer: did,
            issuanceDate: '2026-01-01T00:00:00Z',
            credentialSubject: { id: 'did:example:subject' },
            credentialStatus: entry(1),
          },
          W3cCredential
        ),
        alg: 'ES256',
        verificationMethod: `${did}#key-1`,
      })
      const revoked = { issuer: did, credentialStatus: entry(2) }
      await sdk().setLegacyCredentialStatus(revoked, 'revoke')

      const allValid = await sdk().checkLegacyPresentationStatus({
        verifiableCredential: [
          (jwt as W3cJwtVerifiableCredential).serializedJwt,
          { issuer: did, credentialStatus: entry(3) },
          { issuer: did },
        ],
      })
      expect(allValid).toMatchObject({ valid: true, revoked: false, suspended: false })
      expect(allValid.credentials).toHaveLength(3)

      const withRevoked = await sdk().checkLegacyPresentationStatus({
        verifiableCredential: [(jwt as W3cJwtVerifiableCredential).serializedJwt, revoked],
      })
      expect(withRevoked).toMatchObject({ valid: false, revoked: true, suspended: false })

      // a list that cannot be read is reported for that credential and does not hide the others
      const unreadable = await sdk().checkLegacyPresentationStatus({
        verifiableCredential: [
          revoked,
          { issuer: did, credentialStatus: { ...entry(1), statusListCredential: 'https://example.com/status' } },
        ],
      })
      expect(unreadable.valid).toBe(false)
      expect(unreadable.credentials[0]).toMatchObject({ index: 0, results: [{ revoked: true }] })
      expect(unreadable.credentials[1]).toMatchObject({
        index: 1,
        error: expect.stringContaining('not the uri of a did:cheqd status list'),
      })

      await expect(sdk().checkLegacyPresentationStatus({})).rejects.toThrow('no credentials')
    })
  })

  it('refuses a list of the other format than the entry says', async () => {
    const { uri } = await issuer.modules.cheqdSdk.createLegacyStatusList(did, {
      format: 'StatusList2021',
      name: 'format mismatch',
      statusPurpose: 'revocation',
    })
    const entry = createLegacyStatusEntry({
      format: 'BitstringStatusList',
      statusListCredential: uri,
      statusPurpose: 'revocation',
      index: 0,
    })
    await expect(check({ issuer: did, credentialStatus: entry })).rejects.toThrow('not a Bitstring list')
  })
})
