import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration} from '../configuration'

import { AMLRecord } from '../models/AMLRecord';
import { AdminAPIMessageTracing } from '../models/AdminAPIMessageTracing';
import { AdminMediationDeny } from '../models/AdminMediationDeny';
import { AdminModules } from '../models/AdminModules';
import { AdminStatusLiveliness } from '../models/AdminStatusLiveliness';
import { AdminStatusReadiness } from '../models/AdminStatusReadiness';
import { AttachDecorator } from '../models/AttachDecorator';
import { AttachDecoratorData } from '../models/AttachDecoratorData';
import { AttachDecoratorData1JWS } from '../models/AttachDecoratorData1JWS';
import { AttachDecoratorDataJWS } from '../models/AttachDecoratorDataJWS';
import { AttachDecoratorDataJWSHeader } from '../models/AttachDecoratorDataJWSHeader';
import { AttachmentDef } from '../models/AttachmentDef';
import { ClearPendingRevocationsRequest } from '../models/ClearPendingRevocationsRequest';
import { ConnRecord } from '../models/ConnRecord';
import { ConnectionInvitation } from '../models/ConnectionInvitation';
import { ConnectionList } from '../models/ConnectionList';
import { ConnectionMetadata } from '../models/ConnectionMetadata';
import { ConnectionMetadataSetRequest } from '../models/ConnectionMetadataSetRequest';
import { ConnectionStaticRequest } from '../models/ConnectionStaticRequest';
import { ConnectionStaticResult } from '../models/ConnectionStaticResult';
import { CreateInvitationRequest } from '../models/CreateInvitationRequest';
import { CredAttrSpec } from '../models/CredAttrSpec';
import { CredBrief } from '../models/CredBrief';
import { CredBriefList } from '../models/CredBriefList';
import { CredRevokedResult } from '../models/CredRevokedResult';
import { CredentialDefinition } from '../models/CredentialDefinition';
import { CredentialDefinitionGetResults } from '../models/CredentialDefinitionGetResults';
import { CredentialDefinitionSendRequest } from '../models/CredentialDefinitionSendRequest';
import { CredentialDefinitionSendResults } from '../models/CredentialDefinitionSendResults';
import { CredentialDefinitionsCreatedResults } from '../models/CredentialDefinitionsCreatedResults';
import { CredentialPreview } from '../models/CredentialPreview';
import { DID } from '../models/DID';
import { DIDEndpoint } from '../models/DIDEndpoint';
import { DIDEndpointWithType } from '../models/DIDEndpointWithType';
import { DIDList } from '../models/DIDList';
import { DIDResult } from '../models/DIDResult';
import { DIDXRequest } from '../models/DIDXRequest';
import { EndpointsResult } from '../models/EndpointsResult';
import { IndyCredInfo } from '../models/IndyCredInfo';
import { IndyCredPrecis } from '../models/IndyCredPrecis';
import { IndyProofReqAttrSpec } from '../models/IndyProofReqAttrSpec';
import { IndyProofReqNonRevoked } from '../models/IndyProofReqNonRevoked';
import { IndyProofReqPredSpec } from '../models/IndyProofReqPredSpec';
import { IndyProofReqPredSpecRestrictions } from '../models/IndyProofReqPredSpecRestrictions';
import { IndyProofRequest } from '../models/IndyProofRequest';
import { IndyRequestedCredsRequestedAttr } from '../models/IndyRequestedCredsRequestedAttr';
import { IndyRequestedCredsRequestedPred } from '../models/IndyRequestedCredsRequestedPred';
import { InvitationCreateRequest } from '../models/InvitationCreateRequest';
import { InvitationReceiveRequest } from '../models/InvitationReceiveRequest';
import { InvitationRecord } from '../models/InvitationRecord';
import { InvitationResult } from '../models/InvitationResult';
import { Keylist } from '../models/Keylist';
import { KeylistQuery } from '../models/KeylistQuery';
import { KeylistQueryFilterRequest } from '../models/KeylistQueryFilterRequest';
import { KeylistQueryPaginate } from '../models/KeylistQueryPaginate';
import { KeylistUpdate } from '../models/KeylistUpdate';
import { KeylistUpdateRequest } from '../models/KeylistUpdateRequest';
import { KeylistUpdateRule } from '../models/KeylistUpdateRule';
import { MediationCreateRequest } from '../models/MediationCreateRequest';
import { MediationDeny } from '../models/MediationDeny';
import { MediationGrant } from '../models/MediationGrant';
import { MediationList } from '../models/MediationList';
import { MediationRecord } from '../models/MediationRecord';
import { MenuForm } from '../models/MenuForm';
import { MenuFormParam } from '../models/MenuFormParam';
import { MenuJson } from '../models/MenuJson';
import { MenuOption } from '../models/MenuOption';
import { PerformRequest } from '../models/PerformRequest';
import { PingRequest } from '../models/PingRequest';
import { PingRequestResponse } from '../models/PingRequestResponse';
import { PresAttrSpec } from '../models/PresAttrSpec';
import { PresPredSpec } from '../models/PresPredSpec';
import { PresentationPreview } from '../models/PresentationPreview';
import { PublishRevocations } from '../models/PublishRevocations';
import { QueryResult } from '../models/QueryResult';
import { ReceiveInvitationRequest } from '../models/ReceiveInvitationRequest';
import { RevRegCreateRequest } from '../models/RevRegCreateRequest';
import { RevRegIssuedResult } from '../models/RevRegIssuedResult';
import { RevRegUpdateTailsFileUri } from '../models/RevRegUpdateTailsFileUri';
import { RevRegsCreated } from '../models/RevRegsCreated';
import { RevokeRequest } from '../models/RevokeRequest';
import { RouteRecord } from '../models/RouteRecord';
import { Schema } from '../models/Schema';
import { SchemaGetResults } from '../models/SchemaGetResults';
import { SchemaSendRequest } from '../models/SchemaSendRequest';
import { SchemaSendResults } from '../models/SchemaSendResults';
import { SchemasCreatedResults } from '../models/SchemasCreatedResults';
import { SendMenu } from '../models/SendMenu';
import { SendMessage } from '../models/SendMessage';
import { Service } from '../models/Service';
import { TAAAccept } from '../models/TAAAccept';
import { TAAAcceptance } from '../models/TAAAcceptance';
import { TAAInfo } from '../models/TAAInfo';
import { TAARecord } from '../models/TAARecord';
import { TAAResult } from '../models/TAAResult';
import { V10CredentialCreate } from '../models/V10CredentialCreate';
import { V10CredentialExchange } from '../models/V10CredentialExchange';
import { V10CredentialExchangeListResult } from '../models/V10CredentialExchangeListResult';
import { V10CredentialIssueRequest } from '../models/V10CredentialIssueRequest';
import { V10CredentialOfferRequest } from '../models/V10CredentialOfferRequest';
import { V10CredentialProblemReportRequest } from '../models/V10CredentialProblemReportRequest';
import { V10CredentialProposalRequestMand } from '../models/V10CredentialProposalRequestMand';
import { V10CredentialProposalRequestOpt } from '../models/V10CredentialProposalRequestOpt';
import { V10CredentialStoreRequest } from '../models/V10CredentialStoreRequest';
import { V10PresentationCreateRequestRequest } from '../models/V10PresentationCreateRequestRequest';
import { V10PresentationExchange } from '../models/V10PresentationExchange';
import { V10PresentationExchangeList } from '../models/V10PresentationExchangeList';
import { V10PresentationProblemReportRequest } from '../models/V10PresentationProblemReportRequest';
import { V10PresentationProposalRequest } from '../models/V10PresentationProposalRequest';
import { V10PresentationRequest } from '../models/V10PresentationRequest';
import { V10PresentationSendRequestRequest } from '../models/V10PresentationSendRequestRequest';
import { V20CredAttrSpec } from '../models/V20CredAttrSpec';
import { V20CredCreate } from '../models/V20CredCreate';
import { V20CredExRecord } from '../models/V20CredExRecord';
import { V20CredExRecordDIF } from '../models/V20CredExRecordDIF';
import { V20CredExRecordDetail } from '../models/V20CredExRecordDetail';
import { V20CredExRecordIndy } from '../models/V20CredExRecordIndy';
import { V20CredExRecordListResult } from '../models/V20CredExRecordListResult';
import { V20CredFilter } from '../models/V20CredFilter';
import { V20CredFilterDIF } from '../models/V20CredFilterDIF';
import { V20CredFilterIndy } from '../models/V20CredFilterIndy';
import { V20CredIssueProblemReportRequest } from '../models/V20CredIssueProblemReportRequest';
import { V20CredIssueRequest } from '../models/V20CredIssueRequest';
import { V20CredOfferRequest } from '../models/V20CredOfferRequest';
import { V20CredPreview } from '../models/V20CredPreview';
import { V20CredProposalRequestPreviewMand } from '../models/V20CredProposalRequestPreviewMand';
import { V20CredProposalRequestPreviewOpt } from '../models/V20CredProposalRequestPreviewOpt';
import { V20CredStoreRequest } from '../models/V20CredStoreRequest';
import { ObservableActionMenuApi } from './ObservableAPI';

