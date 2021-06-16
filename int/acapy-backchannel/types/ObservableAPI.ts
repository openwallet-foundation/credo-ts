import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration} from '../configuration'
import { Observable, of, from } from '../rxjsStub';
import {mergeMap, map} from  '../rxjsStub';
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

import { ActionMenuApiRequestFactory, ActionMenuApiResponseProcessor} from "../apis/ActionMenuApi";
export class ObservableActionMenuApi {
    private requestFactory: ActionMenuApiRequestFactory;
    private responseProcessor: ActionMenuApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: ActionMenuApiRequestFactory,
        responseProcessor?: ActionMenuApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new ActionMenuApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new ActionMenuApiResponseProcessor();
    }

    /**
     * Close the active menu associated with a connection
     * @param connId Connection identifier
     */
    public actionMenuConnIdClosePost(connId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.actionMenuConnIdClosePost(connId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.actionMenuConnIdClosePost(rsp)));
            }));
    }
 
    /**
     * Fetch the active menu
     * @param connId Connection identifier
     */
    public actionMenuConnIdFetchPost(connId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.actionMenuConnIdFetchPost(connId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.actionMenuConnIdFetchPost(rsp)));
            }));
    }
 
    /**
     * Perform an action associated with the active menu
     * @param connId Connection identifier
     * @param body 
     */
    public actionMenuConnIdPerformPost(connId: string, body?: PerformRequest, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.actionMenuConnIdPerformPost(connId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.actionMenuConnIdPerformPost(rsp)));
            }));
    }
 
    /**
     * Request the active menu
     * @param connId Connection identifier
     */
    public actionMenuConnIdRequestPost(connId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.actionMenuConnIdRequestPost(connId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.actionMenuConnIdRequestPost(rsp)));
            }));
    }
 
    /**
     * Send an action menu to a connection
     * @param connId Connection identifier
     * @param body 
     */
    public actionMenuConnIdSendMenuPost(connId: string, body?: SendMenu, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.actionMenuConnIdSendMenuPost(connId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.actionMenuConnIdSendMenuPost(rsp)));
            }));
    }
 
}

import { BasicmessageApiRequestFactory, BasicmessageApiResponseProcessor} from "../apis/BasicmessageApi";
export class ObservableBasicmessageApi {
    private requestFactory: BasicmessageApiRequestFactory;
    private responseProcessor: BasicmessageApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: BasicmessageApiRequestFactory,
        responseProcessor?: BasicmessageApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new BasicmessageApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new BasicmessageApiResponseProcessor();
    }

    /**
     * Send a basic message to a connection
     * @param connId Connection identifier
     * @param body 
     */
    public connectionsConnIdSendMessagePost(connId: string, body?: SendMessage, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.connectionsConnIdSendMessagePost(connId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.connectionsConnIdSendMessagePost(rsp)));
            }));
    }
 
}

import { ConnectionApiRequestFactory, ConnectionApiResponseProcessor} from "../apis/ConnectionApi";
export class ObservableConnectionApi {
    private requestFactory: ConnectionApiRequestFactory;
    private responseProcessor: ConnectionApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: ConnectionApiRequestFactory,
        responseProcessor?: ConnectionApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new ConnectionApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new ConnectionApiResponseProcessor();
    }

    /**
     * Accept a stored connection invitation
     * @param connId Connection identifier
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection
     */
    public connectionsConnIdAcceptInvitationPost(connId: string, mediationId?: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Observable<ConnRecord> {
        const requestContextPromise = this.requestFactory.connectionsConnIdAcceptInvitationPost(connId, mediationId, myEndpoint, myLabel, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.connectionsConnIdAcceptInvitationPost(rsp)));
            }));
    }
 
    /**
     * Accept a stored connection request
     * @param connId Connection identifier
     * @param myEndpoint My URL endpoint
     */
    public connectionsConnIdAcceptRequestPost(connId: string, myEndpoint?: string, options?: Configuration): Observable<ConnRecord> {
        const requestContextPromise = this.requestFactory.connectionsConnIdAcceptRequestPost(connId, myEndpoint, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.connectionsConnIdAcceptRequestPost(rsp)));
            }));
    }
 
    /**
     * Fetch connection remote endpoint
     * @param connId Connection identifier
     */
    public connectionsConnIdEndpointsGet(connId: string, options?: Configuration): Observable<EndpointsResult> {
        const requestContextPromise = this.requestFactory.connectionsConnIdEndpointsGet(connId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.connectionsConnIdEndpointsGet(rsp)));
            }));
    }
 
    /**
     * Assign another connection as the inbound connection
     * @param connId Connection identifier
     * @param refId Inbound connection identifier
     */
    public connectionsConnIdEstablishInboundRefIdPost(connId: string, refId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.connectionsConnIdEstablishInboundRefIdPost(connId, refId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.connectionsConnIdEstablishInboundRefIdPost(rsp)));
            }));
    }
 
    /**
     * Create a new connection invitation
     * @param alias Alias
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param multiUse Create invitation for multiple use (default false)
     * @param _public Create invitation from public DID (default false)
     * @param body 
     */
    public createInvitation(alias?: string, autoAccept?: string, multiUse?: boolean, _public?: boolean, body?: CreateInvitationRequest, options?: Configuration): Observable<InvitationResult> {
        const requestContextPromise = this.requestFactory.createInvitation(alias, autoAccept, multiUse, _public, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.createInvitation(rsp)));
            }));
    }
 
    /**
     * Create a new static connection
     * @param body 
     */
    public createStatic(body?: ConnectionStaticRequest, options?: Configuration): Observable<ConnectionStaticResult> {
        const requestContextPromise = this.requestFactory.createStatic(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.createStatic(rsp)));
            }));
    }
 
    /**
     * Remove an existing connection record
     * @param connId Connection identifier
     */
    public deleteConnection(connId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.deleteConnection(connId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.deleteConnection(rsp)));
            }));
    }
 
    /**
     * Fetch a single connection record
     * @param connId Connection identifier
     */
    public getConnection(connId: string, options?: Configuration): Observable<ConnRecord> {
        const requestContextPromise = this.requestFactory.getConnection(connId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.getConnection(rsp)));
            }));
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
    public getConnections(alias?: string, invitationKey?: string, myDid?: string, state?: 'start' | 'error' | 'response' | 'init' | 'abandoned' | 'active' | 'request' | 'invitation' | 'completed', theirDid?: string, theirRole?: 'invitee' | 'requester' | 'inviter' | 'responder', options?: Configuration): Observable<ConnectionList> {
        const requestContextPromise = this.requestFactory.getConnections(alias, invitationKey, myDid, state, theirDid, theirRole, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.getConnections(rsp)));
            }));
    }
 
    /**
     * Fetch connection metadata
     * @param connId Connection identifier
     * @param key Key to retrieve.
     */
    public getMetadata(connId: string, key?: string, options?: Configuration): Observable<ConnectionMetadata> {
        const requestContextPromise = this.requestFactory.getMetadata(connId, key, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.getMetadata(rsp)));
            }));
    }
 
    /**
     * Receive a new connection invitation
     * @param alias Alias
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param body 
     */
    public receiveInvitation(alias?: string, autoAccept?: string, mediationId?: string, body?: ReceiveInvitationRequest, options?: Configuration): Observable<ConnRecord> {
        const requestContextPromise = this.requestFactory.receiveInvitation(alias, autoAccept, mediationId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.receiveInvitation(rsp)));
            }));
    }
 
    /**
     * Set connection metadata
     * @param connId Connection identifier
     * @param body 
     */
    public setMetadata(connId: string, body?: ConnectionMetadataSetRequest, options?: Configuration): Observable<ConnectionMetadata> {
        const requestContextPromise = this.requestFactory.setMetadata(connId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.setMetadata(rsp)));
            }));
    }
 
}

