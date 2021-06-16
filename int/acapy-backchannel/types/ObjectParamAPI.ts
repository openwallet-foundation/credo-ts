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

import { ObservableActionMenuApi } from "./ObservableAPI";
import { ActionMenuApiRequestFactory, ActionMenuApiResponseProcessor} from "../apis/ActionMenuApi";

export interface ActionMenuApiActionMenuConnIdClosePostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ActionMenuApiactionMenuConnIdClosePost
     */
    connId: string
}

export interface ActionMenuApiActionMenuConnIdFetchPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ActionMenuApiactionMenuConnIdFetchPost
     */
    connId: string
}

export interface ActionMenuApiActionMenuConnIdPerformPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ActionMenuApiactionMenuConnIdPerformPost
     */
    connId: string
    /**
     * 
     * @type PerformRequest
     * @memberof ActionMenuApiactionMenuConnIdPerformPost
     */
    body?: PerformRequest
}

export interface ActionMenuApiActionMenuConnIdRequestPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ActionMenuApiactionMenuConnIdRequestPost
     */
    connId: string
}

export interface ActionMenuApiActionMenuConnIdSendMenuPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ActionMenuApiactionMenuConnIdSendMenuPost
     */
    connId: string
    /**
     * 
     * @type SendMenu
     * @memberof ActionMenuApiactionMenuConnIdSendMenuPost
     */
    body?: SendMenu
}

export class ObjectActionMenuApi {
    private api: ObservableActionMenuApi

    public constructor(configuration: Configuration, requestFactory?: ActionMenuApiRequestFactory, responseProcessor?: ActionMenuApiResponseProcessor) {
        this.api = new ObservableActionMenuApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Close the active menu associated with a connection
     * @param param the request object
     */
    public actionMenuConnIdClosePost(param: ActionMenuApiActionMenuConnIdClosePostRequest, options?: Configuration): Promise<any> {
        return this.api.actionMenuConnIdClosePost(param.connId,  options).toPromise();
    }

    /**
     * Fetch the active menu
     * @param param the request object
     */
    public actionMenuConnIdFetchPost(param: ActionMenuApiActionMenuConnIdFetchPostRequest, options?: Configuration): Promise<any> {
        return this.api.actionMenuConnIdFetchPost(param.connId,  options).toPromise();
    }

    /**
     * Perform an action associated with the active menu
     * @param param the request object
     */
    public actionMenuConnIdPerformPost(param: ActionMenuApiActionMenuConnIdPerformPostRequest, options?: Configuration): Promise<any> {
        return this.api.actionMenuConnIdPerformPost(param.connId, param.body,  options).toPromise();
    }

    /**
     * Request the active menu
     * @param param the request object
     */
    public actionMenuConnIdRequestPost(param: ActionMenuApiActionMenuConnIdRequestPostRequest, options?: Configuration): Promise<any> {
        return this.api.actionMenuConnIdRequestPost(param.connId,  options).toPromise();
    }

    /**
     * Send an action menu to a connection
     * @param param the request object
     */
    public actionMenuConnIdSendMenuPost(param: ActionMenuApiActionMenuConnIdSendMenuPostRequest, options?: Configuration): Promise<any> {
        return this.api.actionMenuConnIdSendMenuPost(param.connId, param.body,  options).toPromise();
    }

}

import { ObservableBasicmessageApi } from "./ObservableAPI";
import { BasicmessageApiRequestFactory, BasicmessageApiResponseProcessor} from "../apis/BasicmessageApi";

export interface BasicmessageApiConnectionsConnIdSendMessagePostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof BasicmessageApiconnectionsConnIdSendMessagePost
     */
    connId: string
    /**
     * 
     * @type SendMessage
     * @memberof BasicmessageApiconnectionsConnIdSendMessagePost
     */
    body?: SendMessage
}

export class ObjectBasicmessageApi {
    private api: ObservableBasicmessageApi

    public constructor(configuration: Configuration, requestFactory?: BasicmessageApiRequestFactory, responseProcessor?: BasicmessageApiResponseProcessor) {
        this.api = new ObservableBasicmessageApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Send a basic message to a connection
     * @param param the request object
     */
    public connectionsConnIdSendMessagePost(param: BasicmessageApiConnectionsConnIdSendMessagePostRequest, options?: Configuration): Promise<any> {
        return this.api.connectionsConnIdSendMessagePost(param.connId, param.body,  options).toPromise();
    }

}

import { ObservableConnectionApi } from "./ObservableAPI";
import { ConnectionApiRequestFactory, ConnectionApiResponseProcessor} from "../apis/ConnectionApi";

export interface ConnectionApiConnectionsConnIdAcceptInvitationPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ConnectionApiconnectionsConnIdAcceptInvitationPost
     */
    connId: string
    /**
     * Identifier for active mediation record to be used
     * @type string
     * @memberof ConnectionApiconnectionsConnIdAcceptInvitationPost
     */
    mediationId?: string
    /**
     * My URL endpoint
     * @type string
     * @memberof ConnectionApiconnectionsConnIdAcceptInvitationPost
     */
    myEndpoint?: string
    /**
     * Label for connection
     * @type string
     * @memberof ConnectionApiconnectionsConnIdAcceptInvitationPost
     */
    myLabel?: string
}

export interface ConnectionApiConnectionsConnIdAcceptRequestPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ConnectionApiconnectionsConnIdAcceptRequestPost
     */
    connId: string
    /**
     * My URL endpoint
     * @type string
     * @memberof ConnectionApiconnectionsConnIdAcceptRequestPost
     */
    myEndpoint?: string
}

export interface ConnectionApiConnectionsConnIdEndpointsGetRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ConnectionApiconnectionsConnIdEndpointsGet
     */
    connId: string
}

export interface ConnectionApiConnectionsConnIdEstablishInboundRefIdPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ConnectionApiconnectionsConnIdEstablishInboundRefIdPost
     */
    connId: string
    /**
     * Inbound connection identifier
     * @type string
     * @memberof ConnectionApiconnectionsConnIdEstablishInboundRefIdPost
     */
    refId: string
}

export interface ConnectionApiCreateInvitationRequest {
    /**
     * Alias
     * @type string
     * @memberof ConnectionApicreateInvitation
     */
    alias?: string
    /**
     * Auto-accept connection (defaults to configuration)
     * @type string
     * @memberof ConnectionApicreateInvitation
     */
    autoAccept?: string
    /**
     * Create invitation for multiple use (default false)
     * @type boolean
     * @memberof ConnectionApicreateInvitation
     */
    multiUse?: boolean
    /**
     * Create invitation from public DID (default false)
     * @type boolean
     * @memberof ConnectionApicreateInvitation
     */
    _public?: boolean
    /**
     * 
     * @type CreateInvitationRequest
     * @memberof ConnectionApicreateInvitation
     */
    body?: CreateInvitationRequest
}

export interface ConnectionApiCreateStaticRequest {
    /**
     * 
     * @type ConnectionStaticRequest
     * @memberof ConnectionApicreateStatic
     */
    body?: ConnectionStaticRequest
}

export interface ConnectionApiDeleteConnectionRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ConnectionApideleteConnection
     */
    connId: string
}

export interface ConnectionApiGetConnectionRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ConnectionApigetConnection
     */
    connId: string
}

export interface ConnectionApiGetConnectionsRequest {
    /**
     * Alias
     * @type string
     * @memberof ConnectionApigetConnections
     */
    alias?: string
    /**
     * invitation key
     * @type string
     * @memberof ConnectionApigetConnections
     */
    invitationKey?: string
    /**
     * My DID
     * @type string
     * @memberof ConnectionApigetConnections
     */
    myDid?: string
    /**
     * Connection state
     * @type &#39;start&#39; | &#39;error&#39; | &#39;response&#39; | &#39;init&#39; | &#39;abandoned&#39; | &#39;active&#39; | &#39;request&#39; | &#39;invitation&#39; | &#39;completed&#39;
     * @memberof ConnectionApigetConnections
     */
    state?: 'start' | 'error' | 'response' | 'init' | 'abandoned' | 'active' | 'request' | 'invitation' | 'completed'
    /**
     * Their DID
     * @type string
     * @memberof ConnectionApigetConnections
     */
    theirDid?: string
    /**
     * Their role in the connection protocol
     * @type &#39;invitee&#39; | &#39;requester&#39; | &#39;inviter&#39; | &#39;responder&#39;
     * @memberof ConnectionApigetConnections
     */
    theirRole?: 'invitee' | 'requester' | 'inviter' | 'responder'
}

export interface ConnectionApiGetMetadataRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ConnectionApigetMetadata
     */
    connId: string
    /**
     * Key to retrieve.
     * @type string
     * @memberof ConnectionApigetMetadata
     */
    key?: string
}

export interface ConnectionApiReceiveInvitationRequest {
    /**
     * Alias
     * @type string
     * @memberof ConnectionApireceiveInvitation
     */
    alias?: string
    /**
     * Auto-accept connection (defaults to configuration)
     * @type string
     * @memberof ConnectionApireceiveInvitation
     */
    autoAccept?: string
    /**
     * Identifier for active mediation record to be used
     * @type string
     * @memberof ConnectionApireceiveInvitation
     */
    mediationId?: string
    /**
     * 
     * @type ReceiveInvitationRequest
     * @memberof ConnectionApireceiveInvitation
     */
    body?: ReceiveInvitationRequest
}

export interface ConnectionApiSetMetadataRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof ConnectionApisetMetadata
     */
    connId: string
    /**
     * 
     * @type ConnectionMetadataSetRequest
     * @memberof ConnectionApisetMetadata
     */
    body?: ConnectionMetadataSetRequest
}

export class ObjectConnectionApi {
    private api: ObservableConnectionApi

