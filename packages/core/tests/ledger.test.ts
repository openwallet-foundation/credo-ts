import { promises } from 'fs'
import * as indy from 'indy-sdk'

import { Agent } from '../src/agent/Agent'
import { DID_IDENTIFIER_REGEX, isAbbreviatedVerkey, isFullVerkey, VERKEY_REGEX } from '../src/utils/did'
import { sleep } from '../src/utils/sleep'

import { genesisPath, getBaseConfig } from './helpers'
import testLogger from './logger'

const { config: faberConfig, agentDependencies: faberDependencies } = getBaseConfig('Faber Ledger')

describe('ledger', () => {
  let faberAgent: Agent
  let schemaId: indy.SchemaId

  beforeAll(async () => {
    faberAgent = new Agent(faberConfig, faberDependencies)
    await faberAgent.initialize()
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
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
        role: '0',
      })
    )
  })

  test('register public DID on ledger', async () => {
    if (!faberAgent.publicDid) {
      throw new Error('Agent does not have public did.')
    }

    const faberWallet = faberAgent.context.wallet
    const didInfo = await faberWallet.createDid()

    const result = await faberAgent.ledger.registerPublicDid(didInfo.did, didInfo.verkey, 'alias', 'TRUST_ANCHOR')

    expect(result).toEqual(didInfo.did)
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

    const schema = await faberAgent.ledger.registerSchema(schemaTemplate)
    schemaId = schema.id

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
      signatureType: 'CL' as const,
      supportRevocation: true,
    }

    const credentialDefinition = await faberAgent.ledger.registerCredentialDefinition(credentialDefinitionTemplate)

    await sleep(2000)

    const ledgerCredDef = await faberAgent.ledger.getCredentialDefinition(credentialDefinition.id)

    const credDefIdRegExp = new RegExp(`${faberAgent.publicDid.did}:3:CL:[0-9]+:TAG`)
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

  it('should correctly store the genesis file if genesis transactions is passed', async () => {
    const genesisTransactions = await promises.readFile(genesisPath, { encoding: 'utf-8' })
    const { config, agentDependencies: dependencies } = getBaseConfig('Faber Ledger Genesis Transactions', {
      indyLedgers: [
        {
          id: 'pool-Faber Ledger Genesis Transactions',
          didIndyNamespace: 'pool-Faber Ledger Genesis Transactions',
          isProduction: false,
          genesisTransactions,
        },
      ],
    })
    const agent = new Agent(config, dependencies)
    await agent.initialize()

    if (!faberAgent.publicDid?.did) {
      throw new Error('No public did')
    }

    const did = await agent.ledger.getPublicDid(faberAgent.publicDid.did)
    expect(did.did).toEqual(faberAgent.publicDid.did)
  })
})
