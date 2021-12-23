
import { CredentialRecordType, CredentialExchangeRecord, CredentialRecordBinding } from './v2/CredentialExchangeRecord'
import { CredentialState } from './CredentialState'
import { CredentialProtocolVersion } from './CredentialProtocolVersion'
import { ProposeCredentialOptions } from './v2/interfaces'
import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { V1LegacyCredentialService } from './v1/V1LegacyCredentialService'
import { CredentialService } from './CredentialService'
import { ConnectionService } from '../connections/services/ConnectionService'
import { MessageSender } from '../../agent/MessageSender'
import { Lifecycle, scoped } from 'tsyringe'
import { CredentialsModule } from './CredentialsModule'
import { MediationRecipientService } from '../routing'
import { CredentialResponseCoordinator } from './CredentialResponseCoordinator'
import { CredentialRole } from './v2/CredentialRole'
import { V1CredentialService } from './v1/V1CredentialService'
import { V2CredentialService } from './v2/V2CredentialService'
import { unitTestLogger, LogLevel } from '../../logger'
import { createOutboundMessage } from '../../agent/helpers'
import { CredentialRepository } from './repository'
import { EventEmitter } from '../../agent/EventEmitter'
import { V2ProposeCredentialHandler } from './v2/handlers/V2ProposeCredentialHandler'
import { AutoAcceptCredential } from '.'



export interface CredentialsAPI {

    proposeCredential(credentialOptions: ProposeCredentialOptions): Promise<CredentialExchangeRecord>

    acceptCredentialProposal(
        credentialRecordId: string,
        config?: {
          comment?: string
          credentialDefinitionId?: string
          autoAcceptCredential?: AutoAcceptCredential
        }
      ) : void
    // acceptProposal(credentialOptions: AcceptProposalOptions): Promise<CredentialExchangeRecord>
    // negotiateProposal(credentialOptions: NegotiateProposalOptions): Promise<CredentialExchangeRecord>

    // // Offer
    // offerCredential(credentialOptions: OfferCredentialOptions): Promise<CredentialExchangeRecord>
    // acceptOffer(credentialOptions: AcceptOfferOptions): Promise<CredentialExchangeRecord>
    // declineOffer(credentialRecordId: string): Promise<CredentialExchangeRecord>
    // negotiateOffer(credentialOptions: NegotiateOfferOptions): Promise<CredentialExchangeRecord>

    // // Request
    // requestCredential(credentialOptions: RequestCredentialOptions): Promise<CredentialExchangeRecord>
    // acceptRequest(credentialOptions: AcceptRequestOptions): Promise<CredentialExchangeRecord>

    // // Credential
    // acceptCredential(credentialRecordId: string): Promise<CredentialExchangeRecord>

    // // Record Methods
    // getAll(): Promise<CredentialExchangeRecord[]>
    // getById(credentialRecordId: string): Promise<CredentialExchangeRecord>
    // findById(credentialRecordId: string): Promise<CredentialExchangeRecord | null>
    // deleteById(credentialRecordId: string): Promise<void>
    // findByQuery(query: Record<string, Tag | string[]>): Promise<CredentialExchangeRecord[]>

}

type Tag = string | boolean | number

@scoped(Lifecycle.ContainerScoped)
export class CredentialsAPI extends CredentialsModule implements CredentialsAPI {
    private connService: ConnectionService
    private msgSender: MessageSender
    private v1CredentialService: V1LegacyCredentialService
    private credentialRepository: CredentialRepository
    private eventEmitter: EventEmitter
    private dispatcher: Dispatcher
    private agConfig: AgentConfig
    private credentialResponseCoord: CredentialResponseCoordinator
    private v1Service: V1CredentialService
    private v2Service: V2CredentialService
    private serviceMap: { "1.0": V1CredentialService; "2.0": V2CredentialService }