    public constructor(configuration: Configuration, requestFactory?: ConnectionApiRequestFactory, responseProcessor?: ConnectionApiResponseProcessor) {
        this.api = new ObservableConnectionApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Accept a stored connection invitation
     * @param param the request object
     */
    public connectionsConnIdAcceptInvitationPost(param: ConnectionApiConnectionsConnIdAcceptInvitationPostRequest, options?: Configuration): Promise<ConnRecord> {
        return this.api.connectionsConnIdAcceptInvitationPost(param.connId, param.mediationId, param.myEndpoint, param.myLabel,  options).toPromise();
    }

    /**
     * Accept a stored connection request
     * @param param the request object
     */
    public connectionsConnIdAcceptRequestPost(param: ConnectionApiConnectionsConnIdAcceptRequestPostRequest, options?: Configuration): Promise<ConnRecord> {
        return this.api.connectionsConnIdAcceptRequestPost(param.connId, param.myEndpoint,  options).toPromise();
    }

    /**
     * Fetch connection remote endpoint
     * @param param the request object
     */
    public connectionsConnIdEndpointsGet(param: ConnectionApiConnectionsConnIdEndpointsGetRequest, options?: Configuration): Promise<EndpointsResult> {
        return this.api.connectionsConnIdEndpointsGet(param.connId,  options).toPromise();
    }

    /**
     * Assign another connection as the inbound connection
     * @param param the request object
     */
    public connectionsConnIdEstablishInboundRefIdPost(param: ConnectionApiConnectionsConnIdEstablishInboundRefIdPostRequest, options?: Configuration): Promise<any> {
        return this.api.connectionsConnIdEstablishInboundRefIdPost(param.connId, param.refId,  options).toPromise();
    }

    /**
     * Create a new connection invitation
     * @param param the request object
     */
    public createInvitation(param: ConnectionApiCreateInvitationRequest, options?: Configuration): Promise<InvitationResult> {
        return this.api.createInvitation(param.alias, param.autoAccept, param.multiUse, param._public, param.body,  options).toPromise();
    }

    /**
     * Create a new static connection
     * @param param the request object
     */
    public createStatic(param: ConnectionApiCreateStaticRequest, options?: Configuration): Promise<ConnectionStaticResult> {
        return this.api.createStatic(param.body,  options).toPromise();
    }

    /**
     * Remove an existing connection record
     * @param param the request object
     */
    public deleteConnection(param: ConnectionApiDeleteConnectionRequest, options?: Configuration): Promise<any> {
        return this.api.deleteConnection(param.connId,  options).toPromise();
    }

    /**
     * Fetch a single connection record
     * @param param the request object
     */
    public getConnection(param: ConnectionApiGetConnectionRequest, options?: Configuration): Promise<ConnRecord> {
        return this.api.getConnection(param.connId,  options).toPromise();
    }

    /**
     * Query agent-to-agent connections
     * @param param the request object
     */
    public getConnections(param: ConnectionApiGetConnectionsRequest, options?: Configuration): Promise<ConnectionList> {
        return this.api.getConnections(param.alias, param.invitationKey, param.myDid, param.state, param.theirDid, param.theirRole,  options).toPromise();
    }

    /**
     * Fetch connection metadata
     * @param param the request object
     */
    public getMetadata(param: ConnectionApiGetMetadataRequest, options?: Configuration): Promise<ConnectionMetadata> {
        return this.api.getMetadata(param.connId, param.key,  options).toPromise();
    }

    /**
     * Receive a new connection invitation
     * @param param the request object
     */
    public receiveInvitation(param: ConnectionApiReceiveInvitationRequest, options?: Configuration): Promise<ConnRecord> {
        return this.api.receiveInvitation(param.alias, param.autoAccept, param.mediationId, param.body,  options).toPromise();
    }

    /**
     * Set connection metadata
     * @param param the request object
     */
    public setMetadata(param: ConnectionApiSetMetadataRequest, options?: Configuration): Promise<ConnectionMetadata> {
        return this.api.setMetadata(param.connId, param.body,  options).toPromise();
    }

}

import { ObservableCredentialDefinitionApi } from "./ObservableAPI";
import { CredentialDefinitionApiRequestFactory, CredentialDefinitionApiResponseProcessor} from "../apis/CredentialDefinitionApi";

export interface CredentialDefinitionApiCredentialDefinitionsCreatedGetRequest {
    /**
     * Credential definition id
     * @type string
     * @memberof CredentialDefinitionApicredentialDefinitionsCreatedGet
     */
    credDefId?: string
    /**
     * Issuer DID
     * @type string
     * @memberof CredentialDefinitionApicredentialDefinitionsCreatedGet
     */
    issuerDid?: string
    /**
     * Schema identifier
     * @type string
     * @memberof CredentialDefinitionApicredentialDefinitionsCreatedGet
     */
    schemaId?: string
    /**
     * Schema issuer DID
     * @type string
     * @memberof CredentialDefinitionApicredentialDefinitionsCreatedGet
     */
    schemaIssuerDid?: string
    /**
     * Schema name
     * @type string
     * @memberof CredentialDefinitionApicredentialDefinitionsCreatedGet
     */
    schemaName?: string
    /**
     * Schema version
     * @type string
     * @memberof CredentialDefinitionApicredentialDefinitionsCreatedGet
     */
    schemaVersion?: string
}

export interface CredentialDefinitionApiCredentialDefinitionsCredDefIdGetRequest {
    /**
     * Credential definition identifier
     * @type string
     * @memberof CredentialDefinitionApicredentialDefinitionsCredDefIdGet
     */
    credDefId: string
}

export interface CredentialDefinitionApiPublishCredDefRequest {
    /**
     * 
     * @type CredentialDefinitionSendRequest
     * @memberof CredentialDefinitionApipublishCredDef
     */
    body?: CredentialDefinitionSendRequest
}

export class ObjectCredentialDefinitionApi {
    private api: ObservableCredentialDefinitionApi

    public constructor(configuration: Configuration, requestFactory?: CredentialDefinitionApiRequestFactory, responseProcessor?: CredentialDefinitionApiResponseProcessor) {
        this.api = new ObservableCredentialDefinitionApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Search for matching credential definitions that agent originated
     * @param param the request object
     */
    public credentialDefinitionsCreatedGet(param: CredentialDefinitionApiCredentialDefinitionsCreatedGetRequest, options?: Configuration): Promise<CredentialDefinitionsCreatedResults> {
        return this.api.credentialDefinitionsCreatedGet(param.credDefId, param.issuerDid, param.schemaId, param.schemaIssuerDid, param.schemaName, param.schemaVersion,  options).toPromise();
    }

    /**
     * Gets a credential definition from the ledger
     * @param param the request object
     */
    public credentialDefinitionsCredDefIdGet(param: CredentialDefinitionApiCredentialDefinitionsCredDefIdGetRequest, options?: Configuration): Promise<CredentialDefinitionGetResults> {
        return this.api.credentialDefinitionsCredDefIdGet(param.credDefId,  options).toPromise();
    }

    /**
     * Sends a credential definition to the ledger
     * @param param the request object
     */
    public publishCredDef(param: CredentialDefinitionApiPublishCredDefRequest, options?: Configuration): Promise<CredentialDefinitionSendResults> {
        return this.api.publishCredDef(param.body,  options).toPromise();
    }

}

import { ObservableCredentialsApi } from "./ObservableAPI";
import { CredentialsApiRequestFactory, CredentialsApiResponseProcessor} from "../apis/CredentialsApi";

export interface CredentialsApiCredentialCredentialIdDeleteRequest {
    /**
     * Credential identifier
     * @type string
     * @memberof CredentialsApicredentialCredentialIdDelete
     */
    credentialId: string
}

export interface CredentialsApiCredentialCredentialIdGetRequest {
    /**
     * Credential identifier
     * @type string
     * @memberof CredentialsApicredentialCredentialIdGet
     */
    credentialId: string
}

export interface CredentialsApiCredentialMimeTypesCredentialIdGetRequest {
    /**
     * Credential identifier
     * @type string
     * @memberof CredentialsApicredentialMimeTypesCredentialIdGet
     */
    credentialId: string
}

export interface CredentialsApiCredentialRevokedCredentialIdGetRequest {
    /**
     * Credential identifier
     * @type string
     * @memberof CredentialsApicredentialRevokedCredentialIdGet
     */
    credentialId: string
    /**
     * Earliest epoch of revocation status interval of interest
     * @type string
     * @memberof CredentialsApicredentialRevokedCredentialIdGet
     */
    from?: string
    /**
     * Latest epoch of revocation status interval of interest
     * @type string
     * @memberof CredentialsApicredentialRevokedCredentialIdGet
     */
    to?: string
}

export interface CredentialsApiCredentialsGetRequest {
    /**
     * Maximum number to retrieve
     * @type string
     * @memberof CredentialsApicredentialsGet
     */
    count?: string
    /**
     * Start index
     * @type string
     * @memberof CredentialsApicredentialsGet
     */
    start?: string
    /**
     * (JSON) WQL query
     * @type string
     * @memberof CredentialsApicredentialsGet
     */
    wql?: string
}

export class ObjectCredentialsApi {
    private api: ObservableCredentialsApi

    public constructor(configuration: Configuration, requestFactory?: CredentialsApiRequestFactory, responseProcessor?: CredentialsApiResponseProcessor) {
        this.api = new ObservableCredentialsApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Remove a credential from the wallet by id
     * @param param the request object
     */
    public credentialCredentialIdDelete(param: CredentialsApiCredentialCredentialIdDeleteRequest, options?: Configuration): Promise<any> {
        return this.api.credentialCredentialIdDelete(param.credentialId,  options).toPromise();
    }

    /**
     * Fetch a credential from wallet by id
     * @param param the request object
     */
    public credentialCredentialIdGet(param: CredentialsApiCredentialCredentialIdGetRequest, options?: Configuration): Promise<CredBrief> {
        return this.api.credentialCredentialIdGet(param.credentialId,  options).toPromise();
    }

    /**
     * Get attribute MIME types from wallet
     * @param param the request object
     */
    public credentialMimeTypesCredentialIdGet(param: CredentialsApiCredentialMimeTypesCredentialIdGetRequest, options?: Configuration): Promise<any> {
        return this.api.credentialMimeTypesCredentialIdGet(param.credentialId,  options).toPromise();
    }

    /**
     * Query credential revocation status by id
     * @param param the request object
     */
    public credentialRevokedCredentialIdGet(param: CredentialsApiCredentialRevokedCredentialIdGetRequest, options?: Configuration): Promise<CredRevokedResult> {
        return this.api.credentialRevokedCredentialIdGet(param.credentialId, param.from, param.to,  options).toPromise();
    }

    /**
     * Fetch credentials from wallet
     * @param param the request object
     */
    public credentialsGet(param: CredentialsApiCredentialsGetRequest, options?: Configuration): Promise<CredBriefList> {
        return this.api.credentialsGet(param.count, param.start, param.wql,  options).toPromise();
    }

}

import { ObservableDidExchangeApi } from "./ObservableAPI";
import { DidExchangeApiRequestFactory, DidExchangeApiResponseProcessor} from "../apis/DidExchangeApi";

export interface DidExchangeApiDidexchangeConnIdAcceptInvitationPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof DidExchangeApididexchangeConnIdAcceptInvitationPost
     */
    connId: string
    /**
     * My URL endpoint
     * @type string
     * @memberof DidExchangeApididexchangeConnIdAcceptInvitationPost
     */
    myEndpoint?: string
    /**
     * Label for connection request
     * @type string
     * @memberof DidExchangeApididexchangeConnIdAcceptInvitationPost
     */
    myLabel?: string
}

export interface DidExchangeApiDidexchangeConnIdAcceptRequestPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof DidExchangeApididexchangeConnIdAcceptRequestPost
     */
    connId: string
    /**
     * Identifier for active mediation record to be used
     * @type string
     * @memberof DidExchangeApididexchangeConnIdAcceptRequestPost
     */
    mediationId?: string
    /**
     * My URL endpoint
     * @type string
     * @memberof DidExchangeApididexchangeConnIdAcceptRequestPost
     */
    myEndpoint?: string
}

export interface DidExchangeApiDidexchangeCreateRequestPostRequest {
    /**
     * Public DID to which to request connection
     * @type string
     * @memberof DidExchangeApididexchangeCreateRequestPost
     */
    theirPublicDid: string
    /**
     * Identifier for active mediation record to be used
     * @type string
     * @memberof DidExchangeApididexchangeCreateRequestPost
     */
    mediationId?: string
    /**
     * My URL endpoint
     * @type string
     * @memberof DidExchangeApididexchangeCreateRequestPost
     */
    myEndpoint?: string
    /**
     * Label for connection request
     * @type string
     * @memberof DidExchangeApididexchangeCreateRequestPost
     */
    myLabel?: string
}

export interface DidExchangeApiDidexchangeReceiveRequestPostRequest {
    /**
     * Alias for connection
     * @type string
     * @memberof DidExchangeApididexchangeReceiveRequestPost
     */
    alias?: string
    /**
     * Auto-accept connection (defaults to configuration)
     * @type string
     * @memberof DidExchangeApididexchangeReceiveRequestPost
     */
    autoAccept?: string
    /**
     * Identifier for active mediation record to be used
     * @type string
     * @memberof DidExchangeApididexchangeReceiveRequestPost
     */
    mediationId?: string
    /**
     * My URL endpoint
     * @type string
     * @memberof DidExchangeApididexchangeReceiveRequestPost
     */
    myEndpoint?: string
    /**
     * 
     * @type DIDXRequest
     * @memberof DidExchangeApididexchangeReceiveRequestPost
     */
    body?: DIDXRequest
}

export class ObjectDidExchangeApi {
    private api: ObservableDidExchangeApi