import { CredentialDefinitionApiRequestFactory, CredentialDefinitionApiResponseProcessor} from "../apis/CredentialDefinitionApi";
export class ObservableCredentialDefinitionApi {
    private requestFactory: CredentialDefinitionApiRequestFactory;
    private responseProcessor: CredentialDefinitionApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: CredentialDefinitionApiRequestFactory,
        responseProcessor?: CredentialDefinitionApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new CredentialDefinitionApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new CredentialDefinitionApiResponseProcessor();
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
    public credentialDefinitionsCreatedGet(credDefId?: string, issuerDid?: string, schemaId?: string, schemaIssuerDid?: string, schemaName?: string, schemaVersion?: string, options?: Configuration): Observable<CredentialDefinitionsCreatedResults> {
        const requestContextPromise = this.requestFactory.credentialDefinitionsCreatedGet(credDefId, issuerDid, schemaId, schemaIssuerDid, schemaName, schemaVersion, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.credentialDefinitionsCreatedGet(rsp)));
            }));
    }
 
    /**
     * Gets a credential definition from the ledger
     * @param credDefId Credential definition identifier
     */
    public credentialDefinitionsCredDefIdGet(credDefId: string, options?: Configuration): Observable<CredentialDefinitionGetResults> {
        const requestContextPromise = this.requestFactory.credentialDefinitionsCredDefIdGet(credDefId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.credentialDefinitionsCredDefIdGet(rsp)));
            }));
    }
 
    /**
     * Sends a credential definition to the ledger
     * @param body 
     */
    public publishCredDef(body?: CredentialDefinitionSendRequest, options?: Configuration): Observable<CredentialDefinitionSendResults> {
        const requestContextPromise = this.requestFactory.publishCredDef(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.publishCredDef(rsp)));
            }));
    }
 
}

import { CredentialsApiRequestFactory, CredentialsApiResponseProcessor} from "../apis/CredentialsApi";
export class ObservableCredentialsApi {
    private requestFactory: CredentialsApiRequestFactory;
    private responseProcessor: CredentialsApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: CredentialsApiRequestFactory,
        responseProcessor?: CredentialsApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new CredentialsApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new CredentialsApiResponseProcessor();
    }

    /**
     * Remove a credential from the wallet by id
     * @param credentialId Credential identifier
     */
    public credentialCredentialIdDelete(credentialId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.credentialCredentialIdDelete(credentialId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.credentialCredentialIdDelete(rsp)));
            }));
    }
 
    /**
     * Fetch a credential from wallet by id
     * @param credentialId Credential identifier
     */
    public credentialCredentialIdGet(credentialId: string, options?: Configuration): Observable<CredBrief> {
        const requestContextPromise = this.requestFactory.credentialCredentialIdGet(credentialId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.credentialCredentialIdGet(rsp)));
            }));
    }
 
    /**
     * Get attribute MIME types from wallet
     * @param credentialId Credential identifier
     */
    public credentialMimeTypesCredentialIdGet(credentialId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.credentialMimeTypesCredentialIdGet(credentialId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.credentialMimeTypesCredentialIdGet(rsp)));
            }));
    }
 
    /**
     * Query credential revocation status by id
     * @param credentialId Credential identifier
     * @param from Earliest epoch of revocation status interval of interest
     * @param to Latest epoch of revocation status interval of interest
     */
    public credentialRevokedCredentialIdGet(credentialId: string, from?: string, to?: string, options?: Configuration): Observable<CredRevokedResult> {
        const requestContextPromise = this.requestFactory.credentialRevokedCredentialIdGet(credentialId, from, to, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.credentialRevokedCredentialIdGet(rsp)));
            }));
    }
 
    /**
     * Fetch credentials from wallet
     * @param count Maximum number to retrieve
     * @param start Start index
     * @param wql (JSON) WQL query
     */
    public credentialsGet(count?: string, start?: string, wql?: string, options?: Configuration): Observable<CredBriefList> {
        const requestContextPromise = this.requestFactory.credentialsGet(count, start, wql, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.credentialsGet(rsp)));
            }));
    }
 
}

