import { generateKeyPairSync } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import type { DidDocument } from '@credo-ts/core'
import {
  Agent,
  DidDocumentBuilder,
  DidRepository,
  getEd25519VerificationKey2018,
  getJsonWebKey2020,
  JsonTransformer,
  Kms,
  utils,
} from '@credo-ts/core'

import { getAgentOptions } from '../../core/tests/helpers'
import type { CheqdDidCreateOptions, CheqdDidUpdateOptions } from '../src'
import { getCheqdModules } from './setupCheqdModule'
import { validService } from './testUtils'

// Writes to a real network and spends real fees, so it only runs when asked:
//   RUN_LIVE_WRITES=testnet|mainnet  CHEQD_LIVE_PAYER_MNEMONIC='<funded account>'  LIVE_WRITES_REPORT=<file>
// Use a dedicated account, never one that holds customer funds. Mainnet only creates and updates one did.
const target = process.env.RUN_LIVE_WRITES as 'testnet' | 'mainnet' | undefined
const mnemonic = process.env.CHEQD_LIVE_PAYER_MNEMONIC
const enabled = (target === 'testnet' || target === 'mainnet') && !!mnemonic
const rpcUrl = target === 'mainnet' ? 'https://rpc.cheqd.net' : 'https://rpc.cheqd.network'

const report: Record<string, unknown> = { network: target }
const record = (key: string, value: unknown) => {
  report[key] = value
  if (process.env.LIVE_WRITES_REPORT) writeFileSync(process.env.LIVE_WRITES_REPORT, JSON.stringify(report, null, 2))
}