    public constructor(configuration: Configuration, requestFactory?: DidExchangeApiRequestFactory, responseProcessor?: DidExchangeApiResponseProcessor) {
        this.api = new ObservableDidExchangeApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Accept a stored connection invitation
     * @param param the request object
     */
    public didexchangeConnIdAcceptInvitationPost(param: DidExchangeApiDidexchangeConnIdAcceptInvitationPostRequest, options?: Configuration): Promise<ConnRecord> {
        return this.api.didexchangeConnIdAcceptInvitationPost(param.connId, param.myEndpoint, param.myLabel,  options).toPromise();
    }

    /**
     * Accept a stored connection request
     * @param param the request object
     */
    public didexchangeConnIdAcceptRequestPost(param: DidExchangeApiDidexchangeConnIdAcceptRequestPostRequest, options?: Configuration): Promise<ConnRecord> {
        return this.api.didexchangeConnIdAcceptRequestPost(param.connId, param.mediationId, param.myEndpoint,  options).toPromise();
    }

    /**
     * Create request against public DID's implicit invitation
     * @param param the request object
     */
    public didexchangeCreateRequestPost(param: DidExchangeApiDidexchangeCreateRequestPostRequest, options?: Configuration): Promise<DIDXRequest> {
        return this.api.didexchangeCreateRequestPost(param.theirPublicDid, param.mediationId, param.myEndpoint, param.myLabel,  options).toPromise();
    }

    /**
     * Receive request against public DID's implicit invitation
     * @param param the request object
     */
    public didexchangeReceiveRequestPost(param: DidExchangeApiDidexchangeReceiveRequestPostRequest, options?: Configuration): Promise<ConnRecord> {
        return this.api.didexchangeReceiveRequestPost(param.alias, param.autoAccept, param.mediationId, param.myEndpoint, param.body,  options).toPromise();
    }

}

import { ObservableIntroductionApi } from "./ObservableAPI";
import { IntroductionApiRequestFactory, IntroductionApiResponseProcessor} from "../apis/IntroductionApi";

export interface IntroductionApiConnectionsConnIdStartIntroductionPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof IntroductionApiconnectionsConnIdStartIntroductionPost
     */
    connId: string
    /**
     * Target connection identifier
     * @type string
     * @memberof IntroductionApiconnectionsConnIdStartIntroductionPost
     */
    targetConnectionId: string
    /**
     * Message
     * @type string
     * @memberof IntroductionApiconnectionsConnIdStartIntroductionPost
     */
    message?: string
}

export class ObjectIntroductionApi {
    private api: ObservableIntroductionApi

    public constructor(configuration: Configuration, requestFactory?: IntroductionApiRequestFactory, responseProcessor?: IntroductionApiResponseProcessor) {
        this.api = new ObservableIntroductionApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Start an introduction between two connections
     * @param param the request object
     */
    public connectionsConnIdStartIntroductionPost(param: IntroductionApiConnectionsConnIdStartIntroductionPostRequest, options?: Configuration): Promise<any> {
        return this.api.connectionsConnIdStartIntroductionPost(param.connId, param.targetConnectionId, param.message,  options).toPromise();
    }

}

import { ObservableIssueCredentialV10Api } from "./ObservableAPI";
import { IssueCredentialV10ApiRequestFactory, IssueCredentialV10ApiResponseProcessor} from "../apis/IssueCredentialV10Api";

export interface IssueCredentialV10ApiIssueCredentialAutomatedRequest {
    /**
     * 
     * @type V10CredentialProposalRequestMand
     * @memberof IssueCredentialV10ApiissueCredentialAutomated
     */
    body?: V10CredentialProposalRequestMand
}

export interface IssueCredentialV10ApiIssueCredentialCreatePostRequest {
    /**
     * 
     * @type V10CredentialCreate
     * @memberof IssueCredentialV10ApiissueCredentialCreatePost
     */
    body?: V10CredentialCreate
}

export interface IssueCredentialV10ApiIssueCredentialRecordsCredExIdDeleteRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdDelete
     */
    credExId: string
}

export interface IssueCredentialV10ApiIssueCredentialRecordsCredExIdGetRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdGet
     */
    credExId: string
}

export interface IssueCredentialV10ApiIssueCredentialRecordsCredExIdIssuePostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdIssuePost
     */
    credExId: string
    /**
     * 
     * @type V10CredentialIssueRequest
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdIssuePost
     */
    body?: V10CredentialIssueRequest
}

export interface IssueCredentialV10ApiIssueCredentialRecordsCredExIdProblemReportPostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdProblemReportPost
     */
    credExId: string
    /**
     * 
     * @type V10CredentialProblemReportRequest
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdProblemReportPost
     */
    body?: V10CredentialProblemReportRequest
}

export interface IssueCredentialV10ApiIssueCredentialRecordsCredExIdSendOfferPostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdSendOfferPost
     */
    credExId: string
}

export interface IssueCredentialV10ApiIssueCredentialRecordsCredExIdSendRequestPostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdSendRequestPost
     */
    credExId: string
}

export interface IssueCredentialV10ApiIssueCredentialRecordsCredExIdStorePostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdStorePost
     */
    credExId: string
    /**
     * 
     * @type V10CredentialStoreRequest
     * @memberof IssueCredentialV10ApiissueCredentialRecordsCredExIdStorePost
     */
    body?: V10CredentialStoreRequest
}

export interface IssueCredentialV10ApiIssueCredentialRecordsGetRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsGet
     */
    connectionId?: string
    /**
     * Role assigned in credential exchange
     * @type &#39;issuer&#39; | &#39;holder&#39;
     * @memberof IssueCredentialV10ApiissueCredentialRecordsGet
     */
    role?: 'issuer' | 'holder'
    /**
     * Credential exchange state
     * @type &#39;proposal_sent&#39; | &#39;proposal_received&#39; | &#39;offer_sent&#39; | &#39;offer_received&#39; | &#39;request_sent&#39; | &#39;request_received&#39; | &#39;credential_issued&#39; | &#39;credential_received&#39; | &#39;credential_acked&#39;
     * @memberof IssueCredentialV10ApiissueCredentialRecordsGet
     */
    state?: 'proposal_sent' | 'proposal_received' | 'offer_sent' | 'offer_received' | 'request_sent' | 'request_received' | 'credential_issued' | 'credential_received' | 'credential_acked'
    /**
     * Thread identifier
     * @type string
     * @memberof IssueCredentialV10ApiissueCredentialRecordsGet
     */
    threadId?: string
}

export interface IssueCredentialV10ApiIssueCredentialSendOfferPostRequest {
    /**
     * 
     * @type V10CredentialOfferRequest
     * @memberof IssueCredentialV10ApiissueCredentialSendOfferPost
     */
    body?: V10CredentialOfferRequest
}

export interface IssueCredentialV10ApiIssueCredentialSendProposalPostRequest {
    /**
     * 
     * @type V10CredentialProposalRequestOpt
     * @memberof IssueCredentialV10ApiissueCredentialSendProposalPost
     */
    body?: V10CredentialProposalRequestOpt
}

export class ObjectIssueCredentialV10Api {
    private api: ObservableIssueCredentialV10Api

    public constructor(configuration: Configuration, requestFactory?: IssueCredentialV10ApiRequestFactory, responseProcessor?: IssueCredentialV10ApiResponseProcessor) {
        this.api = new ObservableIssueCredentialV10Api(configuration, requestFactory, responseProcessor);
    }

    /**
     * Send holder a credential, automating entire flow
     * @param param the request object
     */
    public issueCredentialAutomated(param: IssueCredentialV10ApiIssueCredentialAutomatedRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialAutomated(param.body,  options).toPromise();
    }

    /**
     * Send holder a credential, automating entire flow
     * @param param the request object
     */
    public issueCredentialCreatePost(param: IssueCredentialV10ApiIssueCredentialCreatePostRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialCreatePost(param.body,  options).toPromise();
    }

    /**
     * Remove an existing credential exchange record
     * @param param the request object
     */
    public issueCredentialRecordsCredExIdDelete(param: IssueCredentialV10ApiIssueCredentialRecordsCredExIdDeleteRequest, options?: Configuration): Promise<any> {
        return this.api.issueCredentialRecordsCredExIdDelete(param.credExId,  options).toPromise();
    }

    /**
     * Fetch a single credential exchange record
     * @param param the request object
     */
    public issueCredentialRecordsCredExIdGet(param: IssueCredentialV10ApiIssueCredentialRecordsCredExIdGetRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialRecordsCredExIdGet(param.credExId,  options).toPromise();
    }

    /**
     * Send holder a credential
     * @param param the request object
     */
    public issueCredentialRecordsCredExIdIssuePost(param: IssueCredentialV10ApiIssueCredentialRecordsCredExIdIssuePostRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialRecordsCredExIdIssuePost(param.credExId, param.body,  options).toPromise();
    }

    /**
     * Send a problem report for credential exchange
     * @param param the request object
     */
    public issueCredentialRecordsCredExIdProblemReportPost(param: IssueCredentialV10ApiIssueCredentialRecordsCredExIdProblemReportPostRequest, options?: Configuration): Promise<any> {
        return this.api.issueCredentialRecordsCredExIdProblemReportPost(param.credExId, param.body,  options).toPromise();
    }

    /**
     * Send holder a credential offer in reference to a proposal with preview
     * @param param the request object
     */
    public issueCredentialRecordsCredExIdSendOfferPost(param: IssueCredentialV10ApiIssueCredentialRecordsCredExIdSendOfferPostRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialRecordsCredExIdSendOfferPost(param.credExId,  options).toPromise();
    }