import { DidExchangeApiRequestFactory, DidExchangeApiResponseProcessor} from "../apis/DidExchangeApi";
export class ObservableDidExchangeApi {
    private requestFactory: DidExchangeApiRequestFactory;
    private responseProcessor: DidExchangeApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: DidExchangeApiRequestFactory,
        responseProcessor?: DidExchangeApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new DidExchangeApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new DidExchangeApiResponseProcessor();
    }

    /**
     * Accept a stored connection invitation
     * @param connId Connection identifier
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection request
     */
    public didexchangeConnIdAcceptInvitationPost(connId: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Observable<ConnRecord> {
        const requestContextPromise = this.requestFactory.didexchangeConnIdAcceptInvitationPost(connId, myEndpoint, myLabel, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.didexchangeConnIdAcceptInvitationPost(rsp)));
            }));
    }
 
    /**
     * Accept a stored connection request
     * @param connId Connection identifier
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     */
    public didexchangeConnIdAcceptRequestPost(connId: string, mediationId?: string, myEndpoint?: string, options?: Configuration): Observable<ConnRecord> {
        const requestContextPromise = this.requestFactory.didexchangeConnIdAcceptRequestPost(connId, mediationId, myEndpoint, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.didexchangeConnIdAcceptRequestPost(rsp)));
            }));
    }
 
    /**
     * Create request against public DID's implicit invitation
     * @param theirPublicDid Public DID to which to request connection
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection request
     */
    public didexchangeCreateRequestPost(theirPublicDid: string, mediationId?: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Observable<DIDXRequest> {
        const requestContextPromise = this.requestFactory.didexchangeCreateRequestPost(theirPublicDid, mediationId, myEndpoint, myLabel, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.didexchangeCreateRequestPost(rsp)));
            }));
    }
 
    /**
     * Receive request against public DID's implicit invitation
     * @param alias Alias for connection
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param body 
     */
    public didexchangeReceiveRequestPost(alias?: string, autoAccept?: string, mediationId?: string, myEndpoint?: string, body?: DIDXRequest, options?: Configuration): Observable<ConnRecord> {
        const requestContextPromise = this.requestFactory.didexchangeReceiveRequestPost(alias, autoAccept, mediationId, myEndpoint, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.didexchangeReceiveRequestPost(rsp)));
            }));
    }
 
}

import { IntroductionApiRequestFactory, IntroductionApiResponseProcessor} from "../apis/IntroductionApi";
export class ObservableIntroductionApi {
    private requestFactory: IntroductionApiRequestFactory;
    private responseProcessor: IntroductionApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: IntroductionApiRequestFactory,
        responseProcessor?: IntroductionApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new IntroductionApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new IntroductionApiResponseProcessor();
    }

    /**
     * Start an introduction between two connections
     * @param connId Connection identifier
     * @param targetConnectionId Target connection identifier
     * @param message Message
     */
    public connectionsConnIdStartIntroductionPost(connId: string, targetConnectionId: string, message?: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.connectionsConnIdStartIntroductionPost(connId, targetConnectionId, message, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.connectionsConnIdStartIntroductionPost(rsp)));
            }));
    }
 
}

import { IssueCredentialV10ApiRequestFactory, IssueCredentialV10ApiResponseProcessor} from "../apis/IssueCredentialV10Api";
export class ObservableIssueCredentialV10Api {
    private requestFactory: IssueCredentialV10ApiRequestFactory;
    private responseProcessor: IssueCredentialV10ApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: IssueCredentialV10ApiRequestFactory,
        responseProcessor?: IssueCredentialV10ApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new IssueCredentialV10ApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new IssueCredentialV10ApiResponseProcessor();
    }

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public issueCredentialAutomated(body?: V10CredentialProposalRequestMand, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialAutomated(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialAutomated(rsp)));
            }));
    }
 
    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public issueCredentialCreatePost(body?: V10CredentialCreate, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialCreatePost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialCreatePost(rsp)));
            }));
    }
 
    /**
     * Remove an existing credential exchange record
     * @param credExId Credential exchange identifier
     */
    public issueCredentialRecordsCredExIdDelete(credExId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.issueCredentialRecordsCredExIdDelete(credExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialRecordsCredExIdDelete(rsp)));
            }));
    }
 
    /**
     * Fetch a single credential exchange record
     * @param credExId Credential exchange identifier
     */
    public issueCredentialRecordsCredExIdGet(credExId: string, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialRecordsCredExIdGet(credExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialRecordsCredExIdGet(rsp)));
            }));
    }
 
    /**
     * Send holder a credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredentialRecordsCredExIdIssuePost(credExId: string, body?: V10CredentialIssueRequest, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialRecordsCredExIdIssuePost(credExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialRecordsCredExIdIssuePost(rsp)));
            }));
    }
 
    /**
     * Send a problem report for credential exchange
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredentialRecordsCredExIdProblemReportPost(credExId: string, body?: V10CredentialProblemReportRequest, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.issueCredentialRecordsCredExIdProblemReportPost(credExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialRecordsCredExIdProblemReportPost(rsp)));
            }));
    }
 
    /**
     * Send holder a credential offer in reference to a proposal with preview
     * @param credExId Credential exchange identifier
     */
    public issueCredentialRecordsCredExIdSendOfferPost(credExId: string, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialRecordsCredExIdSendOfferPost(credExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialRecordsCredExIdSendOfferPost(rsp)));
            }));
    }
 
    /**
     * Send issuer a credential request
     * @param credExId Credential exchange identifier
     */
    public issueCredentialRecordsCredExIdSendRequestPost(credExId: string, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialRecordsCredExIdSendRequestPost(credExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialRecordsCredExIdSendRequestPost(rsp)));
            }));
    }
 
    /**
     * Store a received credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredentialRecordsCredExIdStorePost(credExId: string, body?: V10CredentialStoreRequest, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialRecordsCredExIdStorePost(credExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialRecordsCredExIdStorePost(rsp)));
            }));
    }
 
    /**
     * Fetch all credential exchange records
     * @param connectionId Connection identifier
     * @param role Role assigned in credential exchange
     * @param state Credential exchange state
     * @param threadId Thread identifier
     */
    public issueCredentialRecordsGet(connectionId?: string, role?: 'issuer' | 'holder', state?: 'proposal_sent' | 'proposal_received' | 'offer_sent' | 'offer_received' | 'request_sent' | 'request_received' | 'credential_issued' | 'credential_received' | 'credential_acked', threadId?: string, options?: Configuration): Observable<V10CredentialExchangeListResult> {
        const requestContextPromise = this.requestFactory.issueCredentialRecordsGet(connectionId, role, state, threadId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialRecordsGet(rsp)));
            }));
    }
 
    /**
     * Send holder a credential offer, independent of any proposal
     * @param body 
     */
    public issueCredentialSendOfferPost(body?: V10CredentialOfferRequest, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialSendOfferPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialSendOfferPost(rsp)));
            }));
    }
 
    /**
     * Send issuer a credential proposal
     * @param body 
     */
    public issueCredentialSendProposalPost(body?: V10CredentialProposalRequestOpt, options?: Configuration): Observable<V10CredentialExchange> {
        const requestContextPromise = this.requestFactory.issueCredentialSendProposalPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredentialSendProposalPost(rsp)));
            }));
    }
 
}