    // note some of the parameters passed in here are temporary, as we intend 
    // to eventually remove CredentialsModule
    public constructor(
        dispatcher: Dispatcher,
        messageSender: MessageSender,
        connectionService: ConnectionService,
        agentConfig: AgentConfig,
        credentialResponseCoordinator: CredentialResponseCoordinator,
        mediationRecipientService: MediationRecipientService,
        v1CredentialService: V1LegacyCredentialService,
        credentialRepository: CredentialRepository,
        eventEmitter: EventEmitter,
    ) {
        super(
            dispatcher,
            connectionService,
            v1CredentialService,
            messageSender,
            agentConfig,
            credentialResponseCoordinator,
            mediationRecipientService)
        this.msgSender = messageSender
        this.v1CredentialService = v1CredentialService
        this.connService = connectionService
        this.credentialRepository = credentialRepository
        this.eventEmitter = eventEmitter
        this.dispatcher = dispatcher
        this.agConfig = agentConfig
        this.credentialResponseCoord = credentialResponseCoordinator
        this.v1Service = new V1CredentialService(this.connService,
            this.v1CredentialService,
            this.credentialRepository,
            this.eventEmitter,
            this.msgSender)
        this.v2Service = new V2CredentialService(this.connService,
            this.v1CredentialService,
            this.credentialRepository,
            this.eventEmitter,
            this.msgSender,
            this.dispatcher,
            this.agConfig,
            this.credentialResponseCoord)
        

        this.serviceMap = {
            [CredentialProtocolVersion.V1_0]: this.v1Service,
            [CredentialProtocolVersion.V2_0]: this.v2Service,
        }
        console.log("+++++++++++++++++++++ IN CREDENTIALS API +++++++++++++++++++++++++++")

        // register handlers here
        // this.v1Service.registerHandlers() // MJR - TODO
        this.v2Service.registerHandlers()
    }

    public getService(protocolVersion: CredentialProtocolVersion) {
        return this.serviceMap[protocolVersion]
    }

    /**
     * Initiate a new credential exchange as holder by sending a credential proposal message
     * to the connection with the specified credential options
     *
     * @param credentialOptions configuration to use for the proposal
     * @returns Credential exchange record associated with the sent proposal message
    */


    public async proposeCredential(credentialOptions: ProposeCredentialOptions): Promise<CredentialExchangeRecord> {

        unitTestLogger("In new Credential API...")

        // get the version
        const version: CredentialProtocolVersion = credentialOptions.protocolVersion

        unitTestLogger(`version =${version}`)


        // with version we can get the Service
        const service: CredentialService = this.getService(version)

        unitTestLogger("Got a CredentialService object for this version")

        const connection = await this.connService.getById(credentialOptions.connectionId)

        // will get back a credential record -> map to Credential Exchange Record
        const { credentialRecord, message } = await service.createProposal(credentialOptions)

        unitTestLogger("We have a message (sending outbound): ", message)

        // send the message here
        const outbound = createOutboundMessage(connection, message)

        unitTestLogger("Send Proposal to Issuer")
        await this.msgSender.sendMessage(outbound)


        const recordBinding: CredentialRecordBinding = {
            credentialRecordType: credentialOptions.credentialFormats.indy ? CredentialRecordType.INDY : CredentialRecordType.W3C,
            credentialRecordId: credentialRecord.id
        }

        const bindings: CredentialRecordBinding[] = []
        bindings.push(recordBinding)


        const credentialExchangeRecord: CredentialExchangeRecord = {
            ...credentialRecord,
            protocolVersion: version,
            state: CredentialState.ProposalSent,
            role: CredentialRole.Holder,
            credentials: bindings,

        }

        return credentialExchangeRecord
    }

    public async acceptCredentialProposal(
        credentialRecordId: string,
        config?: {
          comment?: string
          credentialDefinitionId?: string
          autoAcceptCredential?: AutoAcceptCredential
        }
      ) {
          console.log("TEST-DEBUG accepting the proposal HERE...!")
      }
}