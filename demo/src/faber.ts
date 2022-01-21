import type { ConnectionRecord } from '@aries-framework/core'
import type { CredDef, Schema } from 'indy-sdk-react-native'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import {
  ConnectionInvitationMessage,
  CredentialPreview,
  JsonTransformer,
  ProofAttributeInfo,
  AttributeFilter,
} from '@aries-framework/core'
import { uuid } from '@aries-framework/core/build/utils/uuid'
import { JsonEncoder } from '@aries-framework/core/src/utils/JsonEncoder'
import { ui } from 'inquirer'

import { BaseAgent } from './base_agent'
import { Color, Output } from './output_class'

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
      throw Error(`${Color.red}${Output.missingConnectionRecord}${Color.reset}`)
    }
    return await this.agent.connections.getById(this.connectionRecordAliceId)
  }

  private async receiveConnectionRequest(invitation_url: string) {
    const http = 'http://localhost:9000?c_i='
    let invitationJson = invitation_url.replace(http, '')

    try {
      invitationJson = JsonEncoder.fromBase64(invitationJson)
    } catch (e) {
      console.log(`${Color.green}\nIt looks like your invitation link is not correctly formatted?\n${Color.reset}`)
      return
    }

    const invitationMessage = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)
    return await this.agent.connections.receiveInvitation(invitationMessage)
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(`${Color.green}${Output.connectionEstablished}${Color.reset}`)
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
    console.log(`${Color.purlpe}Name: ${Color.reset}${name}`)
    console.log(`${Color.purlpe}Version: ${Color.reset}${version}`)
    console.log(`${Color.purlpe}Attributes: ${Color.reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`)
  }

  private async registerSchema() {
    const schemaTemplate = {
      name: 'Faber College' + uuid(),
      version: '1.0.0',
      attributes: ['name', 'degree', 'date'],
    }
    this.printSchema(schemaTemplate.name, schemaTemplate.version, schemaTemplate.attributes)
    this.ui.updateBottomBar(`${Color.green}\nRegistering schema...\n`)
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
    const credentialDefinition = await this.registerCredentialDefiniton(schema)
    const credentialPreview = this.getCredentialPreview()
    const connectionRecord = await this.getConnectionRecord()

    this.ui.updateBottomBar('\nSending credential offer...\n')
    await this.agent.credentials.offerCredential(connectionRecord.id, {
      credentialDefinitionId: credentialDefinition.id,
      preview: credentialPreview,
    })
    this.ui.updateBottomBar(`\nCredential offer send!\n${Color.reset}`)
  }

  private async printProofFlow(print: string) {
    this.ui.updateBottomBar(print)
    await new Promise((f) => setTimeout(f, 2000))
  }

  private async newProofAttribute() {
    await this.printProofFlow(`${Color.green}\nCreating new proof attribute for 'name' ...\n`)
    return {
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: this.credentialDefinition?.id,
          }),
        ],
      }),
    }
  }

  public async sendProofRequest() {
    const connectionRecord = await this.getConnectionRecord()
    const proofAttribute = await this.newProofAttribute()
    await this.printProofFlow(`${Color.green}\nRequesting proof...\n`)
    await this.agent.proofs.requestProof(connectionRecord.id, {
      requestedAttributes: proofAttribute,
    })
    this.ui.updateBottomBar(`\nProof request send!\n\n${Color.reset}`)
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