import { IssueCredentialV20ApiRequestFactory, IssueCredentialV20ApiResponseProcessor} from "../apis/IssueCredentialV20Api";
export class ObservableIssueCredentialV20Api {
    private requestFactory: IssueCredentialV20ApiRequestFactory;
    private responseProcessor: IssueCredentialV20ApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: IssueCredentialV20ApiRequestFactory,
        responseProcessor?: IssueCredentialV20ApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new IssueCredentialV20ApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new IssueCredentialV20ApiResponseProcessor();
    }

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public issueCredential20CreatePost(body?: V20CredCreate, options?: Configuration): Observable<V20CredExRecord> {
        const requestContextPromise = this.requestFactory.issueCredential20CreatePost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20CreatePost(rsp)));
            }));
    }
 
    /**
     * Remove an existing credential exchange record
     * @param credExId Credential exchange identifier
     */
    public issueCredential20RecordsCredExIdDelete(credExId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.issueCredential20RecordsCredExIdDelete(credExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20RecordsCredExIdDelete(rsp)));
            }));
    }
 
    /**
     * Fetch a single credential exchange record
     * @param credExId Credential exchange identifier
     */
    public issueCredential20RecordsCredExIdGet(credExId: string, options?: Configuration): Observable<V20CredExRecordDetail> {
        const requestContextPromise = this.requestFactory.issueCredential20RecordsCredExIdGet(credExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20RecordsCredExIdGet(rsp)));
            }));
    }
 
    /**
     * Send holder a credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredential20RecordsCredExIdIssuePost(credExId: string, body?: V20CredIssueRequest, options?: Configuration): Observable<V20CredExRecordDetail> {
        const requestContextPromise = this.requestFactory.issueCredential20RecordsCredExIdIssuePost(credExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20RecordsCredExIdIssuePost(rsp)));
            }));
    }
 
    /**
     * Send a problem report for credential exchange
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredential20RecordsCredExIdProblemReportPost(credExId: string, body?: V20CredIssueProblemReportRequest, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.issueCredential20RecordsCredExIdProblemReportPost(credExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20RecordsCredExIdProblemReportPost(rsp)));
            }));
    }
 
    /**
     * Send holder a credential offer in reference to a proposal with preview
     * @param credExId Credential exchange identifier
     */
    public issueCredential20RecordsCredExIdSendOfferPost(credExId: string, options?: Configuration): Observable<V20CredExRecord> {
        const requestContextPromise = this.requestFactory.issueCredential20RecordsCredExIdSendOfferPost(credExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20RecordsCredExIdSendOfferPost(rsp)));
            }));
    }
 
    /**
     * Send issuer a credential request
     * @param credExId Credential exchange identifier
     */
    public issueCredential20RecordsCredExIdSendRequestPost(credExId: string, options?: Configuration): Observable<V20CredExRecord> {
        const requestContextPromise = this.requestFactory.issueCredential20RecordsCredExIdSendRequestPost(credExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20RecordsCredExIdSendRequestPost(rsp)));
            }));
    }
 
    /**
     * Store a received credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public issueCredential20RecordsCredExIdStorePost(credExId: string, body?: V20CredStoreRequest, options?: Configuration): Observable<V20CredExRecordDetail> {
        const requestContextPromise = this.requestFactory.issueCredential20RecordsCredExIdStorePost(credExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20RecordsCredExIdStorePost(rsp)));
            }));
    }
 
    /**
     * Fetch all credential exchange records
     * @param connectionId Connection identifier
     * @param role Role assigned in credential exchange
     * @param state Credential exchange state
     * @param threadId Thread identifier
     */
    public issueCredential20RecordsGet(connectionId?: string, role?: 'issuer' | 'holder', state?: 'proposal-sent' | 'proposal-received' | 'offer-sent' | 'offer-received' | 'request-sent' | 'request-received' | 'credential-issued' | 'credential-received' | 'done', threadId?: string, options?: Configuration): Observable<V20CredExRecordListResult> {
        const requestContextPromise = this.requestFactory.issueCredential20RecordsGet(connectionId, role, state, threadId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20RecordsGet(rsp)));
            }));
    }
 
    /**
     * Send holder a credential offer, independent of any proposal
     * @param body 
     */
    public issueCredential20SendOfferPost(body?: V20CredOfferRequest, options?: Configuration): Observable<V20CredExRecord> {
        const requestContextPromise = this.requestFactory.issueCredential20SendOfferPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20SendOfferPost(rsp)));
            }));
    }
 
    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public issueCredential20SendPost(body?: V20CredProposalRequestPreviewMand, options?: Configuration): Observable<V20CredExRecord> {
        const requestContextPromise = this.requestFactory.issueCredential20SendPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20SendPost(rsp)));
            }));
    }
 
    /**
     * Send issuer a credential proposal
     * @param body 
     */
    public issueCredential20SendProposalPost(body?: V20CredProposalRequestPreviewOpt, options?: Configuration): Observable<V20CredExRecord> {
        const requestContextPromise = this.requestFactory.issueCredential20SendProposalPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.issueCredential20SendProposalPost(rsp)));
            }));
    }
 
}

import { LedgerApiRequestFactory, LedgerApiResponseProcessor} from "../apis/LedgerApi";
export class ObservableLedgerApi {
    private requestFactory: LedgerApiRequestFactory;
    private responseProcessor: LedgerApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: LedgerApiRequestFactory,
        responseProcessor?: LedgerApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new LedgerApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new LedgerApiResponseProcessor();
    }

    /**
     * Accept the transaction author agreement
     * @param body 
     */
    public acceptTaa(body?: TAAAccept, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.acceptTaa(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.acceptTaa(rsp)));
            }));
    }
 
    /**
     * Fetch the current transaction author agreement, if any
     */
    public fetchTaa(options?: Configuration): Observable<TAAResult> {
        const requestContextPromise = this.requestFactory.fetchTaa(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.fetchTaa(rsp)));
            }));
    }
 
    /**
     * Get the endpoint for a DID from the ledger.
     * @param did DID of interest
     * @param endpointType Endpoint type of interest (default &#39;Endpoint&#39;)
     */
    public ledgerDidEndpointGet(did: string, endpointType?: 'Endpoint' | 'Profile' | 'LinkedDomains', options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.ledgerDidEndpointGet(did, endpointType, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.ledgerDidEndpointGet(rsp)));
            }));
    }
 
    /**
     * Get the verkey for a DID from the ledger.
     * @param did DID of interest
     */
    public ledgerDidVerkeyGet(did: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.ledgerDidVerkeyGet(did, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.ledgerDidVerkeyGet(rsp)));
            }));
    }
 
    /**
     * Get the role from the NYM registration of a public DID.
     * @param did DID of interest
     */
    public ledgerGetNymRoleGet(did: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.ledgerGetNymRoleGet(did, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.ledgerGetNymRoleGet(rsp)));
            }));
    }
 
    /**
     * Send a NYM registration to the ledger.
     * @param did DID to register
     * @param verkey Verification key
     * @param alias Alias
     * @param role Role
     */
    public ledgerRegisterNymPost(did: string, verkey: string, alias?: string, role?: 'STEWARD' | 'TRUSTEE' | 'ENDORSER' | 'NETWORK_MONITOR' | 'reset', options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.ledgerRegisterNymPost(did, verkey, alias, role, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.ledgerRegisterNymPost(rsp)));
            }));
    }
 
    /**
     * Rotate key pair for public DID.
     */
    public ledgerRotatePublicDidKeypairPatch(options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.ledgerRotatePublicDidKeypairPatch(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.ledgerRotatePublicDidKeypairPatch(rsp)));
            }));
    }
 
}

