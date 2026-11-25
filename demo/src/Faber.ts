import { CREDENTIALS_CONTEXT_V1_URL, deepEquality, type KeyDidCreateOptions, utils } from '@credo-ts/core'
import type {
  DidCommConnectionRecord,
  DidCommConnectionStateChangedEvent,
  DidCommCredentialExchangeRecord,
} from '@credo-ts/didcomm'
import { DidCommConnectionEventTypes } from '@credo-ts/didcomm'
import { BaseAgent } from './BaseAgent'
import { Color, greenText, Output, purpleText, redText, writeOutput } from './OutputClass'

export class Faber extends BaseAgent {
  public outOfBandId?: string
  public issuerDid?: string

  public constructor(port: number, name: string) {
    super({ port, name })
  }

  public static async build(): Promise<Faber> {
    const faber = new Faber(9001, 'faber')
    await faber.initializeAgent()
    return faber
  }

  // The did:key is kept in Faber's wallet, so it is reused across runs.
  private async getIssuerDid() {
    if (this.issuerDid) return this.issuerDid

    const [createdDid] = await this.agent.dids.getCreatedDids({ method: 'key' })
    if (createdDid) {
      this.issuerDid = createdDid.did
      return this.issuerDid
    }

    const { didState } = await this.agent.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' } } },
    })
    if (didState.state !== 'finished') {
      throw new Error(redText(`Error creating issuer did:key: ${didState.state === 'failed' ? didState.reason : ''}`))
    }

    this.issuerDid = didState.did
    return this.issuerDid
  }

  private async getConnectionRecord() {
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    const [connection] = await this.agent.didcomm.connections.findAllByOutOfBandId(this.outOfBandId)

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    return connection
  }

  private async printConnectionInvite() {
    const outOfBand = await this.agent.didcomm.oob.createInvitation()
    this.outOfBandId = outOfBand.id

    console.log(
      Output.ConnectionLink,
      outOfBand.outOfBandInvitation.toUrl({
        domain: `http://localhost:${this.port}`,
      }),
      '\n'
    )
  }

  private async waitForConnection() {
    if (!this.outOfBandId) {
      throw new Error(redText(Output.MissingConnectionRecord))
    }

    console.log('Waiting for Alice to finish connection...')

    const getConnectionRecord = (outOfBandId: string) =>
      new Promise<DidCommConnectionRecord>((resolve, reject) => {
        // Timeout of 20 seconds
        const timeoutId = setTimeout(() => {
          clearInterval(pollId)
          reject(new Error(redText(Output.MissingConnectionRecord)))
        }, 20000)

        const tryResolve = (connectionRecord: DidCommConnectionRecord) => {
          clearTimeout(timeoutId)
          clearInterval(pollId)
          resolve(connectionRecord)
        }

        // Listen for connection state changed event (e.g. v1 handshake)
        this.agent.events.on<DidCommConnectionStateChangedEvent>(
          DidCommConnectionEventTypes.DidCommConnectionStateChanged,
          (e) => {
            if (e.payload.connectionRecord.outOfBandId !== outOfBandId) return
            tryResolve(e.payload.connectionRecord)
          }
        )

        // Poll for connection (v2 OOB: connection is created when first message arrives)
        const pollId = setInterval(async () => {
          const [connectionRecord] = await this.agent.didcomm.connections.findAllByOutOfBandId(outOfBandId)
          if (connectionRecord?.id) tryResolve(connectionRecord)
        }, 1000)
      })

    const connectionRecord = await getConnectionRecord(this.outOfBandId)

    try {
      await this.agent.didcomm.connections.returnWhenIsConnected(connectionRecord.id)
    } catch (_e) {
      console.log(redText('\nTimeout of 20 seconds reached.. Returning to home screen.\n'))
      return
    }
    console.log(greenText(Output.ConnectionEstablished))
  }

  public async setupConnection() {
    await this.printConnectionInvite()
    await this.waitForConnection()
  }

  public async issueCredential() {
    const issuerDid = await this.getIssuerDid()
    const connectionRecord = await this.getConnectionRecord()

    // Alice adds her own DID as the subject id when she accepts the offer.
    const credential = {
      '@context': [CREDENTIALS_CONTEXT_V1_URL, 'http://schema.org/'],
      type: ['VerifiableCredential'],
      issuer: issuerDid,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        name: 'Alice Smith',
        hasCredential: {
          type: 'EducationalOccupationalCredential',
          credentialCategory: 'degree',
          name: 'Computer Science',
          dateCreated: '2022-01-01',
        },
      },
    }

    console.log(purpleText(`\nIssuer: ${Color.Reset}${issuerDid}`))
    writeOutput('\nSending credential offer...\n')

    await this.agent.didcomm.credentials.offerCredential({
      connectionId: connectionRecord.id,
      protocolVersion: 'v2',
      credentialFormats: {
        jsonld: {
          credential,
          options: { proofType: 'Ed25519Signature2018', proofPurpose: 'assertionMethod' },
        },
      },
    })
    writeOutput(`\nCredential offer sent!\n\nGo to the Alice agent to accept the credential offer\n\n${Color.Reset}`)
  }

  // Accepts Alice's counter-proposal when the only change to the offered credential is her DID as the subject id.
  public async acceptSubjectProposal(credentialExchangeRecord: DidCommCredentialExchangeRecord) {
    const { offer, proposal } = await this.agent.didcomm.credentials.getFormatData(credentialExchangeRecord.id)
    const offered = offer?.jsonld
    const proposed = proposal?.jsonld
    const proposedSubject = proposed?.credential.credentialSubject

    const withoutSubjectId = (credential: NonNullable<typeof proposed>['credential']) => ({
      ...credential,
      credentialSubject: { ...credential.credentialSubject, id: undefined },
    })
    const onlySubjectIdChanged =
      offered &&
      proposed &&
      proposedSubject &&
      !Array.isArray(proposedSubject) &&
      typeof proposedSubject.id === 'string' &&
      proposedSubject.id.startsWith('did:') &&
      deepEquality(offered.options, proposed.options) &&
      deepEquality(withoutSubjectId(offered.credential), withoutSubjectId(proposed.credential))

    if (!onlySubjectIdChanged) {
      console.log(redText('\nRejected a credential proposal that changes more than the subject id.\n', true))
      await this.agent.didcomm.credentials.sendProblemReport({
        credentialExchangeRecordId: credentialExchangeRecord.id,
        description: 'Only the credential subject id can be changed',
      })
      return
    }

    await this.agent.didcomm.credentials.acceptProposal({ credentialExchangeRecordId: credentialExchangeRecord.id })
    console.log(purpleText(`\nIssuing the credential to ${Color.Reset}${proposedSubject.id}\n`))
  }

  public async sendProofRequest() {
    const issuerDid = await this.getIssuerDid()
    const connectionRecord = await this.getConnectionRecord()
    writeOutput(greenText('\nRequesting proof of a Faber College degree...\n', false))

    await this.agent.didcomm.proofs.requestProof({
      protocolVersion: 'v2',
      connectionId: connectionRecord.id,
      proofFormats: {
        presentationExchange: {
          presentationDefinition: {
            id: utils.uuid(),
            input_descriptors: [
              {
                id: 'faber-degree',
                name: 'Faber College degree',
                purpose: 'Prove you hold a degree issued by Faber College',
                schema: [{ uri: 'http://schema.org/' }],
                constraints: {
                  fields: [
                    { path: ['$.issuer'], filter: { type: 'string', const: issuerDid } },
                    { path: ['$.credentialSubject.hasCredential.name'] },
                  ],
                },
              },
            ],
          },
        },
      },
    })
    writeOutput(`\nProof request sent!\n\nGo to the Alice agent to accept the proof request\n\n${Color.Reset}`)
  }

  public async printVerifiedPresentation(proofExchangeRecordId: string) {
    const proofRecord = await this.agent.didcomm.proofs.getById(proofExchangeRecordId)
    if (!proofRecord.isVerified) {
      console.log(redText('\nThe presentation could not be verified.\n', true))
      return
    }

    const { presentation } = await this.agent.didcomm.proofs.getFormatData(proofExchangeRecordId)
    const verifiablePresentation = presentation?.presentationExchange
    if (!verifiablePresentation || typeof verifiablePresentation === 'string') return

    console.log(greenText('\nPresentation verified!', true))
    console.log(purpleText(`Holder: ${Color.Reset}${verifiablePresentation.holder}`))
    const credentials = [verifiablePresentation.verifiableCredential ?? []].flat()
    for (const credential of credentials) {
      if (typeof credential === 'string') continue
      const issuer = typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id
      console.log(purpleText(`Issuer: ${Color.Reset}${issuer}`))
      console.log(purpleText(`Claims: ${Color.Reset}${JSON.stringify(credential.credentialSubject, null, 2)}\n`))
    }
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.didcomm.basicMessages.sendMessage(connectionRecord.id, message)
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