    /**
     * Send issuer a credential request
     * @param param the request object
     */
    public issueCredentialRecordsCredExIdSendRequestPost(param: IssueCredentialV10ApiIssueCredentialRecordsCredExIdSendRequestPostRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialRecordsCredExIdSendRequestPost(param.credExId,  options).toPromise();
    }

    /**
     * Store a received credential
     * @param param the request object
     */
    public issueCredentialRecordsCredExIdStorePost(param: IssueCredentialV10ApiIssueCredentialRecordsCredExIdStorePostRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialRecordsCredExIdStorePost(param.credExId, param.body,  options).toPromise();
    }

    /**
     * Fetch all credential exchange records
     * @param param the request object
     */
    public issueCredentialRecordsGet(param: IssueCredentialV10ApiIssueCredentialRecordsGetRequest, options?: Configuration): Promise<V10CredentialExchangeListResult> {
        return this.api.issueCredentialRecordsGet(param.connectionId, param.role, param.state, param.threadId,  options).toPromise();
    }

    /**
     * Send holder a credential offer, independent of any proposal
     * @param param the request object
     */
    public issueCredentialSendOfferPost(param: IssueCredentialV10ApiIssueCredentialSendOfferPostRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialSendOfferPost(param.body,  options).toPromise();
    }

    /**
     * Send issuer a credential proposal
     * @param param the request object
     */
    public issueCredentialSendProposalPost(param: IssueCredentialV10ApiIssueCredentialSendProposalPostRequest, options?: Configuration): Promise<V10CredentialExchange> {
        return this.api.issueCredentialSendProposalPost(param.body,  options).toPromise();
    }

}

import { ObservableIssueCredentialV20Api } from "./ObservableAPI";
import { IssueCredentialV20ApiRequestFactory, IssueCredentialV20ApiResponseProcessor} from "../apis/IssueCredentialV20Api";

export interface IssueCredentialV20ApiIssueCredential20CreatePostRequest {
    /**
     * 
     * @type V20CredCreate
     * @memberof IssueCredentialV20ApiissueCredential20CreatePost
     */
    body?: V20CredCreate
}

export interface IssueCredentialV20ApiIssueCredential20RecordsCredExIdDeleteRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdDelete
     */
    credExId: string
}

export interface IssueCredentialV20ApiIssueCredential20RecordsCredExIdGetRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdGet
     */
    credExId: string
}

export interface IssueCredentialV20ApiIssueCredential20RecordsCredExIdIssuePostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdIssuePost
     */
    credExId: string
    /**
     * 
     * @type V20CredIssueRequest
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdIssuePost
     */
    body?: V20CredIssueRequest
}

export interface IssueCredentialV20ApiIssueCredential20RecordsCredExIdProblemReportPostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdProblemReportPost
     */
    credExId: string
    /**
     * 
     * @type V20CredIssueProblemReportRequest
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdProblemReportPost
     */
    body?: V20CredIssueProblemReportRequest
}

export interface IssueCredentialV20ApiIssueCredential20RecordsCredExIdSendOfferPostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdSendOfferPost
     */
    credExId: string
}

export interface IssueCredentialV20ApiIssueCredential20RecordsCredExIdSendRequestPostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdSendRequestPost
     */
    credExId: string
}

export interface IssueCredentialV20ApiIssueCredential20RecordsCredExIdStorePostRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdStorePost
     */
    credExId: string
    /**
     * 
     * @type V20CredStoreRequest
     * @memberof IssueCredentialV20ApiissueCredential20RecordsCredExIdStorePost
     */
    body?: V20CredStoreRequest
}

export interface IssueCredentialV20ApiIssueCredential20RecordsGetRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsGet
     */
    connectionId?: string
    /**
     * Role assigned in credential exchange
     * @type &#39;issuer&#39; | &#39;holder&#39;
     * @memberof IssueCredentialV20ApiissueCredential20RecordsGet
     */
    role?: 'issuer' | 'holder'
    /**
     * Credential exchange state
     * @type &#39;proposal-sent&#39; | &#39;proposal-received&#39; | &#39;offer-sent&#39; | &#39;offer-received&#39; | &#39;request-sent&#39; | &#39;request-received&#39; | &#39;credential-issued&#39; | &#39;credential-received&#39; | &#39;done&#39;
     * @memberof IssueCredentialV20ApiissueCredential20RecordsGet
     */
    state?: 'proposal-sent' | 'proposal-received' | 'offer-sent' | 'offer-received' | 'request-sent' | 'request-received' | 'credential-issued' | 'credential-received' | 'done'
    /**
     * Thread identifier
     * @type string
     * @memberof IssueCredentialV20ApiissueCredential20RecordsGet
     */
    threadId?: string
}

export interface IssueCredentialV20ApiIssueCredential20SendOfferPostRequest {
    /**
     * 
     * @type V20CredOfferRequest
     * @memberof IssueCredentialV20ApiissueCredential20SendOfferPost
     */
    body?: V20CredOfferRequest
}

export interface IssueCredentialV20ApiIssueCredential20SendPostRequest {
    /**
     * 
     * @type V20CredProposalRequestPreviewMand
     * @memberof IssueCredentialV20ApiissueCredential20SendPost
     */
    body?: V20CredProposalRequestPreviewMand
}

export interface IssueCredentialV20ApiIssueCredential20SendProposalPostRequest {
    /**
     * 
     * @type V20CredProposalRequestPreviewOpt
     * @memberof IssueCredentialV20ApiissueCredential20SendProposalPost
     */
    body?: V20CredProposalRequestPreviewOpt
}

export class ObjectIssueCredentialV20Api {
    private api: ObservableIssueCredentialV20Api

    public constructor(configuration: Configuration, requestFactory?: IssueCredentialV20ApiRequestFactory, responseProcessor?: IssueCredentialV20ApiResponseProcessor) {
        this.api = new ObservableIssueCredentialV20Api(configuration, requestFactory, responseProcessor);
    }

    /**
     * Send holder a credential, automating entire flow
     * @param param the request object
     */
    public issueCredential20CreatePost(param: IssueCredentialV20ApiIssueCredential20CreatePostRequest, options?: Configuration): Promise<V20CredExRecord> {
        return this.api.issueCredential20CreatePost(param.body,  options).toPromise();
    }

    /**
     * Remove an existing credential exchange record
     * @param param the request object
     */
    public issueCredential20RecordsCredExIdDelete(param: IssueCredentialV20ApiIssueCredential20RecordsCredExIdDeleteRequest, options?: Configuration): Promise<any> {
        return this.api.issueCredential20RecordsCredExIdDelete(param.credExId,  options).toPromise();
    }

    /**
     * Fetch a single credential exchange record
     * @param param the request object
     */
    public issueCredential20RecordsCredExIdGet(param: IssueCredentialV20ApiIssueCredential20RecordsCredExIdGetRequest, options?: Configuration): Promise<V20CredExRecordDetail> {
        return this.api.issueCredential20RecordsCredExIdGet(param.credExId,  options).toPromise();
    }

    /**
     * Send holder a credential
     * @param param the request object
     */
    public issueCredential20RecordsCredExIdIssuePost(param: IssueCredentialV20ApiIssueCredential20RecordsCredExIdIssuePostRequest, options?: Configuration): Promise<V20CredExRecordDetail> {
        return this.api.issueCredential20RecordsCredExIdIssuePost(param.credExId, param.body,  options).toPromise();
    }

    /**
     * Send a problem report for credential exchange
     * @param param the request object
     */
    public issueCredential20RecordsCredExIdProblemReportPost(param: IssueCredentialV20ApiIssueCredential20RecordsCredExIdProblemReportPostRequest, options?: Configuration): Promise<any> {
        return this.api.issueCredential20RecordsCredExIdProblemReportPost(param.credExId, param.body,  options).toPromise();
    }

    /**
     * Send holder a credential offer in reference to a proposal with preview
     * @param param the request object
     */
    public issueCredential20RecordsCredExIdSendOfferPost(param: IssueCredentialV20ApiIssueCredential20RecordsCredExIdSendOfferPostRequest, options?: Configuration): Promise<V20CredExRecord> {
        return this.api.issueCredential20RecordsCredExIdSendOfferPost(param.credExId,  options).toPromise();
    }

    /**
     * Send issuer a credential request
     * @param param the request object
     */
    public issueCredential20RecordsCredExIdSendRequestPost(param: IssueCredentialV20ApiIssueCredential20RecordsCredExIdSendRequestPostRequest, options?: Configuration): Promise<V20CredExRecord> {
        return this.api.issueCredential20RecordsCredExIdSendRequestPost(param.credExId,  options).toPromise();
    }

    /**
     * Store a received credential
     * @param param the request object
     */
    public issueCredential20RecordsCredExIdStorePost(param: IssueCredentialV20ApiIssueCredential20RecordsCredExIdStorePostRequest, options?: Configuration): Promise<V20CredExRecordDetail> {
        return this.api.issueCredential20RecordsCredExIdStorePost(param.credExId, param.body,  options).toPromise();
    }

    /**
     * Fetch all credential exchange records
     * @param param the request object
     */
    public issueCredential20RecordsGet(param: IssueCredentialV20ApiIssueCredential20RecordsGetRequest, options?: Configuration): Promise<V20CredExRecordListResult> {
        return this.api.issueCredential20RecordsGet(param.connectionId, param.role, param.state, param.threadId,  options).toPromise();
    }

    /**
     * Send holder a credential offer, independent of any proposal
     * @param param the request object
     */
    public issueCredential20SendOfferPost(param: IssueCredentialV20ApiIssueCredential20SendOfferPostRequest, options?: Configuration): Promise<V20CredExRecord> {
        return this.api.issueCredential20SendOfferPost(param.body,  options).toPromise();
    }

    /**
     * Send holder a credential, automating entire flow
     * @param param the request object
     */
    public issueCredential20SendPost(param: IssueCredentialV20ApiIssueCredential20SendPostRequest, options?: Configuration): Promise<V20CredExRecord> {
        return this.api.issueCredential20SendPost(param.body,  options).toPromise();
    }

    /**
     * Send issuer a credential proposal
     * @param param the request object
     */
    public issueCredential20SendProposalPost(param: IssueCredentialV20ApiIssueCredential20SendProposalPostRequest, options?: Configuration): Promise<V20CredExRecord> {
        return this.api.issueCredential20SendProposalPost(param.body,  options).toPromise();
    }

}

import { ObservableLedgerApi } from "./ObservableAPI";
import { LedgerApiRequestFactory, LedgerApiResponseProcessor} from "../apis/LedgerApi";

export interface LedgerApiAcceptTaaRequest {
    /**
     * 
     * @type TAAAccept
     * @memberof LedgerApiacceptTaa
     */
    body?: TAAAccept
}

export interface LedgerApiFetchTaaRequest {
}

export interface LedgerApiLedgerDidEndpointGetRequest {
    /**
     * DID of interest
     * @type string
     * @memberof LedgerApiledgerDidEndpointGet
     */
    did: string
    /**
     * Endpoint type of interest (default &#39;Endpoint&#39;)
     * @type &#39;Endpoint&#39; | &#39;Profile&#39; | &#39;LinkedDomains&#39;
     * @memberof LedgerApiledgerDidEndpointGet
     */
    endpointType?: 'Endpoint' | 'Profile' | 'LinkedDomains'
}