import { MediationApiRequestFactory, MediationApiResponseProcessor} from "../apis/MediationApi";
export class ObservableMediationApi {
    private requestFactory: MediationApiRequestFactory;
    private responseProcessor: MediationApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: MediationApiRequestFactory,
        responseProcessor?: MediationApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new MediationApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new MediationApiResponseProcessor();
    }

    /**
     * Clear default mediator
     */
    public mediationDefaultMediatorDelete(options?: Configuration): Observable<MediationRecord> {
        const requestContextPromise = this.requestFactory.mediationDefaultMediatorDelete(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationDefaultMediatorDelete(rsp)));
            }));
    }
 
    /**
     * Get default mediator
     */
    public mediationDefaultMediatorGet(options?: Configuration): Observable<MediationRecord> {
        const requestContextPromise = this.requestFactory.mediationDefaultMediatorGet(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationDefaultMediatorGet(rsp)));
            }));
    }
 
    /**
     * Retrieve keylists by connection or role
     * @param connId Connection identifier (optional)
     * @param role Filer on role, &#39;client&#39; for keys         mediated by other agents, &#39;server&#39; for keys         mediated by this agent
     */
    public mediationKeylistsGet(connId?: string, role?: 'client' | 'server', options?: Configuration): Observable<Keylist> {
        const requestContextPromise = this.requestFactory.mediationKeylistsGet(connId, role, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationKeylistsGet(rsp)));
            }));
    }
 
    /**
     * Send keylist query to mediator
     * @param mediationId Mediation record identifier
     * @param paginateLimit limit number of results
     * @param paginateOffset offset to use in pagination
     * @param body 
     */
    public mediationKeylistsMediationIdSendKeylistQueryPost(mediationId: string, paginateLimit?: number, paginateOffset?: number, body?: KeylistQueryFilterRequest, options?: Configuration): Observable<KeylistQuery> {
        const requestContextPromise = this.requestFactory.mediationKeylistsMediationIdSendKeylistQueryPost(mediationId, paginateLimit, paginateOffset, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationKeylistsMediationIdSendKeylistQueryPost(rsp)));
            }));
    }
 
    /**
     * Send keylist update to mediator
     * @param mediationId Mediation record identifier
     * @param body 
     */
    public mediationKeylistsMediationIdSendKeylistUpdatePost(mediationId: string, body?: KeylistUpdateRequest, options?: Configuration): Observable<KeylistUpdate> {
        const requestContextPromise = this.requestFactory.mediationKeylistsMediationIdSendKeylistUpdatePost(mediationId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationKeylistsMediationIdSendKeylistUpdatePost(rsp)));
            }));
    }
 
    /**
     * Set default mediator
     * @param mediationId Mediation record identifier
     */
    public mediationMediationIdDefaultMediatorPut(mediationId: string, options?: Configuration): Observable<MediationRecord> {
        const requestContextPromise = this.requestFactory.mediationMediationIdDefaultMediatorPut(mediationId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationMediationIdDefaultMediatorPut(rsp)));
            }));
    }
 
    /**
     * Request mediation from connection
     * @param connId Connection identifier
     * @param body 
     */
    public mediationRequestConnIdPost(connId: string, body?: MediationCreateRequest, options?: Configuration): Observable<MediationRecord> {
        const requestContextPromise = this.requestFactory.mediationRequestConnIdPost(connId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationRequestConnIdPost(rsp)));
            }));
    }
 
    /**
     * Query mediation requests, returns list of all mediation records
     * @param connId Connection identifier (optional)
     * @param mediatorTerms List of mediator rules for recipient
     * @param recipientTerms List of recipient rules for mediation
     * @param state Mediation state (optional)
     */
    public mediationRequestsGet(connId?: string, mediatorTerms?: Array<string>, recipientTerms?: Array<string>, state?: 'request' | 'granted' | 'denied', options?: Configuration): Observable<MediationList> {
        const requestContextPromise = this.requestFactory.mediationRequestsGet(connId, mediatorTerms, recipientTerms, state, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationRequestsGet(rsp)));
            }));
    }
 
    /**
     * Delete mediation request by ID
     * @param mediationId Mediation record identifier
     */
    public mediationRequestsMediationIdDelete(mediationId: string, options?: Configuration): Observable<MediationRecord> {
        const requestContextPromise = this.requestFactory.mediationRequestsMediationIdDelete(mediationId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationRequestsMediationIdDelete(rsp)));
            }));
    }
 
    /**
     * Deny a stored mediation request
     * @param mediationId Mediation record identifier
     * @param body 
     */
    public mediationRequestsMediationIdDenyPost(mediationId: string, body?: AdminMediationDeny, options?: Configuration): Observable<MediationDeny> {
        const requestContextPromise = this.requestFactory.mediationRequestsMediationIdDenyPost(mediationId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationRequestsMediationIdDenyPost(rsp)));
            }));
    }
 
    /**
     * Retrieve mediation request record
     * @param mediationId Mediation record identifier
     */
    public mediationRequestsMediationIdGet(mediationId: string, options?: Configuration): Observable<MediationRecord> {
        const requestContextPromise = this.requestFactory.mediationRequestsMediationIdGet(mediationId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationRequestsMediationIdGet(rsp)));
            }));
    }
 
    /**
     * Grant received mediation
     * @param mediationId Mediation record identifier
     */
    public mediationRequestsMediationIdGrantPost(mediationId: string, options?: Configuration): Observable<MediationGrant> {
        const requestContextPromise = this.requestFactory.mediationRequestsMediationIdGrantPost(mediationId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.mediationRequestsMediationIdGrantPost(rsp)));
            }));
    }
 
}

