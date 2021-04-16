import indy from 'indy-sdk'
import type { SchemaId } from 'indy-sdk'
import { Agent, InboundTransporter } from '..'
import { DID_IDENTIFIER_REGEX, VERKEY_REGEX, isFullVerkey, isAbbreviatedVerkey } from '../utils/did'
import { genesisPath, sleep } from './helpers'
import { InitConfig } from '../types'
import testLogger from './logger'

const faberConfig: InitConfig = {
  label: 'Faber',
  walletConfig: { id: 'faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  publicDidSeed: process.env.TEST_AGENT_PUBLIC_DID_SEED,
  genesisPath,
  poolName: 'test-pool',
  indy,
  logger: testLogger,
}

describe('ledger', () => {
  let faberAgent: Agent
  let schemaId: SchemaId

  beforeAll(async () => {
    faberAgent = new Agent(faberConfig)
    await faberAgent.init()
  })

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet()
  })

  test(`initialization of agent's public DID`, async () => {
    const publicDid = faberAgent.publicDid
    testLogger.test('faberAgentPublicDid', publicDid)

    expect(publicDid).toEqual(
      expect.objectContaining({
        did: expect.stringMatching(DID_IDENTIFIER_REGEX),
        verkey: expect.stringMatching(VERKEY_REGEX),
      })
    )
  })

  test('get public DID from ledger', async () => {
    if (!faberAgent.publicDid) {
      throw new Error('Agent does not have public did.')
    }

    const result = await faberAgent.ledger.getPublicDid(faberAgent.publicDid.did)

    let { verkey } = faberAgent.publicDid
    // Agent’s public did stored locally in Indy wallet and created from public did seed during
    // its initialization always returns full verkey. Therefore we need to align that here.
    if (isFullVerkey(verkey) && isAbbreviatedVerkey(result.verkey)) {
      verkey = await indy.abbreviateVerkey(faberAgent.publicDid.did, verkey)
    }

    expect(result).toEqual(
      expect.objectContaining({
        did: faberAgent.publicDid.did,
        verkey: verkey,
        role: '101',
      })
    )
  })

  test('register schema on ledger', async () => {
    if (!faberAgent.publicDid) {
      throw new Error('Agent does not have public did.')
    }

    const schemaName = `test-schema-${Date.now()}`
    const schemaTemplate = {
      name: schemaName,
      attributes: ['name', 'age'],
      version: '1.0',
    }

    const schemaResponse = await faberAgent.ledger.registerSchema(schemaTemplate)
    schemaId = schemaResponse[0]
    const schema = schemaResponse[1]

    await sleep(2000)

    const ledgerSchema = await faberAgent.ledger.getSchema(schemaId)

    expect(schemaId).toBe(`${faberAgent.publicDid.did}:2:${schemaName}:1.0`)

    expect(ledgerSchema).toEqual(
      expect.objectContaining({
        attrNames: expect.arrayContaining(schemaTemplate.attributes),
        id: `${faberAgent.publicDid.did}:2:${schemaName}:1.0`,
        name: schemaName,
        seqNo: schema.seqNo,
        ver: schemaTemplate.version,
        version: schemaTemplate.version,
      })
    )
  })

  test('register definition on ledger', async () => {
    if (!faberAgent.publicDid) {
      throw new Error('Agent does not have public did.')
    }
    const schema = await faberAgent.ledger.getSchema(schemaId)
    const credentialDefinitionTemplate = {
      schema: schema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { supportRevocation: true },
    }

    const [credDefId] = await faberAgent.ledger.registerCredentialDefinition(credentialDefinitionTemplate)

    await sleep(2000)

    const ledgerCredDef = await faberAgent.ledger.getCredentialDefinition(credDefId)

    const credDefIdRegExp = new RegExp(`${faberAgent.publicDid.did}:3:CL:[0-9]+:TAG`)
    expect(credDefId).toEqual(expect.stringMatching(credDefIdRegExp))
    expect(ledgerCredDef).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(credDefIdRegExp),
        schemaId: String(schema.seqNo),
        type: credentialDefinitionTemplate.signatureType,
        tag: credentialDefinitionTemplate.tag,
        ver: '1.0',
        value: expect.objectContaining({
          primary: expect.anything(),
          revocation: expect.anything(),
        }),
      })
    )
  })
})