export interface LedgerApiLedgerDidVerkeyGetRequest {
    /**
     * DID of interest
     * @type string
     * @memberof LedgerApiledgerDidVerkeyGet
     */
    did: string
}

export interface LedgerApiLedgerGetNymRoleGetRequest {
    /**
     * DID of interest
     * @type string
     * @memberof LedgerApiledgerGetNymRoleGet
     */
    did: string
}

export interface LedgerApiLedgerRegisterNymPostRequest {
    /**
     * DID to register
     * @type string
     * @memberof LedgerApiledgerRegisterNymPost
     */
    did: string
    /**
     * Verification key
     * @type string
     * @memberof LedgerApiledgerRegisterNymPost
     */
    verkey: string
    /**
     * Alias
     * @type string
     * @memberof LedgerApiledgerRegisterNymPost
     */
    alias?: string
    /**
     * Role
     * @type &#39;STEWARD&#39; | &#39;TRUSTEE&#39; | &#39;ENDORSER&#39; | &#39;NETWORK_MONITOR&#39; | &#39;reset&#39;
     * @memberof LedgerApiledgerRegisterNymPost
     */
    role?: 'STEWARD' | 'TRUSTEE' | 'ENDORSER' | 'NETWORK_MONITOR' | 'reset'
}

export interface LedgerApiLedgerRotatePublicDidKeypairPatchRequest {
}

export class ObjectLedgerApi {
    private api: ObservableLedgerApi

    public constructor(configuration: Configuration, requestFactory?: LedgerApiRequestFactory, responseProcessor?: LedgerApiResponseProcessor) {
        this.api = new ObservableLedgerApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Accept the transaction author agreement
     * @param param the request object
     */
    public acceptTaa(param: LedgerApiAcceptTaaRequest, options?: Configuration): Promise<any> {
        return this.api.acceptTaa(param.body,  options).toPromise();
    }

    /**
     * Fetch the current transaction author agreement, if any
     * @param param the request object
     */
    public fetchTaa(param: LedgerApiFetchTaaRequest, options?: Configuration): Promise<TAAResult> {
        return this.api.fetchTaa( options).toPromise();
    }

    /**
     * Get the endpoint for a DID from the ledger.
     * @param param the request object
     */
    public ledgerDidEndpointGet(param: LedgerApiLedgerDidEndpointGetRequest, options?: Configuration): Promise<any> {
        return this.api.ledgerDidEndpointGet(param.did, param.endpointType,  options).toPromise();
    }

    /**
     * Get the verkey for a DID from the ledger.
     * @param param the request object
     */
    public ledgerDidVerkeyGet(param: LedgerApiLedgerDidVerkeyGetRequest, options?: Configuration): Promise<any> {
        return this.api.ledgerDidVerkeyGet(param.did,  options).toPromise();
    }

    /**
     * Get the role from the NYM registration of a public DID.
     * @param param the request object
     */
    public ledgerGetNymRoleGet(param: LedgerApiLedgerGetNymRoleGetRequest, options?: Configuration): Promise<any> {
        return this.api.ledgerGetNymRoleGet(param.did,  options).toPromise();
    }

    /**
     * Send a NYM registration to the ledger.
     * @param param the request object
     */
    public ledgerRegisterNymPost(param: LedgerApiLedgerRegisterNymPostRequest, options?: Configuration): Promise<any> {
        return this.api.ledgerRegisterNymPost(param.did, param.verkey, param.alias, param.role,  options).toPromise();
    }

    /**
     * Rotate key pair for public DID.
     * @param param the request object
     */
    public ledgerRotatePublicDidKeypairPatch(param: LedgerApiLedgerRotatePublicDidKeypairPatchRequest, options?: Configuration): Promise<any> {
        return this.api.ledgerRotatePublicDidKeypairPatch( options).toPromise();
    }

}

import { ObservableMediationApi } from "./ObservableAPI";
import { MediationApiRequestFactory, MediationApiResponseProcessor} from "../apis/MediationApi";

export interface MediationApiMediationDefaultMediatorDeleteRequest {
}

export interface MediationApiMediationDefaultMediatorGetRequest {
}

export interface MediationApiMediationKeylistsGetRequest {
    /**
     * Connection identifier (optional)
     * @type string
     * @memberof MediationApimediationKeylistsGet
     */
    connId?: string
    /**
     * Filer on role, &#39;client&#39; for keys         mediated by other agents, &#39;server&#39; for keys         mediated by this agent
     * @type &#39;client&#39; | &#39;server&#39;
     * @memberof MediationApimediationKeylistsGet
     */
    role?: 'client' | 'server'
}

export interface MediationApiMediationKeylistsMediationIdSendKeylistQueryPostRequest {
    /**
     * Mediation record identifier
     * @type string
     * @memberof MediationApimediationKeylistsMediationIdSendKeylistQueryPost
     */
    mediationId: string
    /**
     * limit number of results
     * @type number
     * @memberof MediationApimediationKeylistsMediationIdSendKeylistQueryPost
     */
    paginateLimit?: number
    /**
     * offset to use in pagination
     * @type number
     * @memberof MediationApimediationKeylistsMediationIdSendKeylistQueryPost
     */
    paginateOffset?: number
    /**
     * 
     * @type KeylistQueryFilterRequest
     * @memberof MediationApimediationKeylistsMediationIdSendKeylistQueryPost
     */
    body?: KeylistQueryFilterRequest
}

export interface MediationApiMediationKeylistsMediationIdSendKeylistUpdatePostRequest {
    /**
     * Mediation record identifier
     * @type string
     * @memberof MediationApimediationKeylistsMediationIdSendKeylistUpdatePost
     */
    mediationId: string
    /**
     * 
     * @type KeylistUpdateRequest
     * @memberof MediationApimediationKeylistsMediationIdSendKeylistUpdatePost
     */
    body?: KeylistUpdateRequest
}

export interface MediationApiMediationMediationIdDefaultMediatorPutRequest {
    /**
     * Mediation record identifier
     * @type string
     * @memberof MediationApimediationMediationIdDefaultMediatorPut
     */
    mediationId: string
}

export interface MediationApiMediationRequestConnIdPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof MediationApimediationRequestConnIdPost
     */
    connId: string
    /**
     * 
     * @type MediationCreateRequest
     * @memberof MediationApimediationRequestConnIdPost
     */
    body?: MediationCreateRequest
}

export interface MediationApiMediationRequestsGetRequest {
    /**
     * Connection identifier (optional)
     * @type string
     * @memberof MediationApimediationRequestsGet
     */
    connId?: string
    /**
     * List of mediator rules for recipient
     * @type Array&lt;string&gt;
     * @memberof MediationApimediationRequestsGet
     */
    mediatorTerms?: Array<string>
    /**
     * List of recipient rules for mediation
     * @type Array&lt;string&gt;
     * @memberof MediationApimediationRequestsGet
     */
    recipientTerms?: Array<string>
    /**
     * Mediation state (optional)
     * @type &#39;request&#39; | &#39;granted&#39; | &#39;denied&#39;
     * @memberof MediationApimediationRequestsGet
     */
    state?: 'request' | 'granted' | 'denied'
}

export interface MediationApiMediationRequestsMediationIdDeleteRequest {
    /**
     * Mediation record identifier
     * @type string
     * @memberof MediationApimediationRequestsMediationIdDelete
     */
    mediationId: string
}

export interface MediationApiMediationRequestsMediationIdDenyPostRequest {
    /**
     * Mediation record identifier
     * @type string
     * @memberof MediationApimediationRequestsMediationIdDenyPost
     */
    mediationId: string
    /**
     * 
     * @type AdminMediationDeny
     * @memberof MediationApimediationRequestsMediationIdDenyPost
     */
    body?: AdminMediationDeny
}

export interface MediationApiMediationRequestsMediationIdGetRequest {
    /**
     * Mediation record identifier
     * @type string
     * @memberof MediationApimediationRequestsMediationIdGet
     */
    mediationId: string
}

export interface MediationApiMediationRequestsMediationIdGrantPostRequest {
    /**
     * Mediation record identifier
     * @type string
     * @memberof MediationApimediationRequestsMediationIdGrantPost
     */
    mediationId: string
}

export class ObjectMediationApi {
    private api: ObservableMediationApi