import { OutOfBandApiRequestFactory, OutOfBandApiResponseProcessor} from "../apis/OutOfBandApi";
export class ObservableOutOfBandApi {
    private requestFactory: OutOfBandApiRequestFactory;
    private responseProcessor: OutOfBandApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: OutOfBandApiRequestFactory,
        responseProcessor?: OutOfBandApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new OutOfBandApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new OutOfBandApiResponseProcessor();
    }

    /**
     * Create a new connection invitation
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param multiUse Create invitation for multiple use (default false)
     * @param body 
     */
    public outOfBandCreateInvitationPost(autoAccept?: string, multiUse?: boolean, body?: InvitationCreateRequest, options?: Configuration): Observable<InvitationRecord> {
        const requestContextPromise = this.requestFactory.outOfBandCreateInvitationPost(autoAccept, multiUse, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.outOfBandCreateInvitationPost(rsp)));
            }));
    }
 
    /**
     * Receive a new connection invitation
     * @param alias Alias for connection
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param useExistingConnection Use an existing connection, if possible
     * @param body 
     */
    public outOfBandReceiveInvitationPost(alias?: string, autoAccept?: string, mediationId?: string, useExistingConnection?: boolean, body?: InvitationReceiveRequest, options?: Configuration): Observable<ConnRecord> {
        const requestContextPromise = this.requestFactory.outOfBandReceiveInvitationPost(alias, autoAccept, mediationId, useExistingConnection, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.outOfBandReceiveInvitationPost(rsp)));
            }));
    }
 
}

import { PresentProofApiRequestFactory, PresentProofApiResponseProcessor} from "../apis/PresentProofApi";
export class ObservablePresentProofApi {
    private requestFactory: PresentProofApiRequestFactory;
    private responseProcessor: PresentProofApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: PresentProofApiRequestFactory,
        responseProcessor?: PresentProofApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new PresentProofApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new PresentProofApiResponseProcessor();
    }

    /**
     *      Creates a presentation request not bound to any proposal or existing connection     
     * @param body 
     */
    public presentProofCreateRequestPost(body?: V10PresentationCreateRequestRequest, options?: Configuration): Observable<V10PresentationExchange> {
        const requestContextPromise = this.requestFactory.presentProofCreateRequestPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofCreateRequestPost(rsp)));
            }));
    }
 
    /**
     * Fetch all present-proof exchange records
     * @param connectionId Connection identifier
     * @param role Role assigned in presentation exchange
     * @param state Presentation exchange state
     * @param threadId Thread identifier
     */
    public presentProofRecordsGet(connectionId?: string, role?: 'prover' | 'verifier', state?: 'proposal_sent' | 'proposal_received' | 'request_sent' | 'request_received' | 'presentation_sent' | 'presentation_received' | 'verified' | 'presentation_acked', threadId?: string, options?: Configuration): Observable<V10PresentationExchangeList> {
        const requestContextPromise = this.requestFactory.presentProofRecordsGet(connectionId, role, state, threadId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofRecordsGet(rsp)));
            }));
    }
 
    /**
     * Fetch credentials for a presentation request from wallet
     * @param presExId Presentation exchange identifier
     * @param count Maximum number to retrieve
     * @param extraQuery (JSON) object mapping referents to extra WQL queries
     * @param referent Proof request referents of interest, comma-separated
     * @param start Start index
     */
    public presentProofRecordsPresExIdCredentialsGet(presExId: string, count?: string, extraQuery?: string, referent?: string, start?: string, options?: Configuration): Observable<Array<IndyCredPrecis>> {
        const requestContextPromise = this.requestFactory.presentProofRecordsPresExIdCredentialsGet(presExId, count, extraQuery, referent, start, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofRecordsPresExIdCredentialsGet(rsp)));
            }));
    }
 
    /**
     * Remove an existing presentation exchange record
     * @param presExId Presentation exchange identifier
     */
    public presentProofRecordsPresExIdDelete(presExId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.presentProofRecordsPresExIdDelete(presExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofRecordsPresExIdDelete(rsp)));
            }));
    }
 
    /**
     * Fetch a single presentation exchange record
     * @param presExId Presentation exchange identifier
     */
    public presentProofRecordsPresExIdGet(presExId: string, options?: Configuration): Observable<V10PresentationExchange> {
        const requestContextPromise = this.requestFactory.presentProofRecordsPresExIdGet(presExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofRecordsPresExIdGet(rsp)));
            }));
    }
 
    /**
     * Send a problem report for presentation exchange
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public presentProofRecordsPresExIdProblemReportPost(presExId: string, body?: V10PresentationProblemReportRequest, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.presentProofRecordsPresExIdProblemReportPost(presExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofRecordsPresExIdProblemReportPost(rsp)));
            }));
    }
 
    /**
     * Sends a proof presentation
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public presentProofRecordsPresExIdSendPresentationPost(presExId: string, body?: V10PresentationRequest, options?: Configuration): Observable<V10PresentationExchange> {
        const requestContextPromise = this.requestFactory.presentProofRecordsPresExIdSendPresentationPost(presExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofRecordsPresExIdSendPresentationPost(rsp)));
            }));
    }
 
    /**
     * Sends a presentation request in reference to a proposal
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public presentProofRecordsPresExIdSendRequestPost(presExId: string, body?: AdminAPIMessageTracing, options?: Configuration): Observable<V10PresentationExchange> {
        const requestContextPromise = this.requestFactory.presentProofRecordsPresExIdSendRequestPost(presExId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofRecordsPresExIdSendRequestPost(rsp)));
            }));
    }
 
    /**
     * Verify a received presentation
     * @param presExId Presentation exchange identifier
     */
    public presentProofRecordsPresExIdVerifyPresentationPost(presExId: string, options?: Configuration): Observable<V10PresentationExchange> {
        const requestContextPromise = this.requestFactory.presentProofRecordsPresExIdVerifyPresentationPost(presExId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofRecordsPresExIdVerifyPresentationPost(rsp)));
            }));
    }
 
    /**
     * Sends a presentation proposal
     * @param body 
     */
    public presentProofSendProposalPost(body?: V10PresentationProposalRequest, options?: Configuration): Observable<V10PresentationExchange> {
        const requestContextPromise = this.requestFactory.presentProofSendProposalPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.presentProofSendProposalPost(rsp)));
            }));
    }
 
    /**
     * Sends a free presentation request not bound to any proposal
     * @param body 
     */
    public sendProofRequest(body?: V10PresentationSendRequestRequest, options?: Configuration): Observable<V10PresentationExchange> {
        const requestContextPromise = this.requestFactory.sendProofRequest(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.sendProofRequest(rsp)));
            }));
    }
 
}

