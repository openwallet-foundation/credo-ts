/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-duplicates */
/* eslint-disable import/order */
import type { CredDef, Schema } from 'indy-sdk'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'
import type { ConnectionRecord } from '@aries-framework/core'
import { CredentialProtocolVersion } from '@aries-framework/core'

<<<<<<< HEAD
// eslint-disable-next-line import/no-unresolved
import { V1CredentialPreview, AttributeFilter, ProofAttributeInfo, utils } from '@aries-framework/core'
=======
import {
  CredentialProtocolVersion,
  V1CredentialPreview,
  AttributeFilter,
  ProofAttributeInfo,
  utils,
} from '@aries-framework/core'
>>>>>>> 1dfa32edc6029793588040de9b8b933a0615e926
import { ui } from 'inquirer'

import { BaseAgent } from './BaseAgent'
import { Color, greenText, Output, purpleText, redText } from './OutputClass'

export class Faber extends BaseAgent {
  public connectionRecordAliceId?: string
  public credentialDefinition?: CredDef
  public ui: BottomBar

  public constructor(port: number, name: string) {
    super(port, name)
    this.ui = new ui.BottomBar()
  }

  public static async build(): Promise<Faber> {
    const faber = new Faber(9001, 'faber')
    await faber.initializeAgent()
    return faber
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordAliceId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    return await this.agent.connections.getById(this.connectionRecordAliceId)
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    return await this.agent.connections.receiveInvitationFromUrl(invitationUrl)
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(greenText(Output.ConnectionEstablished))
    return connectionRecord.id
  }

  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    this.connectionRecordAliceId = await this.waitForConnection(connectionRecord)
  }

  private printSchema(name: string, version: string, attributes: string[]) {
    console.log(`\n\nThe credential definition will look like this:\n`)
    console.log(purpleText(`Name: ${Color.Reset}${name}`))
    console.log(purpleText(`Version: ${Color.Reset}${version}`))
    console.log(purpleText(`Attributes: ${Color.Reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`))
  }

  private async registerSchema() {
    const schemaTemplate = {
      name: 'Faber College' + utils.uuid(),
      version: '1.0.0',
      attributes: ['name', 'degree', 'date'],
    }
    this.printSchema(schemaTemplate.name, schemaTemplate.version, schemaTemplate.attributes)
    this.ui.updateBottomBar(greenText('\nRegistering schema...\n', false))
    const schema = await this.agent.ledger.registerSchema(schemaTemplate)
    this.ui.updateBottomBar('\nSchema registered!\n')
    return schema
  }

  private async registerCredentialDefinition(schema: Schema) {
    this.ui.updateBottomBar('\nRegistering credential definition...\n')
    this.credentialDefinition = await this.agent.ledger.registerCredentialDefinition({
      schema,
      tag: 'latest',
      supportRevocation: false,
    })
    this.ui.updateBottomBar('\nCredential definition registered!!\n')
    return this.credentialDefinition
  }

  private getCredentialPreview() {
    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'Alice Smith',
      degree: 'Computer Science',
      date: '01/01/2022',
    })
    return credentialPreview
  }

  public async issueCredential() {
    const schema = await this.registerSchema()
    const credDef = await this.registerCredentialDefinition(schema)
    const credentialPreview = this.getCredentialPreview()
    const connectionRecord = await this.getConnectionRecord()

    this.ui.updateBottomBar('\nSending credential offer...\n')

    await this.agent.credentials.offerCredential({
      connectionId: connectionRecord.id,
      protocolVersion: CredentialProtocolVersion.V1,
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDef.id,
        },
      },
    })
    this.ui.updateBottomBar(
      `\nCredential offer sent!\n\nGo to the Alice agent to accept the credential offer\n\n${Color.Reset}`
    )
  }

  private async printProofFlow(print: string) {
    this.ui.updateBottomBar(print)
    await new Promise((f) => setTimeout(f, 2000))
  }

  private async newProofAttribute() {
    await this.printProofFlow(greenText(`Creating new proof attribute for 'name' ...\n`))
    const proofAttribute = {
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: this.credentialDefinition?.id,
          }),
        ],
      }),
    }
    return proofAttribute
  }

  public async sendProofRequest() {
    const connectionRecord = await this.getConnectionRecord()
    const proofAttribute = await this.newProofAttribute()
    await this.printProofFlow(greenText('\nRequesting proof...\n', false))
    await this.agent.proofs.requestProof(connectionRecord.id, {
      requestedAttributes: proofAttribute,
    })
    this.ui.updateBottomBar(
      `\nProof request sent!\n\nGo to the Alice agent to accept the proof request\n\n${Color.Reset}`
    )
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
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