import { ActionMenuApiRequestFactory, ActionMenuApiResponseProcessor} from "../apis/ActionMenuApi";
export class PromiseActionMenuApi {
    private api: ObservableActionMenuApi

    public constructor(
        configuration: Configuration,
        requestFactory?: ActionMenuApiRequestFactory,
        responseProcessor?: ActionMenuApiResponseProcessor
    ) {
        this.api = new ObservableActionMenuApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Close the active menu associated with a connection
     * @param connId Connection identifier
     */
    public actionMenuConnIdClosePost(connId: string, options?: Configuration): Promise<any> {
        const result = this.api.actionMenuConnIdClosePost(connId, options);
        return result.toPromise();
    }

    /**
     * Fetch the active menu
     * @param connId Connection identifier
     */
    public actionMenuConnIdFetchPost(connId: string, options?: Configuration): Promise<any> {
        const result = this.api.actionMenuConnIdFetchPost(connId, options);
        return result.toPromise();
    }

    /**
     * Perform an action associated with the active menu
     * @param connId Connection identifier
     * @param body 
     */
    public actionMenuConnIdPerformPost(connId: string, body?: PerformRequest, options?: Configuration): Promise<any> {
        const result = this.api.actionMenuConnIdPerformPost(connId, body, options);
        return result.toPromise();
    }

    /**
     * Request the active menu
     * @param connId Connection identifier
     */
    public actionMenuConnIdRequestPost(connId: string, options?: Configuration): Promise<any> {
        const result = this.api.actionMenuConnIdRequestPost(connId, options);
        return result.toPromise();
    }

    /**
     * Send an action menu to a connection
     * @param connId Connection identifier
     * @param body 
     */
    public actionMenuConnIdSendMenuPost(connId: string, body?: SendMenu, options?: Configuration): Promise<any> {
        const result = this.api.actionMenuConnIdSendMenuPost(connId, body, options);
        return result.toPromise();
    }


}



import { ObservableBasicmessageApi } from './ObservableAPI';

import { BasicmessageApiRequestFactory, BasicmessageApiResponseProcessor} from "../apis/BasicmessageApi";
export class PromiseBasicmessageApi {
    private api: ObservableBasicmessageApi

    public constructor(
        configuration: Configuration,
        requestFactory?: BasicmessageApiRequestFactory,
        responseProcessor?: BasicmessageApiResponseProcessor
    ) {
        this.api = new ObservableBasicmessageApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Send a basic message to a connection
     * @param connId Connection identifier
     * @param body 
     */
    public connectionsConnIdSendMessagePost(connId: string, body?: SendMessage, options?: Configuration): Promise<any> {
        const result = this.api.connectionsConnIdSendMessagePost(connId, body, options);
        return result.toPromise();
    }


}



import { ObservableConnectionApi } from './ObservableAPI';

import { ConnectionApiRequestFactory, ConnectionApiResponseProcessor} from "../apis/ConnectionApi";
export class PromiseConnectionApi {
    private api: ObservableConnectionApi