import { RevocationApiRequestFactory, RevocationApiResponseProcessor} from "../apis/RevocationApi";
export class ObservableRevocationApi {
    private requestFactory: RevocationApiRequestFactory;
    private responseProcessor: RevocationApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: RevocationApiRequestFactory,
        responseProcessor?: RevocationApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new RevocationApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new RevocationApiResponseProcessor();
    }

    /**
     * Publish pending revocations to ledger
     * @param body 
     */
    public publishRevocations(body?: PublishRevocations, options?: Configuration): Observable<PublishRevocations> {
        const requestContextPromise = this.requestFactory.publishRevocations(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.publishRevocations(rsp)));
            }));
    }
 
    /**
     * Get current active revocation registry by credential definition id
     * @param credDefId Credential definition identifier
     */
    public revocationActiveRegistryCredDefIdGet(credDefId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationActiveRegistryCredDefIdGet(credDefId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationActiveRegistryCredDefIdGet(rsp)));
            }));
    }
 
    /**
     * Clear pending revocations
     * @param body 
     */
    public revocationClearPendingRevocationsPost(body?: ClearPendingRevocationsRequest, options?: Configuration): Observable<PublishRevocations> {
        const requestContextPromise = this.requestFactory.revocationClearPendingRevocationsPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationClearPendingRevocationsPost(rsp)));
            }));
    }
 
    /**
     * Creates a new revocation registry
     * @param body 
     */
    public revocationCreateRegistryPost(body?: RevRegCreateRequest, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationCreateRegistryPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationCreateRegistryPost(rsp)));
            }));
    }
 
    /**
     * Get credential revocation status
     * @param credExId Credential exchange identifier
     * @param credRevId Credential revocation identifier
     * @param revRegId Revocation registry identifier
     */
    public revocationCredentialRecordGet(credExId?: string, credRevId?: string, revRegId?: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationCredentialRecordGet(credExId, credRevId, revRegId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationCredentialRecordGet(rsp)));
            }));
    }
 
    /**
     * Search for matching revocation registries that current agent created
     * @param credDefId Credential definition identifier
     * @param state Revocation registry state
     */
    public revocationRegistriesCreatedGet(credDefId?: string, state?: 'init' | 'generated' | 'posted' | 'active' | 'full', options?: Configuration): Observable<RevRegsCreated> {
        const requestContextPromise = this.requestFactory.revocationRegistriesCreatedGet(credDefId, state, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistriesCreatedGet(rsp)));
            }));
    }
 
    /**
     * Send revocation registry definition to ledger
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdDefinitionPost(revRegId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationRegistryRevRegIdDefinitionPost(revRegId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistryRevRegIdDefinitionPost(rsp)));
            }));
    }
 
    /**
     * Send revocation registry entry to ledger
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdEntryPost(revRegId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationRegistryRevRegIdEntryPost(revRegId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistryRevRegIdEntryPost(rsp)));
            }));
    }
 
    /**
     * Get revocation registry by revocation registry id
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdGet(revRegId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationRegistryRevRegIdGet(revRegId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistryRevRegIdGet(rsp)));
            }));
    }
 
    /**
     * Get number of credentials issued against revocation registry
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdIssuedGet(revRegId: string, options?: Configuration): Observable<RevRegIssuedResult> {
        const requestContextPromise = this.requestFactory.revocationRegistryRevRegIdIssuedGet(revRegId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistryRevRegIdIssuedGet(rsp)));
            }));
    }
 
    /**
     * Update revocation registry with new public URI to its tails file
     * @param revRegId Revocation Registry identifier
     * @param body 
     */
    public revocationRegistryRevRegIdPatch(revRegId: string, body?: RevRegUpdateTailsFileUri, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationRegistryRevRegIdPatch(revRegId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistryRevRegIdPatch(rsp)));
            }));
    }
 
    /**
     * Set revocation registry state manually
     * @param revRegId Revocation Registry identifier
     * @param state Revocation registry state to set
     */
    public revocationRegistryRevRegIdSetStatePatch(revRegId: string, state: 'init' | 'generated' | 'posted' | 'active' | 'full', options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationRegistryRevRegIdSetStatePatch(revRegId, state, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistryRevRegIdSetStatePatch(rsp)));
            }));
    }
 
    /**
     * Download tails file
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdTailsFileGet(revRegId: string, options?: Configuration): Observable<HttpFile> {
        const requestContextPromise = this.requestFactory.revocationRegistryRevRegIdTailsFileGet(revRegId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistryRevRegIdTailsFileGet(rsp)));
            }));
    }
 
    /**
     * Upload local tails file to server
     * @param revRegId Revocation Registry identifier
     */
    public revocationRegistryRevRegIdTailsFilePut(revRegId: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revocationRegistryRevRegIdTailsFilePut(revRegId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revocationRegistryRevRegIdTailsFilePut(rsp)));
            }));
    }
 
    /**
     * Revoke an issued credential
     * @param body 
     */
    public revokeCredential(body?: RevokeRequest, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.revokeCredential(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.revokeCredential(rsp)));
            }));
    }
 
}