    public constructor(configuration: Configuration, requestFactory?: MediationApiRequestFactory, responseProcessor?: MediationApiResponseProcessor) {
        this.api = new ObservableMediationApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Clear default mediator
     * @param param the request object
     */
    public mediationDefaultMediatorDelete(param: MediationApiMediationDefaultMediatorDeleteRequest, options?: Configuration): Promise<MediationRecord> {
        return this.api.mediationDefaultMediatorDelete( options).toPromise();
    }

    /**
     * Get default mediator
     * @param param the request object
     */
    public mediationDefaultMediatorGet(param: MediationApiMediationDefaultMediatorGetRequest, options?: Configuration): Promise<MediationRecord> {
        return this.api.mediationDefaultMediatorGet( options).toPromise();
    }

    /**
     * Retrieve keylists by connection or role
     * @param param the request object
     */
    public mediationKeylistsGet(param: MediationApiMediationKeylistsGetRequest, options?: Configuration): Promise<Keylist> {
        return this.api.mediationKeylistsGet(param.connId, param.role,  options).toPromise();
    }

    /**
     * Send keylist query to mediator
     * @param param the request object
     */
    public mediationKeylistsMediationIdSendKeylistQueryPost(param: MediationApiMediationKeylistsMediationIdSendKeylistQueryPostRequest, options?: Configuration): Promise<KeylistQuery> {
        return this.api.mediationKeylistsMediationIdSendKeylistQueryPost(param.mediationId, param.paginateLimit, param.paginateOffset, param.body,  options).toPromise();
    }

    /**
     * Send keylist update to mediator
     * @param param the request object
     */
    public mediationKeylistsMediationIdSendKeylistUpdatePost(param: MediationApiMediationKeylistsMediationIdSendKeylistUpdatePostRequest, options?: Configuration): Promise<KeylistUpdate> {
        return this.api.mediationKeylistsMediationIdSendKeylistUpdatePost(param.mediationId, param.body,  options).toPromise();
    }

    /**
     * Set default mediator
     * @param param the request object
     */
    public mediationMediationIdDefaultMediatorPut(param: MediationApiMediationMediationIdDefaultMediatorPutRequest, options?: Configuration): Promise<MediationRecord> {
        return this.api.mediationMediationIdDefaultMediatorPut(param.mediationId,  options).toPromise();
    }

    /**
     * Request mediation from connection
     * @param param the request object
     */
    public mediationRequestConnIdPost(param: MediationApiMediationRequestConnIdPostRequest, options?: Configuration): Promise<MediationRecord> {
        return this.api.mediationRequestConnIdPost(param.connId, param.body,  options).toPromise();
    }

    /**
     * Query mediation requests, returns list of all mediation records
     * @param param the request object
     */
    public mediationRequestsGet(param: MediationApiMediationRequestsGetRequest, options?: Configuration): Promise<MediationList> {
        return this.api.mediationRequestsGet(param.connId, param.mediatorTerms, param.recipientTerms, param.state,  options).toPromise();
    }

    /**
     * Delete mediation request by ID
     * @param param the request object
     */
    public mediationRequestsMediationIdDelete(param: MediationApiMediationRequestsMediationIdDeleteRequest, options?: Configuration): Promise<MediationRecord> {
        return this.api.mediationRequestsMediationIdDelete(param.mediationId,  options).toPromise();
    }

    /**
     * Deny a stored mediation request
     * @param param the request object
     */
    public mediationRequestsMediationIdDenyPost(param: MediationApiMediationRequestsMediationIdDenyPostRequest, options?: Configuration): Promise<MediationDeny> {
        return this.api.mediationRequestsMediationIdDenyPost(param.mediationId, param.body,  options).toPromise();
    }

    /**
     * Retrieve mediation request record
     * @param param the request object
     */
    public mediationRequestsMediationIdGet(param: MediationApiMediationRequestsMediationIdGetRequest, options?: Configuration): Promise<MediationRecord> {
        return this.api.mediationRequestsMediationIdGet(param.mediationId,  options).toPromise();
    }

    /**
     * Grant received mediation
     * @param param the request object
     */
    public mediationRequestsMediationIdGrantPost(param: MediationApiMediationRequestsMediationIdGrantPostRequest, options?: Configuration): Promise<MediationGrant> {
        return this.api.mediationRequestsMediationIdGrantPost(param.mediationId,  options).toPromise();
    }

}

import { ObservableOutOfBandApi } from "./ObservableAPI";
import { OutOfBandApiRequestFactory, OutOfBandApiResponseProcessor} from "../apis/OutOfBandApi";

export interface OutOfBandApiOutOfBandCreateInvitationPostRequest {
    /**
     * Auto-accept connection (defaults to configuration)
     * @type string
     * @memberof OutOfBandApioutOfBandCreateInvitationPost
     */
    autoAccept?: string
    /**
     * Create invitation for multiple use (default false)
     * @type boolean
     * @memberof OutOfBandApioutOfBandCreateInvitationPost
     */
    multiUse?: boolean
    /**
     * 
     * @type InvitationCreateRequest
     * @memberof OutOfBandApioutOfBandCreateInvitationPost
     */
    body?: InvitationCreateRequest
}

export interface OutOfBandApiOutOfBandReceiveInvitationPostRequest {
    /**
     * Alias for connection
     * @type string
     * @memberof OutOfBandApioutOfBandReceiveInvitationPost
     */
    alias?: string
    /**
     * Auto-accept connection (defaults to configuration)
     * @type string
     * @memberof OutOfBandApioutOfBandReceiveInvitationPost
     */
    autoAccept?: string
    /**
     * Identifier for active mediation record to be used
     * @type string
     * @memberof OutOfBandApioutOfBandReceiveInvitationPost
     */
    mediationId?: string
    /**
     * Use an existing connection, if possible
     * @type boolean
     * @memberof OutOfBandApioutOfBandReceiveInvitationPost
     */
    useExistingConnection?: boolean
    /**
     * 
     * @type InvitationReceiveRequest
     * @memberof OutOfBandApioutOfBandReceiveInvitationPost
     */
    body?: InvitationReceiveRequest
}

export class ObjectOutOfBandApi {
    private api: ObservableOutOfBandApi

    public constructor(configuration: Configuration, requestFactory?: OutOfBandApiRequestFactory, responseProcessor?: OutOfBandApiResponseProcessor) {
        this.api = new ObservableOutOfBandApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Create a new connection invitation
     * @param param the request object
     */
    public outOfBandCreateInvitationPost(param: OutOfBandApiOutOfBandCreateInvitationPostRequest, options?: Configuration): Promise<InvitationRecord> {
        return this.api.outOfBandCreateInvitationPost(param.autoAccept, param.multiUse, param.body,  options).toPromise();
    }

    /**
     * Receive a new connection invitation
     * @param param the request object
     */
    public outOfBandReceiveInvitationPost(param: OutOfBandApiOutOfBandReceiveInvitationPostRequest, options?: Configuration): Promise<ConnRecord> {
        return this.api.outOfBandReceiveInvitationPost(param.alias, param.autoAccept, param.mediationId, param.useExistingConnection, param.body,  options).toPromise();
    }

}

import { ObservablePresentProofApi } from "./ObservableAPI";
import { PresentProofApiRequestFactory, PresentProofApiResponseProcessor} from "../apis/PresentProofApi";

export interface PresentProofApiPresentProofCreateRequestPostRequest {
    /**
     * 
     * @type V10PresentationCreateRequestRequest
     * @memberof PresentProofApipresentProofCreateRequestPost
     */
    body?: V10PresentationCreateRequestRequest
}

export interface PresentProofApiPresentProofRecordsGetRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsGet
     */
    connectionId?: string
    /**
     * Role assigned in presentation exchange
     * @type &#39;prover&#39; | &#39;verifier&#39;
     * @memberof PresentProofApipresentProofRecordsGet
     */
    role?: 'prover' | 'verifier'
    /**
     * Presentation exchange state
     * @type &#39;proposal_sent&#39; | &#39;proposal_received&#39; | &#39;request_sent&#39; | &#39;request_received&#39; | &#39;presentation_sent&#39; | &#39;presentation_received&#39; | &#39;verified&#39; | &#39;presentation_acked&#39;
     * @memberof PresentProofApipresentProofRecordsGet
     */
    state?: 'proposal_sent' | 'proposal_received' | 'request_sent' | 'request_received' | 'presentation_sent' | 'presentation_received' | 'verified' | 'presentation_acked'
    /**
     * Thread identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsGet
     */
    threadId?: string
}

export interface PresentProofApiPresentProofRecordsPresExIdCredentialsGetRequest {
    /**
     * Presentation exchange identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdCredentialsGet
     */
    presExId: string
    /**
     * Maximum number to retrieve
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdCredentialsGet
     */
    count?: string
    /**
     * (JSON) object mapping referents to extra WQL queries
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdCredentialsGet
     */
    extraQuery?: string
    /**
     * Proof request referents of interest, comma-separated
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdCredentialsGet
     */
    referent?: string
    /**
     * Start index
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdCredentialsGet
     */
    start?: string
}

export interface PresentProofApiPresentProofRecordsPresExIdDeleteRequest {
    /**
     * Presentation exchange identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdDelete
     */
    presExId: string
}

export interface PresentProofApiPresentProofRecordsPresExIdGetRequest {
    /**
     * Presentation exchange identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdGet
     */
    presExId: string
}

export interface PresentProofApiPresentProofRecordsPresExIdProblemReportPostRequest {
    /**
     * Presentation exchange identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdProblemReportPost
     */
    presExId: string
    /**
     * 
     * @type V10PresentationProblemReportRequest
     * @memberof PresentProofApipresentProofRecordsPresExIdProblemReportPost
     */
    body?: V10PresentationProblemReportRequest
}

export interface PresentProofApiPresentProofRecordsPresExIdSendPresentationPostRequest {
    /**
     * Presentation exchange identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdSendPresentationPost
     */
    presExId: string
    /**
     * 
     * @type V10PresentationRequest
     * @memberof PresentProofApipresentProofRecordsPresExIdSendPresentationPost
     */
    body?: V10PresentationRequest
}

export interface PresentProofApiPresentProofRecordsPresExIdSendRequestPostRequest {
    /**
     * Presentation exchange identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdSendRequestPost
     */
    presExId: string
    /**
     * 
     * @type AdminAPIMessageTracing
     * @memberof PresentProofApipresentProofRecordsPresExIdSendRequestPost
     */
    body?: AdminAPIMessageTracing
}

export interface PresentProofApiPresentProofRecordsPresExIdVerifyPresentationPostRequest {
    /**
     * Presentation exchange identifier
     * @type string
     * @memberof PresentProofApipresentProofRecordsPresExIdVerifyPresentationPost
     */
    presExId: string
}

export interface PresentProofApiPresentProofSendProposalPostRequest {
    /**
     * 
     * @type V10PresentationProposalRequest
     * @memberof PresentProofApipresentProofSendProposalPost
     */
    body?: V10PresentationProposalRequest
}

export interface PresentProofApiSendProofRequestRequest {
    /**
     * 
     * @type V10PresentationSendRequestRequest
     * @memberof PresentProofApisendProofRequest
     */
    body?: V10PresentationSendRequestRequest
}

export class ObjectPresentProofApi {
    private api: ObservablePresentProofApi

    public constructor(configuration: Configuration, requestFactory?: PresentProofApiRequestFactory, responseProcessor?: PresentProofApiResponseProcessor) {
        this.api = new ObservablePresentProofApi(configuration, requestFactory, responseProcessor);
    }

    /**
     *      Creates a presentation request not bound to any proposal or existing connection     
     * @param param the request object
     */
    public presentProofCreateRequestPost(param: PresentProofApiPresentProofCreateRequestPostRequest, options?: Configuration): Promise<V10PresentationExchange> {
        return this.api.presentProofCreateRequestPost(param.body,  options).toPromise();
    }

    /**
     * Fetch all present-proof exchange records
     * @param param the request object
     */
    public presentProofRecordsGet(param: PresentProofApiPresentProofRecordsGetRequest, options?: Configuration): Promise<V10PresentationExchangeList> {
        return this.api.presentProofRecordsGet(param.connectionId, param.role, param.state, param.threadId,  options).toPromise();
    }

    /**
     * Fetch credentials for a presentation request from wallet
     * @param param the request object
     */
    public presentProofRecordsPresExIdCredentialsGet(param: PresentProofApiPresentProofRecordsPresExIdCredentialsGetRequest, options?: Configuration): Promise<Array<IndyCredPrecis>> {
        return this.api.presentProofRecordsPresExIdCredentialsGet(param.presExId, param.count, param.extraQuery, param.referent, param.start,  options).toPromise();
    }

    /**
     * Remove an existing presentation exchange record
     * @param param the request object
     */
    public presentProofRecordsPresExIdDelete(param: PresentProofApiPresentProofRecordsPresExIdDeleteRequest, options?: Configuration): Promise<any> {
        return this.api.presentProofRecordsPresExIdDelete(param.presExId,  options).toPromise();
    }

    /**
     * Fetch a single presentation exchange record
     * @param param the request object
     */
    public presentProofRecordsPresExIdGet(param: PresentProofApiPresentProofRecordsPresExIdGetRequest, options?: Configuration): Promise<V10PresentationExchange> {
        return this.api.presentProofRecordsPresExIdGet(param.presExId,  options).toPromise();
    }

    /**
     * Send a problem report for presentation exchange
     * @param param the request object
     */
    public presentProofRecordsPresExIdProblemReportPost(param: PresentProofApiPresentProofRecordsPresExIdProblemReportPostRequest, options?: Configuration): Promise<any> {
        return this.api.presentProofRecordsPresExIdProblemReportPost(param.presExId, param.body,  options).toPromise();
    }