describe.skipIf(!enabled)(`Writes to the real ${target}`, () => {
  const agent = new Agent(getAgentOptions('Live writes', {}, {}, getCheqdModules(mnemonic, rpcUrl)))
  const network = target as 'testnet' | 'mainnet'

  beforeAll(() => agent.initialize())
  afterAll(() => agent.shutdown())

  const rotateTo = async (did: string) => {
    const newKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const newKeyUrl = `${did}#key-2`
    const rotated = new DidDocumentBuilder(did)
      .addContext('https://w3id.org/security/suites/jws-2020/v1')
      .addVerificationMethod(
        getJsonWebKey2020({
          did,
          publicJwk: Kms.PublicJwk.fromPublicJwk(newKey.publicJwk),
          verificationMethodId: newKeyUrl,
        })
      )
      .addAuthentication(newKeyUrl)
      .addAssertionMethod(newKeyUrl)
      .build()
    return agent.dids.update<CheqdDidUpdateOptions>({
      did,
      didDocument: rotated,
      options: { keys: [{ didDocumentRelativeKeyId: '#key-2', kmsKeyId: newKey.keyId }] },
    })
  }

  let p256Did: string

  it('creates a did with a P-256 key and updates it', async () => {
    const created = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: { createKey: { type: { kty: 'EC', crv: 'P-256' } }, network },
    })
    expect(created.didState, JSON.stringify(created.didState)).toMatchObject({ state: 'finished' })
    p256Did = created.didState.did as string
    record('p256Did', p256Did)

    const document = created.didState.didDocument as DidDocument
    document.service = [validService(p256Did)]
    const updated = await agent.dids.update<CheqdDidUpdateOptions>({ did: p256Did, didDocument: document, options: {} })
    expect(updated.didState, JSON.stringify(updated.didState)).toMatchObject({ state: 'finished' })
  })

  describe.skipIf(target !== 'testnet')('testnet only', () => {
    it('rotates the authentication key of the did and signs a further update with the new key', async () => {
      const rotated = await rotateTo(p256Did)
      expect(rotated.didState, JSON.stringify(rotated.didState)).toMatchObject({ state: 'finished' })

      const resolved = await agent.dids.resolve(p256Did, { useLocalCreatedDidRecord: false })
      expect(resolved.didDocument?.verificationMethod?.map((method) => method.id)).toEqual([`${p256Did}#key-2`])

      const again = await agent.dids.update<CheqdDidUpdateOptions>({
        did: p256Did,
        didDocument: resolved.didDocument as DidDocument,
        options: {},
      })
      expect(again.didState).toMatchObject({ state: 'finished' })
    })

    // The way older versions wrote them: Ed25519VerificationKey2018 named by the fingerprint, the key stored under its
    // legacy key id, and a did record without key mappings
    it('updates and rotates a did created the old way', async () => {
      const { privateKey } = generateKeyPairSync('ed25519')
      const jwk = privateKey.export({ format: 'jwk' }) as Kms.KmsJwkPrivateOkp
      const publicJwk = Kms.PublicJwk.fromPublicJwk({ kty: 'OKP', crv: 'Ed25519', x: jwk.x })
      await agent.kms.importKey({ privateJwk: { ...jwk, kid: publicJwk.legacyKeyId } as Kms.KmsJwkPrivate })

      const did = `did:cheqd:testnet:${utils.uuid()}`
      const keyUrl = `${did}#${publicJwk.fingerprint}`
      const created = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        didDocument: new DidDocumentBuilder(did)
          .addController(did)
          .addAuthentication(keyUrl)
          .addVerificationMethod(getEd25519VerificationKey2018({ publicJwk, controller: did, id: keyUrl }))
          .build(),
        options: { keys: [{ didDocumentRelativeKeyId: `#${publicJwk.fingerprint}`, kmsKeyId: publicJwk.legacyKeyId }] },
      })
      expect(created.didState.state).toBe('finished')
      record('legacyDid', did)

      const repository = agent.dependencyManager.resolve(DidRepository)
      const didRecord = await repository.findCreatedDid(agent.context, did)
      if (!didRecord) throw new Error('did record not found')
      didRecord.keys = undefined
      await repository.update(agent.context, didRecord)

      const document = created.didState.didDocument as DidDocument
      document.service = [validService(did)]
      const updated = await agent.dids.update<CheqdDidUpdateOptions>({ did, didDocument: document, options: {} })
      expect(updated.didState, JSON.stringify(updated.didState)).toMatchObject({ state: 'finished' })

      const rotated = await rotateTo(did)
      expect(rotated.didState, JSON.stringify(rotated.didState)).toMatchObject({ state: 'finished' })
    })

    it('registers a schema, credential definition, revocation registry definition and status list', async () => {
      const issuerId = p256Did
      const schema = await agent.modules.anoncreds.registerSchema({
        schema: { issuerId, name: 'live-compat', version: `1.${Date.now()}`, attrNames: ['name'] },
        options: {},
      })
      expect(schema.schemaState.state, JSON.stringify(schema.schemaState)).toBe('finished')

      const credDef = await agent.modules.anoncreds.registerCredentialDefinition({
        credentialDefinition: { issuerId, tag: 'live', schemaId: `${schema.schemaState.schemaId}` },
        options: { supportRevocation: true },
      })
      expect(credDef.credentialDefinitionState.state, JSON.stringify(credDef.credentialDefinitionState)).toBe(
        'finished'
      )
      const credentialDefinitionId = credDef.credentialDefinitionState.credentialDefinitionId as string

      const revocationDefinition = await agent.modules.anoncreds.registerRevocationRegistryDefinition({
        options: {},
        revocationRegistryDefinition: { issuerId, credentialDefinitionId, maximumCredentialNumber: 100, tag: 'live' },
      })
      expect(
        revocationDefinition.revocationRegistryDefinitionState.state,
        JSON.stringify(revocationDefinition.revocationRegistryDefinitionState)
      ).toBe('finished')
      const revocationRegistryDefinitionId = revocationDefinition.revocationRegistryDefinitionState
        .revocationRegistryDefinitionId as string

      const statusList = await agent.modules.anoncreds.registerRevocationStatusList({
        options: {},
        revocationStatusList: { issuerId, revocationRegistryDefinitionId },
      })
      expect(statusList.revocationStatusListState.state, JSON.stringify(statusList.revocationStatusListState)).toBe(
        'finished'
      )
      record('anoncreds', {
        schemaId: schema.schemaState.schemaId,
        credentialDefinitionId,
        revocationRegistryDefinitionId,
      })

      // read back from the network, not from the local records
      const read = await agent.modules.anoncreds.getRevocationRegistryDefinition(revocationRegistryDefinitionId)
      expect(JsonTransformer.toJSON(read.revocationRegistryDefinition)).toMatchObject({
        credDefId: credentialDefinitionId,
      })
    })

    it('publishes a Token Status List as a linked resource and reads it back', async () => {
      const statusListUri = agent.modules.cheqdSdk.getTokenStatusListUri({ did: p256Did, name: 'live-status-list' })
      const list = await agent.tokenStatusList.createTokenStatusList<'jwt'>({
        format: 'jwt',
        alg: 'ES256',
        statusList: { statusListLength: 64, bitsPerStatus: 1 },
        statusListUri,
        signer: { method: 'did', didUrl: `${p256Did}#key-2` },
      })
      const published = await agent.modules.cheqdSdk.publishTokenStatusList(p256Did, {
        name: 'live-status-list',
        statusList: list.statusList,
      })
      record('tokenStatusList', { did: p256Did, name: 'live-status-list', resourceId: published.resourceId })

      const fetched = await agent.modules.cheqdSdk.fetchTokenStatusList(p256Did, 'live-status-list')
      expect(fetched).toMatchObject({ format: 'jwt', statusList: list.statusList, resourceId: published.resourceId })
    })
  })
})