import { SchemaApiRequestFactory, SchemaApiResponseProcessor} from "../apis/SchemaApi";
export class ObservableSchemaApi {
    private requestFactory: SchemaApiRequestFactory;
    private responseProcessor: SchemaApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: SchemaApiRequestFactory,
        responseProcessor?: SchemaApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new SchemaApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new SchemaApiResponseProcessor();
    }

    /**
     * Sends a schema to the ledger
     * @param body 
     */
    public publishSchema(body?: SchemaSendRequest, options?: Configuration): Observable<SchemaSendResults> {
        const requestContextPromise = this.requestFactory.publishSchema(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.publishSchema(rsp)));
            }));
    }
 
    /**
     * Search for matching schema that agent originated
     * @param schemaId Schema identifier
     * @param schemaIssuerDid Schema issuer DID
     * @param schemaName Schema name
     * @param schemaVersion Schema version
     */
    public schemasCreatedGet(schemaId?: string, schemaIssuerDid?: string, schemaName?: string, schemaVersion?: string, options?: Configuration): Observable<SchemasCreatedResults> {
        const requestContextPromise = this.requestFactory.schemasCreatedGet(schemaId, schemaIssuerDid, schemaName, schemaVersion, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.schemasCreatedGet(rsp)));
            }));
    }
 
    /**
     * Gets a schema from the ledger
     * @param schemaId Schema identifier
     */
    public schemasSchemaIdGet(schemaId: string, options?: Configuration): Observable<SchemaGetResults> {
        const requestContextPromise = this.requestFactory.schemasSchemaIdGet(schemaId, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.schemasSchemaIdGet(rsp)));
            }));
    }
 
}

import { ServerApiRequestFactory, ServerApiResponseProcessor} from "../apis/ServerApi";
export class ObservableServerApi {
    private requestFactory: ServerApiRequestFactory;
    private responseProcessor: ServerApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: ServerApiRequestFactory,
        responseProcessor?: ServerApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new ServerApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new ServerApiResponseProcessor();
    }

    /**
     * Query supported features
     * @param query Query
     */
    public featuresGet(query?: string, options?: Configuration): Observable<QueryResult> {
        const requestContextPromise = this.requestFactory.featuresGet(query, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.featuresGet(rsp)));
            }));
    }
 
    /**
     * Fetch the list of loaded plugins
     */
    public pluginsGet(options?: Configuration): Observable<AdminModules> {
        const requestContextPromise = this.requestFactory.pluginsGet(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.pluginsGet(rsp)));
            }));
    }
 
    /**
     * Shut down server
     */
    public shutdownGet(options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.shutdownGet(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.shutdownGet(rsp)));
            }));
    }
 
    /**
     * Fetch the server status
     */
    public statusGet(options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.statusGet(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.statusGet(rsp)));
            }));
    }
 
    /**
     * Liveliness check
     */
    public statusLiveGet(options?: Configuration): Observable<AdminStatusLiveliness> {
        const requestContextPromise = this.requestFactory.statusLiveGet(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.statusLiveGet(rsp)));
            }));
    }
 
    /**
     * Readiness check
     */
    public statusReadyGet(options?: Configuration): Observable<AdminStatusReadiness> {
        const requestContextPromise = this.requestFactory.statusReadyGet(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.statusReadyGet(rsp)));
            }));
    }
 
    /**
     * Reset statistics
     */
    public statusResetPost(options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.statusResetPost(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.statusResetPost(rsp)));
            }));
    }
 
}

import { TrustpingApiRequestFactory, TrustpingApiResponseProcessor} from "../apis/TrustpingApi";
export class ObservableTrustpingApi {
    private requestFactory: TrustpingApiRequestFactory;
    private responseProcessor: TrustpingApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: TrustpingApiRequestFactory,
        responseProcessor?: TrustpingApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new TrustpingApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new TrustpingApiResponseProcessor();
    }

    /**
     * Send a trust ping to a connection
     * @param connId Connection identifier
     * @param body 
     */
    public connectionsConnIdSendPingPost(connId: string, body?: PingRequest, options?: Configuration): Observable<PingRequestResponse> {
        const requestContextPromise = this.requestFactory.connectionsConnIdSendPingPost(connId, body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.connectionsConnIdSendPingPost(rsp)));
            }));
    }
 
}

import { WalletApiRequestFactory, WalletApiResponseProcessor} from "../apis/WalletApi";
export class ObservableWalletApi {
    private requestFactory: WalletApiRequestFactory;
    private responseProcessor: WalletApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: WalletApiRequestFactory,
        responseProcessor?: WalletApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new WalletApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new WalletApiResponseProcessor();
    }

    /**
     * Create a local DID
     */
    public createDid(options?: Configuration): Observable<DIDResult> {
        const requestContextPromise = this.requestFactory.createDid(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.createDid(rsp)));
            }));
    }
 
    /**
     * Assign the current public DID
     * @param did DID of interest
     */
    public setPublicDid(did: string, options?: Configuration): Observable<DIDResult> {
        const requestContextPromise = this.requestFactory.setPublicDid(did, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.setPublicDid(rsp)));
            }));
    }
 
    /**
     * List wallet DIDs
     * @param did DID of interest
     * @param posture Whether DID is current public DID, posted to ledger but current public DID, or local to the wallet
     * @param verkey Verification key of interest
     */
    public walletDidGet(did?: string, posture?: 'public' | 'posted' | 'wallet_only', verkey?: string, options?: Configuration): Observable<DIDList> {
        const requestContextPromise = this.requestFactory.walletDidGet(did, posture, verkey, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.walletDidGet(rsp)));
            }));
    }
 
    /**
     * Rotate keypair for a DID not posted to the ledger
     * @param did DID of interest
     */
    public walletDidLocalRotateKeypairPatch(did: string, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.walletDidLocalRotateKeypairPatch(did, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.walletDidLocalRotateKeypairPatch(rsp)));
            }));
    }
 
    /**
     * Fetch the current public DID
     */
    public walletDidPublicGet(options?: Configuration): Observable<DIDResult> {
        const requestContextPromise = this.requestFactory.walletDidPublicGet(options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.walletDidPublicGet(rsp)));
            }));
    }
 
    /**
     * Query DID endpoint in wallet
     * @param did DID of interest
     */
    public walletGetDidEndpointGet(did: string, options?: Configuration): Observable<DIDEndpoint> {
        const requestContextPromise = this.requestFactory.walletGetDidEndpointGet(did, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.walletGetDidEndpointGet(rsp)));
            }));
    }
 
    /**
     * Update endpoint in wallet and on ledger if posted to it
     * @param body 
     */
    public walletSetDidEndpointPost(body?: DIDEndpointWithType, options?: Configuration): Observable<any> {
        const requestContextPromise = this.requestFactory.walletSetDidEndpointPost(body, options);

        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (let middleware of this.configuration.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (let middleware of this.configuration.middleware) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.walletSetDidEndpointPost(rsp)));
            }));
    }
 
}