    public constructor(
        configuration: Configuration,
        requestFactory?: ConnectionApiRequestFactory,
        responseProcessor?: ConnectionApiResponseProcessor
    ) {
        this.api = new ObservableConnectionApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Accept a stored connection invitation
     * @param connId Connection identifier
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection
     */
    public connectionsConnIdAcceptInvitationPost(connId: string, mediationId?: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Promise<ConnRecord> {
        const result = this.api.connectionsConnIdAcceptInvitationPost(connId, mediationId, myEndpoint, myLabel, options);
        return result.toPromise();
    }

    /**
     * Accept a stored connection request
     * @param connId Connection identifier
     * @param myEndpoint My URL endpoint
     */
    public connectionsConnIdAcceptRequestPost(connId: string, myEndpoint?: string, options?: Configuration): Promise<ConnRecord> {
        const result = this.api.connectionsConnIdAcceptRequestPost(connId, myEndpoint, options);
        return result.toPromise();
    }

    /**
     * Fetch connection remote endpoint
     * @param connId Connection identifier
     */
    public connectionsConnIdEndpointsGet(connId: string, options?: Configuration): Promise<EndpointsResult> {
        const result = this.api.connectionsConnIdEndpointsGet(connId, options);
        return result.toPromise();
    }

    /**
     * Assign another connection as the inbound connection
     * @param connId Connection identifier
     * @param refId Inbound connection identifier
     */
    public connectionsConnIdEstablishInboundRefIdPost(connId: string, refId: string, options?: Configuration): Promise<any> {
        const result = this.api.connectionsConnIdEstablishInboundRefIdPost(connId, refId, options);
        return result.toPromise();
    }

    /**
     * Create a new connection invitation
     * @param alias Alias
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param multiUse Create invitation for multiple use (default false)
     * @param _public Create invitation from public DID (default false)
     * @param body 
     */
    public createInvitation(alias?: string, autoAccept?: string, multiUse?: boolean, _public?: boolean, body?: CreateInvitationRequest, options?: Configuration): Promise<InvitationResult> {
        const result = this.api.createInvitation(alias, autoAccept, multiUse, _public, body, options);
        return result.toPromise();
    }

    /**
     * Create a new static connection
     * @param body 
     */
    public createStatic(body?: ConnectionStaticRequest, options?: Configuration): Promise<ConnectionStaticResult> {
        const result = this.api.createStatic(body, options);
        return result.toPromise();
    }

    /**
     * Remove an existing connection record
     * @param connId Connection identifier
     */
    public deleteConnection(connId: string, options?: Configuration): Promise<any> {
        const result = this.api.deleteConnection(connId, options);
        return result.toPromise();
    }

    /**
     * Fetch a single connection record
     * @param connId Connection identifier
     */
    public getConnection(connId: string, options?: Configuration): Promise<ConnRecord> {
        const result = this.api.getConnection(connId, options);
        return result.toPromise();
    }

    /**
     * Query agent-to-agent connections
     * @param alias Alias
     * @param invitationKey invitation key
     * @param myDid My DID
     * @param state Connection state
     * @param theirDid Their DID
     * @param theirRole Their role in the connection protocol
     */
    public getConnections(alias?: string, invitationKey?: string, myDid?: string, state?: 'start' | 'error' | 'response' | 'init' | 'abandoned' | 'active' | 'request' | 'invitation' | 'completed', theirDid?: string, theirRole?: 'invitee' | 'requester' | 'inviter' | 'responder', options?: Configuration): Promise<ConnectionList> {
        const result = this.api.getConnections(alias, invitationKey, myDid, state, theirDid, theirRole, options);
        return result.toPromise();
    }

    /**
     * Fetch connection metadata
     * @param connId Connection identifier
     * @param key Key to retrieve.
     */
    public getMetadata(connId: string, key?: string, options?: Configuration): Promise<ConnectionMetadata> {
        const result = this.api.getMetadata(connId, key, options);
        return result.toPromise();
    }

    /**
     * Receive a new connection invitation
     * @param alias Alias
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param body 
     */
    public receiveInvitation(alias?: string, autoAccept?: string, mediationId?: string, body?: ReceiveInvitationRequest, options?: Configuration): Promise<ConnRecord> {
        const result = this.api.receiveInvitation(alias, autoAccept, mediationId, body, options);
        return result.toPromise();
    }

    /**
     * Set connection metadata
     * @param connId Connection identifier
     * @param body 
     */
    public setMetadata(connId: string, body?: ConnectionMetadataSetRequest, options?: Configuration): Promise<ConnectionMetadata> {
        const result = this.api.setMetadata(connId, body, options);
        return result.toPromise();
    }


}



import { ObservableCredentialDefinitionApi } from './ObservableAPI';

import { CredentialDefinitionApiRequestFactory, CredentialDefinitionApiResponseProcessor} from "../apis/CredentialDefinitionApi";
export class PromiseCredentialDefinitionApi {
    private api: ObservableCredentialDefinitionApi

    public constructor(
        configuration: Configuration,
        requestFactory?: CredentialDefinitionApiRequestFactory,
        responseProcessor?: CredentialDefinitionApiResponseProcessor
    ) {
        this.api = new ObservableCredentialDefinitionApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Search for matching credential definitions that agent originated
     * @param credDefId Credential definition id
     * @param issuerDid Issuer DID
     * @param schemaId Schema identifier
     * @param schemaIssuerDid Schema issuer DID
     * @param schemaName Schema name
     * @param schemaVersion Schema version
     */
    public credentialDefinitionsCreatedGet(credDefId?: string, issuerDid?: string, schemaId?: string, schemaIssuerDid?: string, schemaName?: string, schemaVersion?: string, options?: Configuration): Promise<CredentialDefinitionsCreatedResults> {
        const result = this.api.credentialDefinitionsCreatedGet(credDefId, issuerDid, schemaId, schemaIssuerDid, schemaName, schemaVersion, options);
        return result.toPromise();
    }

    /**
     * Gets a credential definition from the ledger
     * @param credDefId Credential definition identifier
     */
    public credentialDefinitionsCredDefIdGet(credDefId: string, options?: Configuration): Promise<CredentialDefinitionGetResults> {
        const result = this.api.credentialDefinitionsCredDefIdGet(credDefId, options);
        return result.toPromise();
    }

    /**
     * Sends a credential definition to the ledger
     * @param body 
     */
    public publishCredDef(body?: CredentialDefinitionSendRequest, options?: Configuration): Promise<CredentialDefinitionSendResults> {
        const result = this.api.publishCredDef(body, options);
        return result.toPromise();
    }


}



import { ObservableCredentialsApi } from './ObservableAPI';

import { CredentialsApiRequestFactory, CredentialsApiResponseProcessor} from "../apis/CredentialsApi";
export class PromiseCredentialsApi {
    private api: ObservableCredentialsApi

    public constructor(
        configuration: Configuration,
        requestFactory?: CredentialsApiRequestFactory,
        responseProcessor?: CredentialsApiResponseProcessor
    ) {
        this.api = new ObservableCredentialsApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Remove a credential from the wallet by id
     * @param credentialId Credential identifier
     */
    public credentialCredentialIdDelete(credentialId: string, options?: Configuration): Promise<any> {
        const result = this.api.credentialCredentialIdDelete(credentialId, options);
        return result.toPromise();
    }

    /**
     * Fetch a credential from wallet by id
     * @param credentialId Credential identifier
     */
    public credentialCredentialIdGet(credentialId: string, options?: Configuration): Promise<CredBrief> {
        const result = this.api.credentialCredentialIdGet(credentialId, options);
        return result.toPromise();
    }

    /**
     * Get attribute MIME types from wallet
     * @param credentialId Credential identifier
     */
    public credentialMimeTypesCredentialIdGet(credentialId: string, options?: Configuration): Promise<any> {
        const result = this.api.credentialMimeTypesCredentialIdGet(credentialId, options);
        return result.toPromise();
    }

    /**
     * Query credential revocation status by id
     * @param credentialId Credential identifier
     * @param from Earliest epoch of revocation status interval of interest
     * @param to Latest epoch of revocation status interval of interest
     */
    public credentialRevokedCredentialIdGet(credentialId: string, from?: string, to?: string, options?: Configuration): Promise<CredRevokedResult> {
        const result = this.api.credentialRevokedCredentialIdGet(credentialId, from, to, options);
        return result.toPromise();
    }

    /**
     * Fetch credentials from wallet
     * @param count Maximum number to retrieve
     * @param start Start index
     * @param wql (JSON) WQL query
     */
    public credentialsGet(count?: string, start?: string, wql?: string, options?: Configuration): Promise<CredBriefList> {
        const result = this.api.credentialsGet(count, start, wql, options);
        return result.toPromise();
    }


}



import { ObservableDidExchangeApi } from './ObservableAPI';

import { DidExchangeApiRequestFactory, DidExchangeApiResponseProcessor} from "../apis/DidExchangeApi";
export class PromiseDidExchangeApi {
    private api: ObservableDidExchangeApi

    public constructor(
        configuration: Configuration,
        requestFactory?: DidExchangeApiRequestFactory,
        responseProcessor?: DidExchangeApiResponseProcessor
    ) {
        this.api = new ObservableDidExchangeApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Accept a stored connection invitation
     * @param connId Connection identifier
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection request
     */
    public didexchangeConnIdAcceptInvitationPost(connId: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Promise<ConnRecord> {
        const result = this.api.didexchangeConnIdAcceptInvitationPost(connId, myEndpoint, myLabel, options);
        return result.toPromise();
    }

    /**
     * Accept a stored connection request
     * @param connId Connection identifier
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     */
    public didexchangeConnIdAcceptRequestPost(connId: string, mediationId?: string, myEndpoint?: string, options?: Configuration): Promise<ConnRecord> {
        const result = this.api.didexchangeConnIdAcceptRequestPost(connId, mediationId, myEndpoint, options);
        return result.toPromise();
    }

    /**
     * Create request against public DID's implicit invitation
     * @param theirPublicDid Public DID to which to request connection
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection request
     */
    public didexchangeCreateRequestPost(theirPublicDid: string, mediationId?: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Promise<DIDXRequest> {
        const result = this.api.didexchangeCreateRequestPost(theirPublicDid, mediationId, myEndpoint, myLabel, options);
        return result.toPromise();
    }

    /**
     * Receive request against public DID's implicit invitation
     * @param alias Alias for connection
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param body 
     */
    public didexchangeReceiveRequestPost(alias?: string, autoAccept?: string, mediationId?: string, myEndpoint?: string, body?: DIDXRequest, options?: Configuration): Promise<ConnRecord> {
        const result = this.api.didexchangeReceiveRequestPost(alias, autoAccept, mediationId, myEndpoint, body, options);
        return result.toPromise();
    }


}



import { ObservableIntroductionApi } from './ObservableAPI';

import { IntroductionApiRequestFactory, IntroductionApiResponseProcessor} from "../apis/IntroductionApi";
export class PromiseIntroductionApi {
    private api: ObservableIntroductionApi

    public constructor(
        configuration: Configuration,
        requestFactory?: IntroductionApiRequestFactory,
        responseProcessor?: IntroductionApiResponseProcessor
    ) {
        this.api = new ObservableIntroductionApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Start an introduction between two connections
     * @param connId Connection identifier
     * @param targetConnectionId Target connection identifier
     * @param message Message
     */
    public connectionsConnIdStartIntroductionPost(connId: string, targetConnectionId: string, message?: string, options?: Configuration): Promise<any> {
        const result = this.api.connectionsConnIdStartIntroductionPost(connId, targetConnectionId, message, options);
        return result.toPromise();
    }


}



import { ObservableIssueCredentialV10Api } from './ObservableAPI';

import { IssueCredentialV10ApiRequestFactory, IssueCredentialV10ApiResponseProcessor} from "../apis/IssueCredentialV10Api";
export class PromiseIssueCredentialV10Api {
    private api: ObservableIssueCredentialV10Api

    public constructor(
        configuration: Configuration,
        requestFactory?: IssueCredentialV10ApiRequestFactory,
        responseProcessor?: IssueCredentialV10ApiResponseProcessor
    ) {
        this.api = new ObservableIssueCredentialV10Api(configuration, requestFactory, responseProcessor);
    }

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public issueCredentialAutomated(body?: V10CredentialProposalRequestMand, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialAutomated(body, options);
        return result.toPromise();
    }

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public issueCredentialCreatePost(body?: V10CredentialCreate, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialCreatePost(body, options);
        return result.toPromise();
    }

    /**
     * Remove an existing credential exchange record
     * @param credExId Credential exchange identifier
     */
    public issueCredentialRecordsCredExIdDelete(credExId: string, options?: Configuration): Promise<any> {
        const result = this.api.issueCredentialRecordsCredExIdDelete(credExId, options);
        return result.toPromise();
    }

    /**
     * Fetch a single credential exchange record
     * @param credExId Credential exchange identifier
     */
    public issueCredentialRecordsCredExIdGet(credExId: string, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialRecordsCredExIdGet(credExId, options);
        return result.toPromise();
    }

    /**
     * Send holder a credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredentialRecordsCredExIdIssuePost(credExId: string, body?: V10CredentialIssueRequest, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialRecordsCredExIdIssuePost(credExId, body, options);
        return result.toPromise();
    }

    /**
     * Send a problem report for credential exchange
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredentialRecordsCredExIdProblemReportPost(credExId: string, body?: V10CredentialProblemReportRequest, options?: Configuration): Promise<any> {
        const result = this.api.issueCredentialRecordsCredExIdProblemReportPost(credExId, body, options);
        return result.toPromise();
    }

    /**
     * Send holder a credential offer in reference to a proposal with preview
     * @param credExId Credential exchange identifier
     */
    public issueCredentialRecordsCredExIdSendOfferPost(credExId: string, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialRecordsCredExIdSendOfferPost(credExId, options);
        return result.toPromise();
    }

    /**
     * Send issuer a credential request
     * @param credExId Credential exchange identifier
     */
    public issueCredentialRecordsCredExIdSendRequestPost(credExId: string, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialRecordsCredExIdSendRequestPost(credExId, options);
        return result.toPromise();
    }

    /**
     * Store a received credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredentialRecordsCredExIdStorePost(credExId: string, body?: V10CredentialStoreRequest, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialRecordsCredExIdStorePost(credExId, body, options);
        return result.toPromise();
    }

    /**
     * Fetch all credential exchange records
     * @param connectionId Connection identifier
     * @param role Role assigned in credential exchange
     * @param state Credential exchange state
     * @param threadId Thread identifier
     */
    public issueCredentialRecordsGet(connectionId?: string, role?: 'issuer' | 'holder', state?: 'proposal_sent' | 'proposal_received' | 'offer_sent' | 'offer_received' | 'request_sent' | 'request_received' | 'credential_issued' | 'credential_received' | 'credential_acked', threadId?: string, options?: Configuration): Promise<V10CredentialExchangeListResult> {
        const result = this.api.issueCredentialRecordsGet(connectionId, role, state, threadId, options);
        return result.toPromise();
    }

    /**
     * Send holder a credential offer, independent of any proposal
     * @param body 
     */
    public issueCredentialSendOfferPost(body?: V10CredentialOfferRequest, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialSendOfferPost(body, options);
        return result.toPromise();
    }

    /**
     * Send issuer a credential proposal
     * @param body 
     */
    public issueCredentialSendProposalPost(body?: V10CredentialProposalRequestOpt, options?: Configuration): Promise<V10CredentialExchange> {
        const result = this.api.issueCredentialSendProposalPost(body, options);
        return result.toPromise();
    }


}



import { ObservableIssueCredentialV20Api } from './ObservableAPI';

import { IssueCredentialV20ApiRequestFactory, IssueCredentialV20ApiResponseProcessor} from "../apis/IssueCredentialV20Api";
export class PromiseIssueCredentialV20Api {
    private api: ObservableIssueCredentialV20Api

    public constructor(
        configuration: Configuration,
        requestFactory?: IssueCredentialV20ApiRequestFactory,
        responseProcessor?: IssueCredentialV20ApiResponseProcessor
    ) {
        this.api = new ObservableIssueCredentialV20Api(configuration, requestFactory, responseProcessor);
    }

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public issueCredential20CreatePost(body?: V20CredCreate, options?: Configuration): Promise<V20CredExRecord> {
        const result = this.api.issueCredential20CreatePost(body, options);
        return result.toPromise();
    }

    /**
     * Remove an existing credential exchange record
     * @param credExId Credential exchange identifier
     */
    public issueCredential20RecordsCredExIdDelete(credExId: string, options?: Configuration): Promise<any> {
        const result = this.api.issueCredential20RecordsCredExIdDelete(credExId, options);
        return result.toPromise();
    }

    /**
     * Fetch a single credential exchange record
     * @param credExId Credential exchange identifier
     */
    public issueCredential20RecordsCredExIdGet(credExId: string, options?: Configuration): Promise<V20CredExRecordDetail> {
        const result = this.api.issueCredential20RecordsCredExIdGet(credExId, options);
        return result.toPromise();
    }

    /**
     * Send holder a credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredential20RecordsCredExIdIssuePost(credExId: string, body?: V20CredIssueRequest, options?: Configuration): Promise<V20CredExRecordDetail> {
        const result = this.api.issueCredential20RecordsCredExIdIssuePost(credExId, body, options);
        return result.toPromise();
    }

    /**
     * Send a problem report for credential exchange
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredential20RecordsCredExIdProblemReportPost(credExId: string, body?: V20CredIssueProblemReportRequest, options?: Configuration): Promise<any> {
        const result = this.api.issueCredential20RecordsCredExIdProblemReportPost(credExId, body, options);
        return result.toPromise();
    }

    /**
     * Send holder a credential offer in reference to a proposal with preview
     * @param credExId Credential exchange identifier
     */
    public issueCredential20RecordsCredExIdSendOfferPost(credExId: string, options?: Configuration): Promise<V20CredExRecord> {
        const result = this.api.issueCredential20RecordsCredExIdSendOfferPost(credExId, options);
        return result.toPromise();
    }

    /**
     * Send issuer a credential request
     * @param credExId Credential exchange identifier
     */
    public issueCredential20RecordsCredExIdSendRequestPost(credExId: string, options?: Configuration): Promise<V20CredExRecord> {
        const result = this.api.issueCredential20RecordsCredExIdSendRequestPost(credExId, options);
        return result.toPromise();
    }

    /**
     * Store a received credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredential20RecordsCredExIdStorePost(credExId: string, body?: V20CredStoreRequest, options?: Configuration): Promise<V20CredExRecordDetail> {
        const result = this.api.issueCredential20RecordsCredExIdStorePost(credExId, body, options);
        return result.toPromise();
    }

    /**
     * Fetch all credential exchange records
     * @param connectionId Connection identifier
     * @param role Role assigned in credential exchange
     * @param state Credential exchange state
     * @param threadId Thread identifier
     */
    public issueCredential20RecordsGet(connectionId?: string, role?: 'issuer' | 'holder', state?: 'proposal-sent' | 'proposal-received' | 'offer-sent' | 'offer-received' | 'request-sent' | 'request-received' | 'credential-issued' | 'credential-received' | 'done', threadId?: string, options?: Configuration): Promise<V20CredExRecordListResult> {
        const result = this.api.issueCredential20RecordsGet(connectionId, role, state, threadId, options);
        return result.toPromise();
    }

    /**
     * Send holder a credential offer, independent of any proposal
     * @param body 
     */
    public issueCredential20SendOfferPost(body?: V20CredOfferRequest, options?: Configuration): Promise<V20CredExRecord> {
        const result = this.api.issueCredential20SendOfferPost(body, options);
        return result.toPromise();
    }

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public issueCredential20SendPost(body?: V20CredProposalRequestPreviewMand, options?: Configuration): Promise<V20CredExRecord> {
        const result = this.api.issueCredential20SendPost(body, options);
        return result.toPromise();
    }

    /**
     * Send issuer a credential proposal
     * @param body 
     */
    public issueCredential20SendProposalPost(body?: V20CredProposalRequestPreviewOpt, options?: Configuration): Promise<V20CredExRecord> {
        const result = this.api.issueCredential20SendProposalPost(body, options);
        return result.toPromise();
    }


}



import { ObservableLedgerApi } from './ObservableAPI';

import { LedgerApiRequestFactory, LedgerApiResponseProcessor} from "../apis/LedgerApi";
export class PromiseLedgerApi {
    private api: ObservableLedgerApi

    public constructor(
        configuration: Configuration,
        requestFactory?: LedgerApiRequestFactory,
        responseProcessor?: LedgerApiResponseProcessor
    ) {
        this.api = new ObservableLedgerApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Accept the transaction author agreement
     * @param body 
     */
    public acceptTaa(body?: TAAAccept, options?: Configuration): Promise<any> {
        const result = this.api.acceptTaa(body, options);
        return result.toPromise();
    }

    /**
     * Fetch the current transaction author agreement, if any
     */
    public fetchTaa(options?: Configuration): Promise<TAAResult> {
        const result = this.api.fetchTaa(options);
        return result.toPromise();
    }

    /**
     * Get the endpoint for a DID from the ledger.
     * @param did DID of interest
     * @param endpointType Endpoint type of interest (default &#39;Endpoint&#39;)
     */
    public ledgerDidEndpointGet(did: string, endpointType?: 'Endpoint' | 'Profile' | 'LinkedDomains', options?: Configuration): Promise<any> {
        const result = this.api.ledgerDidEndpointGet(did, endpointType, options);
        return result.toPromise();
    }

    /**
     * Get the verkey for a DID from the ledger.
     * @param did DID of interest
     */
    public ledgerDidVerkeyGet(did: string, options?: Configuration): Promise<any> {
        const result = this.api.ledgerDidVerkeyGet(did, options);
        return result.toPromise();
    }

    /**
     * Get the role from the NYM registration of a public DID.
     * @param did DID of interest
     */
    public ledgerGetNymRoleGet(did: string, options?: Configuration): Promise<any> {
        const result = this.api.ledgerGetNymRoleGet(did, options);
        return result.toPromise();
    }

    /**
     * Send a NYM registration to the ledger.
     * @param did DID to register
     * @param verkey Verification key
     * @param alias Alias
     * @param role Role
     */
    public ledgerRegisterNymPost(did: string, verkey: string, alias?: string, role?: 'STEWARD' | 'TRUSTEE' | 'ENDORSER' | 'NETWORK_MONITOR' | 'reset', options?: Configuration): Promise<any> {
        const result = this.api.ledgerRegisterNymPost(did, verkey, alias, role, options);
        return result.toPromise();
    }

    /**
     * Rotate key pair for public DID.
     */
    public ledgerRotatePublicDidKeypairPatch(options?: Configuration): Promise<any> {
        const result = this.api.ledgerRotatePublicDidKeypairPatch(options);
        return result.toPromise();
    }


}



import { ObservableMediationApi } from './ObservableAPI';

import { MediationApiRequestFactory, MediationApiResponseProcessor} from "../apis/MediationApi";
export class PromiseMediationApi {
    private api: ObservableMediationApi

    public constructor(
        configuration: Configuration,
        requestFactory?: MediationApiRequestFactory,
        responseProcessor?: MediationApiResponseProcessor
    ) {
        this.api = new ObservableMediationApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Clear default mediator
     */
    public mediationDefaultMediatorDelete(options?: Configuration): Promise<MediationRecord> {
        const result = this.api.mediationDefaultMediatorDelete(options);
        return result.toPromise();
    }

    /**
     * Get default mediator
     */
    public mediationDefaultMediatorGet(options?: Configuration): Promise<MediationRecord> {
        const result = this.api.mediationDefaultMediatorGet(options);
        return result.toPromise();
    }

    /**
     * Retrieve keylists by connection or role
     * @param connId Connection identifier (optional)
     * @param role Filer on role, &#39;client&#39; for keys         mediated by other agents, &#39;server&#39; for keys         mediated by this agent
     */
    public mediationKeylistsGet(connId?: string, role?: 'client' | 'server', options?: Configuration): Promise<Keylist> {
        const result = this.api.mediationKeylistsGet(connId, role, options);
        return result.toPromise();
    }

    /**
     * Send keylist query to mediator
     * @param mediationId Mediation record identifier
     * @param paginateLimit limit number of results
     * @param paginateOffset offset to use in pagination
     * @param body 
     */
    public mediationKeylistsMediationIdSendKeylistQueryPost(mediationId: string, paginateLimit?: number, paginateOffset?: number, body?: KeylistQueryFilterRequest, options?: Configuration): Promise<KeylistQuery> {
        const result = this.api.mediationKeylistsMediationIdSendKeylistQueryPost(mediationId, paginateLimit, paginateOffset, body, options);
        return result.toPromise();
    }

    /**
     * Send keylist update to mediator
     * @param mediationId Mediation record identifier
     * @param body 
     */
    public mediationKeylistsMediationIdSendKeylistUpdatePost(mediationId: string, body?: KeylistUpdateRequest, options?: Configuration): Promise<KeylistUpdate> {
        const result = this.api.mediationKeylistsMediationIdSendKeylistUpdatePost(mediationId, body, options);
        return result.toPromise();
    }

    /**
     * Set default mediator
     * @param mediationId Mediation record identifier
     */
    public mediationMediationIdDefaultMediatorPut(mediationId: string, options?: Configuration): Promise<MediationRecord> {
        const result = this.api.mediationMediationIdDefaultMediatorPut(mediationId, options);
        return result.toPromise();
    }

    /**
     * Request mediation from connection
     * @param connId Connection identifier
     * @param body 
     */
    public mediationRequestConnIdPost(connId: string, body?: MediationCreateRequest, options?: Configuration): Promise<MediationRecord> {
        const result = this.api.mediationRequestConnIdPost(connId, body, options);
        return result.toPromise();
    }

    /**
     * Query mediation requests, returns list of all mediation records
     * @param connId Connection identifier (optional)
     * @param mediatorTerms List of mediator rules for recipient
     * @param recipientTerms List of recipient rules for mediation
     * @param state Mediation state (optional)
     */
    public mediationRequestsGet(connId?: string, mediatorTerms?: Array<string>, recipientTerms?: Array<string>, state?: 'request' | 'granted' | 'denied', options?: Configuration): Promise<MediationList> {
        const result = this.api.mediationRequestsGet(connId, mediatorTerms, recipientTerms, state, options);
        return result.toPromise();
    }

    /**
     * Delete mediation request by ID
     * @param mediationId Mediation record identifier
     */
    public mediationRequestsMediationIdDelete(mediationId: string, options?: Configuration): Promise<MediationRecord> {
        const result = this.api.mediationRequestsMediationIdDelete(mediationId, options);
        return result.toPromise();
    }

    /**
     * Deny a stored mediation request
     * @param mediationId Mediation record identifier
     * @param body 
     */
    public mediationRequestsMediationIdDenyPost(mediationId: string, body?: AdminMediationDeny, options?: Configuration): Promise<MediationDeny> {
        const result = this.api.mediationRequestsMediationIdDenyPost(mediationId, body, options);
        return result.toPromise();
    }

    /**
     * Retrieve mediation request record
     * @param mediationId Mediation record identifier
     */
    public mediationRequestsMediationIdGet(mediationId: string, options?: Configuration): Promise<MediationRecord> {
        const result = this.api.mediationRequestsMediationIdGet(mediationId, options);
        return result.toPromise();
    }

    /**
     * Grant received mediation
     * @param mediationId Mediation record identifier
     */
    public mediationRequestsMediationIdGrantPost(mediationId: string, options?: Configuration): Promise<MediationGrant> {
        const result = this.api.mediationRequestsMediationIdGrantPost(mediationId, options);
        return result.toPromise();
    }


}



import { ObservableOutOfBandApi } from './ObservableAPI';

import { OutOfBandApiRequestFactory, OutOfBandApiResponseProcessor} from "../apis/OutOfBandApi";
export class PromiseOutOfBandApi {
    private api: ObservableOutOfBandApi

    public constructor(
        configuration: Configuration,
        requestFactory?: OutOfBandApiRequestFactory,
        responseProcessor?: OutOfBandApiResponseProcessor
    ) {
        this.api = new ObservableOutOfBandApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Create a new connection invitation
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param multiUse Create invitation for multiple use (default false)
     * @param body 
     */
    public outOfBandCreateInvitationPost(autoAccept?: string, multiUse?: boolean, body?: InvitationCreateRequest, options?: Configuration): Promise<InvitationRecord> {
        const result = this.api.outOfBandCreateInvitationPost(autoAccept, multiUse, body, options);
        return result.toPromise();
    }

    /**
     * Receive a new connection invitation
     * @param alias Alias for connection
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param useExistingConnection Use an existing connection, if possible
     * @param body 
     */
    public outOfBandReceiveInvitationPost(alias?: string, autoAccept?: string, mediationId?: string, useExistingConnection?: boolean, body?: InvitationReceiveRequest, options?: Configuration): Promise<ConnRecord> {
        const result = this.api.outOfBandReceiveInvitationPost(alias, autoAccept, mediationId, useExistingConnection, body, options);
        return result.toPromise();
    }


}



import { ObservablePresentProofApi } from './ObservableAPI';

import { PresentProofApiRequestFactory, PresentProofApiResponseProcessor} from "../apis/PresentProofApi";
export class PromisePresentProofApi {
    private api: ObservablePresentProofApi

    public constructor(
        configuration: Configuration,
        requestFactory?: PresentProofApiRequestFactory,
        responseProcessor?: PresentProofApiResponseProcessor
    ) {
        this.api = new ObservablePresentProofApi(configuration, requestFactory, responseProcessor);
    }

    /**
     *      Creates a presentation request not bound to any proposal or existing connection     
     * @param body 
     */
    public presentProofCreateRequestPost(body?: V10PresentationCreateRequestRequest, options?: Configuration): Promise<V10PresentationExchange> {
        const result = this.api.presentProofCreateRequestPost(body, options);
        return result.toPromise();
    }

    /**
     * Fetch all present-proof exchange records
     * @param connectionId Connection identifier
     * @param role Role assigned in presentation exchange
     * @param state Presentation exchange state
     * @param threadId Thread identifier
     */
    public presentProofRecordsGet(connectionId?: string, role?: 'prover' | 'verifier', state?: 'proposal_sent' | 'proposal_received' | 'request_sent' | 'request_received' | 'presentation_sent' | 'presentation_received' | 'verified' | 'presentation_acked', threadId?: string, options?: Configuration): Promise<V10PresentationExchangeList> {
        const result = this.api.presentProofRecordsGet(connectionId, role, state, threadId, options);
        return result.toPromise();
    }

    /**
     * Fetch credentials for a presentation request from wallet
     * @param presExId Presentation exchange identifier
     * @param count Maximum number to retrieve
     * @param extraQuery (JSON) object mapping referents to extra WQL queries
     * @param referent Proof request referents of interest, comma-separated
     * @param start Start index
     */
    public presentProofRecordsPresExIdCredentialsGet(presExId: string, count?: string, extraQuery?: string, referent?: string, start?: string, options?: Configuration): Promise<Array<IndyCredPrecis>> {
        const result = this.api.presentProofRecordsPresExIdCredentialsGet(presExId, count, extraQuery, referent, start, options);
        return result.toPromise();
    }

    /**
     * Remove an existing presentation exchange record
     * @param presExId Presentation exchange identifier
     */
    public presentProofRecordsPresExIdDelete(presExId: string, options?: Configuration): Promise<any> {
        const result = this.api.presentProofRecordsPresExIdDelete(presExId, options);
        return result.toPromise();
    }

    /**
     * Fetch a single presentation exchange record
     * @param presExId Presentation exchange identifier
     */
    public presentProofRecordsPresExIdGet(presExId: string, options?: Configuration): Promise<V10PresentationExchange> {
        const result = this.api.presentProofRecordsPresExIdGet(presExId, options);
        return result.toPromise();
    }

    /**
     * Send a problem report for presentation exchange
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public presentProofRecordsPresExIdProblemReportPost(presExId: string, body?: V10PresentationProblemReportRequest, options?: Configuration): Promise<any> {
        const result = this.api.presentProofRecordsPresExIdProblemReportPost(presExId, body, options);
        return result.toPromise();
    }

    /**
     * Sends a proof presentation
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public presentProofRecordsPresExIdSendPresentationPost(presExId: string, body?: V10PresentationRequest, options?: Configuration): Promise<V10PresentationExchange> {
        const result = this.api.presentProofRecordsPresExIdSendPresentationPost(presExId, body, options);
        return result.toPromise();
    }

    /**
     * Sends a presentation request in reference to a proposal
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public presentProofRecordsPresExIdSendRequestPost(presExId: string, body?: AdminAPIMessageTracing, options?: Configuration): Promise<V10PresentationExchange> {
        const result = this.api.presentProofRecordsPresExIdSendRequestPost(presExId, body, options);
        return result.toPromise();
    }

    /**
     * Verify a received presentation
     * @param presExId Presentation exchange identifier
     */
    public presentProofRecordsPresExIdVerifyPresentationPost(presExId: string, options?: Configuration): Promise<V10PresentationExchange> {
        const result = this.api.presentProofRecordsPresExIdVerifyPresentationPost(presExId, options);
        return result.toPromise();
    }

    /**
     * Sends a presentation proposal
     * @param body 
     */
    public presentProofSendProposalPost(body?: V10PresentationProposalRequest, options?: Configuration): Promise<V10PresentationExchange> {
        const result = this.api.presentProofSendProposalPost(body, options);
        return result.toPromise();
    }

    /**
     * Sends a free presentation request not bound to any proposal
     * @param body 
     */
    public sendProofRequest(body?: V10PresentationSendRequestRequest, options?: Configuration): Promise<V10PresentationExchange> {
        const result = this.api.sendProofRequest(body, options);
        return result.toPromise();
    }


}



import { ObservableRevocationApi } from './ObservableAPI';

import { RevocationApiRequestFactory, RevocationApiResponseProcessor} from "../apis/RevocationApi";
export class PromiseRevocationApi {
    private api: ObservableRevocationApi

    public constructor(
        configuration: Configuration,
        requestFactory?: RevocationApiRequestFactory,
        responseProcessor?: RevocationApiResponseProcessor
    ) {
        this.api = new ObservableRevocationApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Publish pending revocations to ledger
     * @param body 
     */
    public publishRevocations(body?: PublishRevocations, options?: Configuration): Promise<PublishRevocations> {
        const result = this.api.publishRevocations(body, options);
        return result.toPromise();
    }

    /**
     * Get current active revocation registry by credential definition id
     * @param credDefId Credential definition identifier
     */
    public revocationActiveRegistryCredDefIdGet(credDefId: string, options?: Configuration): Promise<any> {
        const result = this.api.revocationActiveRegistryCredDefIdGet(credDefId, options);
        return result.toPromise();
    }

    /**
     * Clear pending revocations
     * @param body 
     */
    public revocationClearPendingRevocationsPost(body?: ClearPendingRevocationsRequest, options?: Configuration): Promise<PublishRevocations> {
        const result = this.api.revocationClearPendingRevocationsPost(body, options);
        return result.toPromise();
    }

    /**
     * Creates a new revocation registry
     * @param body 
     */
    public revocationCreateRegistryPost(body?: RevRegCreateRequest, options?: Configuration): Promise<any> {
        const result = this.api.revocationCreateRegistryPost(body, options);
        return result.toPromise();
    }

    /**
     * Get credential revocation status
     * @param credExId Credential exchange identifier
     * @param credRevId Credential revocation identifier
     * @param revRegId Revocation registry identifier
     */
    public revocationCredentialRecordGet(credExId?: string, credRevId?: string, revRegId?: string, options?: Configuration): Promise<any> {
        const result = this.api.revocationCredentialRecordGet(credExId, credRevId, revRegId, options);
        return result.toPromise();
    }

    /**
     * Search for matching revocation registries that current agent created
     * @param credDefId Credential definition identifier
     * @param state Revocation registry state
     */
    public revocationRegistriesCreatedGet(credDefId?: string, state?: 'init' | 'generated' | 'posted' | 'active' | 'full', options?: Configuration): Promise<RevRegsCreated> {
        const result = this.api.revocationRegistriesCreatedGet(credDefId, state, options);
        return result.toPromise();
    }

    /**
     * Send revocation registry definition to ledger
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdDefinitionPost(revRegId: string, options?: Configuration): Promise<any> {
        const result = this.api.revocationRegistryRevRegIdDefinitionPost(revRegId, options);
        return result.toPromise();
    }

    /**
     * Send revocation registry entry to ledger
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdEntryPost(revRegId: string, options?: Configuration): Promise<any> {
        const result = this.api.revocationRegistryRevRegIdEntryPost(revRegId, options);
        return result.toPromise();
    }

    /**
     * Get revocation registry by revocation registry id
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdGet(revRegId: string, options?: Configuration): Promise<any> {
        const result = this.api.revocationRegistryRevRegIdGet(revRegId, options);
        return result.toPromise();
    }

    /**
     * Get number of credentials issued against revocation registry
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdIssuedGet(revRegId: string, options?: Configuration): Promise<RevRegIssuedResult> {
        const result = this.api.revocationRegistryRevRegIdIssuedGet(revRegId, options);
        return result.toPromise();
    }

    /**
     * Update revocation registry with new public URI to its tails file
     * @param revRegId Revocation Registry identifier
     * @param body 
     */
    public revocationRegistryRevRegIdPatch(revRegId: string, body?: RevRegUpdateTailsFileUri, options?: Configuration): Promise<any> {
        const result = this.api.revocationRegistryRevRegIdPatch(revRegId, body, options);
        return result.toPromise();
    }

    /**
     * Set revocation registry state manually
     * @param revRegId Revocation Registry identifier
     * @param state Revocation registry state to set
     */
    public revocationRegistryRevRegIdSetStatePatch(revRegId: string, state: 'init' | 'generated' | 'posted' | 'active' | 'full', options?: Configuration): Promise<any> {
        const result = this.api.revocationRegistryRevRegIdSetStatePatch(revRegId, state, options);
        return result.toPromise();
    }

    /**
     * Download tails file
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdTailsFileGet(revRegId: string, options?: Configuration): Promise<HttpFile> {
        const result = this.api.revocationRegistryRevRegIdTailsFileGet(revRegId, options);
        return result.toPromise();
    }

    /**
     * Upload local tails file to server
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdTailsFilePut(revRegId: string, options?: Configuration): Promise<any> {
        const result = this.api.revocationRegistryRevRegIdTailsFilePut(revRegId, options);
        return result.toPromise();
    }

    /**
     * Revoke an issued credential
     * @param body 
     */
    public revokeCredential(body?: RevokeRequest, options?: Configuration): Promise<any> {
        const result = this.api.revokeCredential(body, options);
        return result.toPromise();
    }


}



import { ObservableSchemaApi } from './ObservableAPI';

import { SchemaApiRequestFactory, SchemaApiResponseProcessor} from "../apis/SchemaApi";
export class PromiseSchemaApi {
    private api: ObservableSchemaApi

    public constructor(
        configuration: Configuration,
        requestFactory?: SchemaApiRequestFactory,
        responseProcessor?: SchemaApiResponseProcessor
    ) {
        this.api = new ObservableSchemaApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Sends a schema to the ledger
     * @param body 
     */
    public publishSchema(body?: SchemaSendRequest, options?: Configuration): Promise<SchemaSendResults> {
        const result = this.api.publishSchema(body, options);
        return result.toPromise();
    }

    /**
     * Search for matching schema that agent originated
     * @param schemaId Schema identifier
     * @param schemaIssuerDid Schema issuer DID
     * @param schemaName Schema name
     * @param schemaVersion Schema version
     */
    public schemasCreatedGet(schemaId?: string, schemaIssuerDid?: string, schemaName?: string, schemaVersion?: string, options?: Configuration): Promise<SchemasCreatedResults> {
        const result = this.api.schemasCreatedGet(schemaId, schemaIssuerDid, schemaName, schemaVersion, options);
        return result.toPromise();
    }

    /**
     * Gets a schema from the ledger
     * @param schemaId Schema identifier
     */
    public schemasSchemaIdGet(schemaId: string, options?: Configuration): Promise<SchemaGetResults> {
        const result = this.api.schemasSchemaIdGet(schemaId, options);
        return result.toPromise();
    }


}



import { ObservableServerApi } from './ObservableAPI';

import { ServerApiRequestFactory, ServerApiResponseProcessor} from "../apis/ServerApi";
export class PromiseServerApi {
    private api: ObservableServerApi

    public constructor(
        configuration: Configuration,
        requestFactory?: ServerApiRequestFactory,
        responseProcessor?: ServerApiResponseProcessor
    ) {
        this.api = new ObservableServerApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Query supported features
     * @param query Query
     */
    public featuresGet(query?: string, options?: Configuration): Promise<QueryResult> {
        const result = this.api.featuresGet(query, options);
        return result.toPromise();
    }

    /**
     * Fetch the list of loaded plugins
     */
    public pluginsGet(options?: Configuration): Promise<AdminModules> {
        const result = this.api.pluginsGet(options);
        return result.toPromise();
    }

    /**
     * Shut down server
     */
    public shutdownGet(options?: Configuration): Promise<any> {
        const result = this.api.shutdownGet(options);
        return result.toPromise();
    }

    /**
     * Fetch the server status
     */
    public statusGet(options?: Configuration): Promise<any> {
        const result = this.api.statusGet(options);
        return result.toPromise();
    }

    /**
     * Liveliness check
     */
    public statusLiveGet(options?: Configuration): Promise<AdminStatusLiveliness> {
        const result = this.api.statusLiveGet(options);
        return result.toPromise();
    }

    /**
     * Readiness check
     */
    public statusReadyGet(options?: Configuration): Promise<AdminStatusReadiness> {
        const result = this.api.statusReadyGet(options);
        return result.toPromise();
    }

    /**
     * Reset statistics
     */
    public statusResetPost(options?: Configuration): Promise<any> {
        const result = this.api.statusResetPost(options);
        return result.toPromise();
    }


}



import { ObservableTrustpingApi } from './ObservableAPI';

import { TrustpingApiRequestFactory, TrustpingApiResponseProcessor} from "../apis/TrustpingApi";
export class PromiseTrustpingApi {
    private api: ObservableTrustpingApi

    public constructor(
        configuration: Configuration,
        requestFactory?: TrustpingApiRequestFactory,
        responseProcessor?: TrustpingApiResponseProcessor
    ) {
        this.api = new ObservableTrustpingApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Send a trust ping to a connection
     * @param connId Connection identifier
     * @param body 
     */
    public connectionsConnIdSendPingPost(connId: string, body?: PingRequest, options?: Configuration): Promise<PingRequestResponse> {
        const result = this.api.connectionsConnIdSendPingPost(connId, body, options);
        return result.toPromise();
    }


}



import { ObservableWalletApi } from './ObservableAPI';

import { WalletApiRequestFactory, WalletApiResponseProcessor} from "../apis/WalletApi";
export class PromiseWalletApi {
    private api: ObservableWalletApi

    public constructor(
        configuration: Configuration,
        requestFactory?: WalletApiRequestFactory,
        responseProcessor?: WalletApiResponseProcessor
    ) {
        this.api = new ObservableWalletApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Create a local DID
     */
    public createDid(options?: Configuration): Promise<DIDResult> {
        const result = this.api.createDid(options);
        return result.toPromise();
    }

    /**
     * Assign the current public DID
     * @param did DID of interest
     */
    public setPublicDid(did: string, options?: Configuration): Promise<DIDResult> {
        const result = this.api.setPublicDid(did, options);
        return result.toPromise();
    }

    /**
     * List wallet DIDs
     * @param did DID of interest
     * @param posture Whether DID is current public DID, posted to ledger but current public DID, or local to the wallet
     * @param verkey Verification key of interest
     */
    public walletDidGet(did?: string, posture?: 'public' | 'posted' | 'wallet_only', verkey?: string, options?: Configuration): Promise<DIDList> {
        const result = this.api.walletDidGet(did, posture, verkey, options);
        return result.toPromise();
    }

    /**
     * Rotate keypair for a DID not posted to the ledger
     * @param did DID of interest
     */
    public walletDidLocalRotateKeypairPatch(did: string, options?: Configuration): Promise<any> {
        const result = this.api.walletDidLocalRotateKeypairPatch(did, options);
        return result.toPromise();
    }

    /**
     * Fetch the current public DID
     */
    public walletDidPublicGet(options?: Configuration): Promise<DIDResult> {
        const result = this.api.walletDidPublicGet(options);
        return result.toPromise();
    }

    /**
     * Query DID endpoint in wallet
     * @param did DID of interest
     */
    public walletGetDidEndpointGet(did: string, options?: Configuration): Promise<DIDEndpoint> {
        const result = this.api.walletGetDidEndpointGet(did, options);
        return result.toPromise();
    }

    /**
     * Update endpoint in wallet and on ledger if posted to it
     * @param body 
     */
    public walletSetDidEndpointPost(body?: DIDEndpointWithType, options?: Configuration): Promise<any> {
        const result = this.api.walletSetDidEndpointPost(body, options);
        return result.toPromise();
    }


}



