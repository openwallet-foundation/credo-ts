import type { ConnectionRecord } from '@aries-framework/core'
import type { CredDef, Schema } from 'indy-sdk-react-native'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import { CredentialPreview, ProofAttributeInfo, AttributeFilter } from '@aries-framework/core'
import { uuid } from '@aries-framework/core/build/utils/uuid'
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
      throw Error(redText(Output.missingConnectionRecord))
    }
    return await this.agent.connections.getById(this.connectionRecordAliceId)
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    return await this.agent.connections.receiveInvitationFromUrl(invitationUrl)
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(greenText(Output.connectionEstablished))
    return connectionRecord.id
  }

  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    if (connectionRecord === undefined) {
      return
    }
    this.connectionRecordAliceId = await this.waitForConnection(connectionRecord)
  }

  private printSchema(name: string, version: string, attributes: string[]) {
    console.log(`\n\nThe credential definition will look like this:\n`)
    console.log(purpleText(`Name: ${Color.reset}${name}`))
    console.log(purpleText(`Version: ${Color.reset}${version}`))
    console.log(purpleText(`Attributes: ${Color.reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`))
  }

  private async registerSchema() {
    const schemaTemplate = {
      name: 'Faber College' + uuid(),
      version: '1.0.0',
      attributes: ['name', 'degree', 'date'],
    }
    this.printSchema(schemaTemplate.name, schemaTemplate.version, schemaTemplate.attributes)
    this.ui.updateBottomBar(greenText('\nRegistering schema...\n', false))
    const schema = await this.agent.ledger.registerSchema(schemaTemplate)
    this.ui.updateBottomBar('\nSchema registerd!\n')
    return schema
  }

  private async registerCredentialDefiniton(schema: Schema) {
    this.ui.updateBottomBar('\nRegistering credential defenition...\n')
    this.credentialDefinition = await this.agent.ledger.registerCredentialDefinition({
      schema,
      tag: 'latest',
      supportRevocation: false,
    })
    this.ui.updateBottomBar('\nCredential definition registerd!!\n')
    return this.credentialDefinition
  }

  private getCredentialPreview() {
    const credentialPreview = CredentialPreview.fromRecord({
      name: 'Alice Smith',
      degree: 'Computer Science',
      date: '01/01/2022',
    })
    return credentialPreview
  }

  public async issueCredential() {
    const schema = await this.registerSchema()
    const credDef = await this.registerCredentialDefiniton(schema)
    const credentialPreview = this.getCredentialPreview()
    const connectionRecord = await this.getConnectionRecord()

    this.ui.updateBottomBar('\nSending credential offer...\n')
    await this.agent.credentials.offerCredential(connectionRecord.id, {
      credentialDefinitionId: credDef.id,
      preview: credentialPreview,
    })
    this.ui.updateBottomBar(
      `\nCredential offer sent!\n\nGo to the Alice agent to accept the credential offer\n\n${Color.reset}`
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
      `\nProof request sent!\n\nGo to the Alice agent to accept the proof request\n\n${Color.reset}`
    )
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }

  public async exit() {
    console.log(Output.exit)
    await this.agent.shutdown()
    process.exit()
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