    /**
     * Sends a proof presentation
     * @param param the request object
     */
    public presentProofRecordsPresExIdSendPresentationPost(param: PresentProofApiPresentProofRecordsPresExIdSendPresentationPostRequest, options?: Configuration): Promise<V10PresentationExchange> {
        return this.api.presentProofRecordsPresExIdSendPresentationPost(param.presExId, param.body,  options).toPromise();
    }

    /**
     * Sends a presentation request in reference to a proposal
     * @param param the request object
     */
    public presentProofRecordsPresExIdSendRequestPost(param: PresentProofApiPresentProofRecordsPresExIdSendRequestPostRequest, options?: Configuration): Promise<V10PresentationExchange> {
        return this.api.presentProofRecordsPresExIdSendRequestPost(param.presExId, param.body,  options).toPromise();
    }

    /**
     * Verify a received presentation
     * @param param the request object
     */
    public presentProofRecordsPresExIdVerifyPresentationPost(param: PresentProofApiPresentProofRecordsPresExIdVerifyPresentationPostRequest, options?: Configuration): Promise<V10PresentationExchange> {
        return this.api.presentProofRecordsPresExIdVerifyPresentationPost(param.presExId,  options).toPromise();
    }

    /**
     * Sends a presentation proposal
     * @param param the request object
     */
    public presentProofSendProposalPost(param: PresentProofApiPresentProofSendProposalPostRequest, options?: Configuration): Promise<V10PresentationExchange> {
        return this.api.presentProofSendProposalPost(param.body,  options).toPromise();
    }

    /**
     * Sends a free presentation request not bound to any proposal
     * @param param the request object
     */
    public sendProofRequest(param: PresentProofApiSendProofRequestRequest, options?: Configuration): Promise<V10PresentationExchange> {
        return this.api.sendProofRequest(param.body,  options).toPromise();
    }

}

import { ObservableRevocationApi } from "./ObservableAPI";
import { RevocationApiRequestFactory, RevocationApiResponseProcessor} from "../apis/RevocationApi";

export interface RevocationApiPublishRevocationsRequest {
    /**
     * 
     * @type PublishRevocations
     * @memberof RevocationApipublishRevocations
     */
    body?: PublishRevocations
}

export interface RevocationApiRevocationActiveRegistryCredDefIdGetRequest {
    /**
     * Credential definition identifier
     * @type string
     * @memberof RevocationApirevocationActiveRegistryCredDefIdGet
     */
    credDefId: string
}

export interface RevocationApiRevocationClearPendingRevocationsPostRequest {
    /**
     * 
     * @type ClearPendingRevocationsRequest
     * @memberof RevocationApirevocationClearPendingRevocationsPost
     */
    body?: ClearPendingRevocationsRequest
}

export interface RevocationApiRevocationCreateRegistryPostRequest {
    /**
     * 
     * @type RevRegCreateRequest
     * @memberof RevocationApirevocationCreateRegistryPost
     */
    body?: RevRegCreateRequest
}

export interface RevocationApiRevocationCredentialRecordGetRequest {
    /**
     * Credential exchange identifier
     * @type string
     * @memberof RevocationApirevocationCredentialRecordGet
     */
    credExId?: string
    /**
     * Credential revocation identifier
     * @type string
     * @memberof RevocationApirevocationCredentialRecordGet
     */
    credRevId?: string
    /**
     * Revocation registry identifier
     * @type string
     * @memberof RevocationApirevocationCredentialRecordGet
     */
    revRegId?: string
}

export interface RevocationApiRevocationRegistriesCreatedGetRequest {
    /**
     * Credential definition identifier
     * @type string
     * @memberof RevocationApirevocationRegistriesCreatedGet
     */
    credDefId?: string
    /**
     * Revocation registry state
     * @type &#39;init&#39; | &#39;generated&#39; | &#39;posted&#39; | &#39;active&#39; | &#39;full&#39;
     * @memberof RevocationApirevocationRegistriesCreatedGet
     */
    state?: 'init' | 'generated' | 'posted' | 'active' | 'full'
}

export interface RevocationApiRevocationRegistryRevRegIdDefinitionPostRequest {
    /**
     * Revocation Registry identifier
     * @type string
     * @memberof RevocationApirevocationRegistryRevRegIdDefinitionPost
     */
    revRegId: string
}

export interface RevocationApiRevocationRegistryRevRegIdEntryPostRequest {
    /**
     * Revocation Registry identifier
     * @type string
     * @memberof RevocationApirevocationRegistryRevRegIdEntryPost
     */
    revRegId: string
}

export interface RevocationApiRevocationRegistryRevRegIdGetRequest {
    /**
     * Revocation Registry identifier
     * @type string
     * @memberof RevocationApirevocationRegistryRevRegIdGet
     */
    revRegId: string
}

export interface RevocationApiRevocationRegistryRevRegIdIssuedGetRequest {
    /**
     * Revocation Registry identifier
     * @type string
     * @memberof RevocationApirevocationRegistryRevRegIdIssuedGet
     */
    revRegId: string
}

export interface RevocationApiRevocationRegistryRevRegIdPatchRequest {
    /**
     * Revocation Registry identifier
     * @type string
     * @memberof RevocationApirevocationRegistryRevRegIdPatch
     */
    revRegId: string
    /**
     * 
     * @type RevRegUpdateTailsFileUri
     * @memberof RevocationApirevocationRegistryRevRegIdPatch
     */
    body?: RevRegUpdateTailsFileUri
}

export interface RevocationApiRevocationRegistryRevRegIdSetStatePatchRequest {
    /**
     * Revocation Registry identifier
     * @type string
     * @memberof RevocationApirevocationRegistryRevRegIdSetStatePatch
     */
    revRegId: string
    /**
     * Revocation registry state to set
     * @type &#39;init&#39; | &#39;generated&#39; | &#39;posted&#39; | &#39;active&#39; | &#39;full&#39;
     * @memberof RevocationApirevocationRegistryRevRegIdSetStatePatch
     */
    state: 'init' | 'generated' | 'posted' | 'active' | 'full'
}

export interface RevocationApiRevocationRegistryRevRegIdTailsFileGetRequest {
    /**
     * Revocation Registry identifier
     * @type string
     * @memberof RevocationApirevocationRegistryRevRegIdTailsFileGet
     */
    revRegId: string
}

export interface RevocationApiRevocationRegistryRevRegIdTailsFilePutRequest {
    /**
     * Revocation Registry identifier
     * @type string
     * @memberof RevocationApirevocationRegistryRevRegIdTailsFilePut
     */
    revRegId: string
}

export interface RevocationApiRevokeCredentialRequest {
    /**
     * 
     * @type RevokeRequest
     * @memberof RevocationApirevokeCredential
     */
    body?: RevokeRequest
}

export class ObjectRevocationApi {
    private api: ObservableRevocationApi

    public constructor(configuration: Configuration, requestFactory?: RevocationApiRequestFactory, responseProcessor?: RevocationApiResponseProcessor) {
        this.api = new ObservableRevocationApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Publish pending revocations to ledger
     * @param param the request object
     */
    public publishRevocations(param: RevocationApiPublishRevocationsRequest, options?: Configuration): Promise<PublishRevocations> {
        return this.api.publishRevocations(param.body,  options).toPromise();
    }

    /**
     * Get current active revocation registry by credential definition id
     * @param param the request object
     */
    public revocationActiveRegistryCredDefIdGet(param: RevocationApiRevocationActiveRegistryCredDefIdGetRequest, options?: Configuration): Promise<any> {
        return this.api.revocationActiveRegistryCredDefIdGet(param.credDefId,  options).toPromise();
    }

    /**
     * Clear pending revocations
     * @param param the request object
     */
    public revocationClearPendingRevocationsPost(param: RevocationApiRevocationClearPendingRevocationsPostRequest, options?: Configuration): Promise<PublishRevocations> {
        return this.api.revocationClearPendingRevocationsPost(param.body,  options).toPromise();
    }

    /**
     * Creates a new revocation registry
     * @param param the request object
     */
    public revocationCreateRegistryPost(param: RevocationApiRevocationCreateRegistryPostRequest, options?: Configuration): Promise<any> {
        return this.api.revocationCreateRegistryPost(param.body,  options).toPromise();
    }

    /**
     * Get credential revocation status
     * @param param the request object
     */
    public revocationCredentialRecordGet(param: RevocationApiRevocationCredentialRecordGetRequest, options?: Configuration): Promise<any> {
        return this.api.revocationCredentialRecordGet(param.credExId, param.credRevId, param.revRegId,  options).toPromise();
    }

    /**
     * Search for matching revocation registries that current agent created
     * @param param the request object
     */
    public revocationRegistriesCreatedGet(param: RevocationApiRevocationRegistriesCreatedGetRequest, options?: Configuration): Promise<RevRegsCreated> {
        return this.api.revocationRegistriesCreatedGet(param.credDefId, param.state,  options).toPromise();
    }

    /**
     * Send revocation registry definition to ledger
     * @param param the request object
     */
    public revocationRegistryRevRegIdDefinitionPost(param: RevocationApiRevocationRegistryRevRegIdDefinitionPostRequest, options?: Configuration): Promise<any> {
        return this.api.revocationRegistryRevRegIdDefinitionPost(param.revRegId,  options).toPromise();
    }

    /**
     * Send revocation registry entry to ledger
     * @param param the request object
     */
    public revocationRegistryRevRegIdEntryPost(param: RevocationApiRevocationRegistryRevRegIdEntryPostRequest, options?: Configuration): Promise<any> {
        return this.api.revocationRegistryRevRegIdEntryPost(param.revRegId,  options).toPromise();
    }

    /**
     * Get revocation registry by revocation registry id
     * @param param the request object
     */
    public revocationRegistryRevRegIdGet(param: RevocationApiRevocationRegistryRevRegIdGetRequest, options?: Configuration): Promise<any> {
        return this.api.revocationRegistryRevRegIdGet(param.revRegId,  options).toPromise();
    }

    /**
     * Get number of credentials issued against revocation registry
     * @param param the request object
     */
    public revocationRegistryRevRegIdIssuedGet(param: RevocationApiRevocationRegistryRevRegIdIssuedGetRequest, options?: Configuration): Promise<RevRegIssuedResult> {
        return this.api.revocationRegistryRevRegIdIssuedGet(param.revRegId,  options).toPromise();
    }

    /**
     * Update revocation registry with new public URI to its tails file
     * @param param the request object
     */
    public revocationRegistryRevRegIdPatch(param: RevocationApiRevocationRegistryRevRegIdPatchRequest, options?: Configuration): Promise<any> {
        return this.api.revocationRegistryRevRegIdPatch(param.revRegId, param.body,  options).toPromise();
    }

    /**
     * Set revocation registry state manually
     * @param param the request object
     */
    public revocationRegistryRevRegIdSetStatePatch(param: RevocationApiRevocationRegistryRevRegIdSetStatePatchRequest, options?: Configuration): Promise<any> {
        return this.api.revocationRegistryRevRegIdSetStatePatch(param.revRegId, param.state,  options).toPromise();
    }

    /**
     * Download tails file
     * @param param the request object
     */
    public revocationRegistryRevRegIdTailsFileGet(param: RevocationApiRevocationRegistryRevRegIdTailsFileGetRequest, options?: Configuration): Promise<HttpFile> {
        return this.api.revocationRegistryRevRegIdTailsFileGet(param.revRegId,  options).toPromise();
    }

    /**
     * Upload local tails file to server
     * @param param the request object
     */
    public revocationRegistryRevRegIdTailsFilePut(param: RevocationApiRevocationRegistryRevRegIdTailsFilePutRequest, options?: Configuration): Promise<any> {
        return this.api.revocationRegistryRevRegIdTailsFilePut(param.revRegId,  options).toPromise();
    }

    /**
     * Revoke an issued credential
     * @param param the request object
     */
    public revokeCredential(param: RevocationApiRevokeCredentialRequest, options?: Configuration): Promise<any> {
        return this.api.revokeCredential(param.body,  options).toPromise();
    }

}

import { ObservableSchemaApi } from "./ObservableAPI";
import { SchemaApiRequestFactory, SchemaApiResponseProcessor} from "../apis/SchemaApi";

export interface SchemaApiPublishSchemaRequest {
    /**
     * 
     * @type SchemaSendRequest
     * @memberof SchemaApipublishSchema
     */
    body?: SchemaSendRequest
}

export interface SchemaApiSchemasCreatedGetRequest {
    /**
     * Schema identifier
     * @type string
     * @memberof SchemaApischemasCreatedGet
     */
    schemaId?: string
    /**
     * Schema issuer DID
     * @type string
     * @memberof SchemaApischemasCreatedGet
     */
    schemaIssuerDid?: string
    /**
     * Schema name
     * @type string
     * @memberof SchemaApischemasCreatedGet
     */
    schemaName?: string
    /**
     * Schema version
     * @type string
     * @memberof SchemaApischemasCreatedGet
     */
    schemaVersion?: string
}

export interface SchemaApiSchemasSchemaIdGetRequest {
    /**
     * Schema identifier
     * @type string
     * @memberof SchemaApischemasSchemaIdGet
     */
    schemaId: string
}

export class ObjectSchemaApi {
    private api: ObservableSchemaApi

