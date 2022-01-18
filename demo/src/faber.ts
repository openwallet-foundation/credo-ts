import { ConnectionInvitationMessage, CredentialEventTypes, CredentialPreview, CredentialState, CredentialStateChangedEvent, JsonTransformer } from '@aries-framework/core';
import { CredDef, Schema } from 'indy-sdk-react-native';
import { BaseAgent } from './base_agent';
import { JsonEncoder } from '@aries-framework/core/src/utils/JsonEncoder';
import { Color, Output } from './output_class';
import { uuid } from '@aries-framework/core/build/utils/uuid';
import { runFaber } from './faber_inquirer';
import { ProofAttributeInfo } from '@aries-framework/core';
import { AttributeFilter } from '@aries-framework/core';

export class Faber extends BaseAgent {
  connectionRecordAliceId?: string
  credentialDefinition?: CredDef

  constructor(port: number, name: string) {
    super(port, name)
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
    } catch(e){
      console.log(`${Color.green}\nIt looks like your invitation link is not correctly formatted?\n${Color.reset}`)
      return
    }

    const invitationMessage = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)
    return await this.agent.connections.receiveInvitation(invitationMessage)
  }
  
  private async waitForConnection(connectionRecord: any) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(`${Color.green}${Output.connectionEstablished}${Color.reset}`)
    return connectionRecord.id
  }

  async acceptConnection(invitation_url: string) {
    let connectionRecord = await this.receiveConnectionRequest(invitation_url)
    if (connectionRecord === undefined) {
      return
    }
    this.connectionRecordAliceId = await this.waitForConnection(connectionRecord)
  }

  private async registerSchema(){
    const schema = await this.agent.ledger.registerSchema({
      name: 'koninklijke luchtvaart maatschappij' + uuid(),
      version: '1.0.6',
      attributes: ['departure date', 'returning date', 'actually happening']
    })
    return schema
  }

  private async registerCredentialDefiniton(schema: Schema) {
    this.credentialDefinition = await this.agent.ledger.registerCredentialDefinition({
      schema,
      tag: 'latest',
      supportRevocation: false,
    })
    return this.credentialDefinition
  }

  private getCredentialPreview() {
    const credentialPreview = CredentialPreview.fromRecord({
      'departure date':  '05/01/2022',
      'returning date': '01/02/2022',
      'actually happening': 'yes'
    })
    return credentialPreview
  }

  async issueCredential() {
    const schema = await this.registerSchema()
    const credentialDefinition = await this.registerCredentialDefiniton(schema)
    const credentialPreview = this.getCredentialPreview()
    const connectionRecord = await this.getConnectionRecord()

    await this.agent.credentials.offerCredential(connectionRecord.id, {
      credentialDefinitionId: credentialDefinition.id, 
      preview: credentialPreview,
    })
    console.log(`${Color.green}\nCredential offer send!\n${Color.reset}`)
  }

  async newProofAttribute() {
    return {
      name: new ProofAttributeInfo({
        name: 'actually happening',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: this.credentialDefinition?.id,
          }),
        ],
      }),
    }
  }

  async sendProofRequest() {
    const connectionRecord = await this.getConnectionRecord()
    const proofAttribute = await this.newProofAttribute()
    await this.agent.proofs.requestProof(connectionRecord.id, {
      requestedAttributes: proofAttribute,
    })
    console.log(`${Color.green}\Proof request send!\n${Color.reset}`)
  }

  async sendMessage (message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }

  async exit() {
    console.log("Exiting...")
    await this.agent.shutdown()
    process.exit()
  }

  async restart() {
    await this.agent.shutdown()
    runFaber()
  }
}