    public constructor(configuration: Configuration, requestFactory?: SchemaApiRequestFactory, responseProcessor?: SchemaApiResponseProcessor) {
        this.api = new ObservableSchemaApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Sends a schema to the ledger
     * @param param the request object
     */
    public publishSchema(param: SchemaApiPublishSchemaRequest, options?: Configuration): Promise<SchemaSendResults> {
        return this.api.publishSchema(param.body,  options).toPromise();
    }

    /**
     * Search for matching schema that agent originated
     * @param param the request object
     */
    public schemasCreatedGet(param: SchemaApiSchemasCreatedGetRequest, options?: Configuration): Promise<SchemasCreatedResults> {
        return this.api.schemasCreatedGet(param.schemaId, param.schemaIssuerDid, param.schemaName, param.schemaVersion,  options).toPromise();
    }

    /**
     * Gets a schema from the ledger
     * @param param the request object
     */
    public schemasSchemaIdGet(param: SchemaApiSchemasSchemaIdGetRequest, options?: Configuration): Promise<SchemaGetResults> {
        return this.api.schemasSchemaIdGet(param.schemaId,  options).toPromise();
    }

}

import { ObservableServerApi } from "./ObservableAPI";
import { ServerApiRequestFactory, ServerApiResponseProcessor} from "../apis/ServerApi";

export interface ServerApiFeaturesGetRequest {
    /**
     * Query
     * @type string
     * @memberof ServerApifeaturesGet
     */
    query?: string
}

export interface ServerApiPluginsGetRequest {
}

export interface ServerApiShutdownGetRequest {
}

export interface ServerApiStatusGetRequest {
}

export interface ServerApiStatusLiveGetRequest {
}

export interface ServerApiStatusReadyGetRequest {
}

export interface ServerApiStatusResetPostRequest {
}

export class ObjectServerApi {
    private api: ObservableServerApi

    public constructor(configuration: Configuration, requestFactory?: ServerApiRequestFactory, responseProcessor?: ServerApiResponseProcessor) {
        this.api = new ObservableServerApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Query supported features
     * @param param the request object
     */
    public featuresGet(param: ServerApiFeaturesGetRequest, options?: Configuration): Promise<QueryResult> {
        return this.api.featuresGet(param.query,  options).toPromise();
    }

    /**
     * Fetch the list of loaded plugins
     * @param param the request object
     */
    public pluginsGet(param: ServerApiPluginsGetRequest, options?: Configuration): Promise<AdminModules> {
        return this.api.pluginsGet( options).toPromise();
    }

    /**
     * Shut down server
     * @param param the request object
     */
    public shutdownGet(param: ServerApiShutdownGetRequest, options?: Configuration): Promise<any> {
        return this.api.shutdownGet( options).toPromise();
    }

    /**
     * Fetch the server status
     * @param param the request object
     */
    public statusGet(param: ServerApiStatusGetRequest, options?: Configuration): Promise<any> {
        return this.api.statusGet( options).toPromise();
    }

    /**
     * Liveliness check
     * @param param the request object
     */
    public statusLiveGet(param: ServerApiStatusLiveGetRequest, options?: Configuration): Promise<AdminStatusLiveliness> {
        return this.api.statusLiveGet( options).toPromise();
    }

    /**
     * Readiness check
     * @param param the request object
     */
    public statusReadyGet(param: ServerApiStatusReadyGetRequest, options?: Configuration): Promise<AdminStatusReadiness> {
        return this.api.statusReadyGet( options).toPromise();
    }

    /**
     * Reset statistics
     * @param param the request object
     */
    public statusResetPost(param: ServerApiStatusResetPostRequest, options?: Configuration): Promise<any> {
        return this.api.statusResetPost( options).toPromise();
    }

}

import { ObservableTrustpingApi } from "./ObservableAPI";
import { TrustpingApiRequestFactory, TrustpingApiResponseProcessor} from "../apis/TrustpingApi";

export interface TrustpingApiConnectionsConnIdSendPingPostRequest {
    /**
     * Connection identifier
     * @type string
     * @memberof TrustpingApiconnectionsConnIdSendPingPost
     */
    connId: string
    /**
     * 
     * @type PingRequest
     * @memberof TrustpingApiconnectionsConnIdSendPingPost
     */
    body?: PingRequest
}

export class ObjectTrustpingApi {
    private api: ObservableTrustpingApi

    public constructor(configuration: Configuration, requestFactory?: TrustpingApiRequestFactory, responseProcessor?: TrustpingApiResponseProcessor) {
        this.api = new ObservableTrustpingApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Send a trust ping to a connection
     * @param param the request object
     */
    public connectionsConnIdSendPingPost(param: TrustpingApiConnectionsConnIdSendPingPostRequest, options?: Configuration): Promise<PingRequestResponse> {
        return this.api.connectionsConnIdSendPingPost(param.connId, param.body,  options).toPromise();
    }

}

import { ObservableWalletApi } from "./ObservableAPI";
import { WalletApiRequestFactory, WalletApiResponseProcessor} from "../apis/WalletApi";

export interface WalletApiCreateDidRequest {
}

export interface WalletApiSetPublicDidRequest {
    /**
     * DID of interest
     * @type string
     * @memberof WalletApisetPublicDid
     */
    did: string
}

export interface WalletApiWalletDidGetRequest {
    /**
     * DID of interest
     * @type string
     * @memberof WalletApiwalletDidGet
     */
    did?: string
    /**
     * Whether DID is current public DID, posted to ledger but current public DID, or local to the wallet
     * @type &#39;public&#39; | &#39;posted&#39; | &#39;wallet_only&#39;
     * @memberof WalletApiwalletDidGet
     */
    posture?: 'public' | 'posted' | 'wallet_only'
    /**
     * Verification key of interest
     * @type string
     * @memberof WalletApiwalletDidGet
     */
    verkey?: string
}

export interface WalletApiWalletDidLocalRotateKeypairPatchRequest {
    /**
     * DID of interest
     * @type string
     * @memberof WalletApiwalletDidLocalRotateKeypairPatch
     */
    did: string
}

export interface WalletApiWalletDidPublicGetRequest {
}

export interface WalletApiWalletGetDidEndpointGetRequest {
    /**
     * DID of interest
     * @type string
     * @memberof WalletApiwalletGetDidEndpointGet
     */
    did: string
}

export interface WalletApiWalletSetDidEndpointPostRequest {
    /**
     * 
     * @type DIDEndpointWithType
     * @memberof WalletApiwalletSetDidEndpointPost
     */
    body?: DIDEndpointWithType
}

export class ObjectWalletApi {
    private api: ObservableWalletApi

    public constructor(configuration: Configuration, requestFactory?: WalletApiRequestFactory, responseProcessor?: WalletApiResponseProcessor) {
        this.api = new ObservableWalletApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * Create a local DID
     * @param param the request object
     */
    public createDid(param: WalletApiCreateDidRequest, options?: Configuration): Promise<DIDResult> {
        return this.api.createDid( options).toPromise();
    }

    /**
     * Assign the current public DID
     * @param param the request object
     */
    public setPublicDid(param: WalletApiSetPublicDidRequest, options?: Configuration): Promise<DIDResult> {
        return this.api.setPublicDid(param.did,  options).toPromise();
    }

    /**
     * List wallet DIDs
     * @param param the request object
     */
    public walletDidGet(param: WalletApiWalletDidGetRequest, options?: Configuration): Promise<DIDList> {
        return this.api.walletDidGet(param.did, param.posture, param.verkey,  options).toPromise();
    }

    /**
     * Rotate keypair for a DID not posted to the ledger
     * @param param the request object
     */
    public walletDidLocalRotateKeypairPatch(param: WalletApiWalletDidLocalRotateKeypairPatchRequest, options?: Configuration): Promise<any> {
        return this.api.walletDidLocalRotateKeypairPatch(param.did,  options).toPromise();
    }

    /**
     * Fetch the current public DID
     * @param param the request object
     */
    public walletDidPublicGet(param: WalletApiWalletDidPublicGetRequest, options?: Configuration): Promise<DIDResult> {
        return this.api.walletDidPublicGet( options).toPromise();
    }

    /**
     * Query DID endpoint in wallet
     * @param param the request object
     */
    public walletGetDidEndpointGet(param: WalletApiWalletGetDidEndpointGetRequest, options?: Configuration): Promise<DIDEndpoint> {
        return this.api.walletGetDidEndpointGet(param.did,  options).toPromise();
    }

    /**
     * Update endpoint in wallet and on ledger if posted to it
     * @param param the request object
     */
    public walletSetDidEndpointPost(param: WalletApiWalletSetDidEndpointPostRequest, options?: Configuration): Promise<any> {
        return this.api.walletSetDidEndpointPost(param.body,  options).toPromise();
    }

}
