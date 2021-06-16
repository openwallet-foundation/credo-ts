// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { ConnRecord } from '../models/ConnRecord';
import { ConnectionList } from '../models/ConnectionList';
import { ConnectionMetadata } from '../models/ConnectionMetadata';
import { ConnectionMetadataSetRequest } from '../models/ConnectionMetadataSetRequest';
import { ConnectionStaticRequest } from '../models/ConnectionStaticRequest';
import { ConnectionStaticResult } from '../models/ConnectionStaticResult';
import { CreateInvitationRequest } from '../models/CreateInvitationRequest';
import { EndpointsResult } from '../models/EndpointsResult';
import { InvitationResult } from '../models/InvitationResult';
import { ReceiveInvitationRequest } from '../models/ReceiveInvitationRequest';

/**
 * no description
 */
export class ConnectionApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Accept a stored connection invitation
     * @param connId Connection identifier
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection
     */
    public async connectionsConnIdAcceptInvitationPost(connId: string, mediationId?: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling connectionsConnIdAcceptInvitationPost.');
        }





        // Path Params
        const localVarPath = '/connections/{conn_id}/accept-invitation'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (mediationId !== undefined) {
            requestContext.setQueryParam("mediation_id", ObjectSerializer.serialize(mediationId, "string", ""));
        }
        if (myEndpoint !== undefined) {
            requestContext.setQueryParam("my_endpoint", ObjectSerializer.serialize(myEndpoint, "string", ""));
        }
        if (myLabel !== undefined) {
            requestContext.setQueryParam("my_label", ObjectSerializer.serialize(myLabel, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Accept a stored connection request
     * @param connId Connection identifier
     * @param myEndpoint My URL endpoint
     */
    public async connectionsConnIdAcceptRequestPost(connId: string, myEndpoint?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling connectionsConnIdAcceptRequestPost.');
        }



        // Path Params
        const localVarPath = '/connections/{conn_id}/accept-request'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (myEndpoint !== undefined) {
            requestContext.setQueryParam("my_endpoint", ObjectSerializer.serialize(myEndpoint, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Fetch connection remote endpoint
     * @param connId Connection identifier
     */
    public async connectionsConnIdEndpointsGet(connId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling connectionsConnIdEndpointsGet.');
        }


        // Path Params
        const localVarPath = '/connections/{conn_id}/endpoints'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Assign another connection as the inbound connection
     * @param connId Connection identifier
     * @param refId Inbound connection identifier
     */
    public async connectionsConnIdEstablishInboundRefIdPost(connId: string, refId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling connectionsConnIdEstablishInboundRefIdPost.');
        }


        // verify required parameter 'refId' is not null or undefined
        if (refId === null || refId === undefined) {
            throw new RequiredError('Required parameter refId was null or undefined when calling connectionsConnIdEstablishInboundRefIdPost.');
        }


        // Path Params
        const localVarPath = '/connections/{conn_id}/establish-inbound/{ref_id}'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)))
            .replace('{' + 'ref_id' + '}', encodeURIComponent(String(refId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Create a new connection invitation
     * @param alias Alias
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param multiUse Create invitation for multiple use (default false)
     * @param _public Create invitation from public DID (default false)
     * @param body 
     */
    public async createInvitation(alias?: string, autoAccept?: string, multiUse?: boolean, _public?: boolean, body?: CreateInvitationRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;






        // Path Params
        const localVarPath = '/connections/create-invitation';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (alias !== undefined) {
            requestContext.setQueryParam("alias", ObjectSerializer.serialize(alias, "string", ""));
        }
        if (autoAccept !== undefined) {
            requestContext.setQueryParam("auto_accept", ObjectSerializer.serialize(autoAccept, "string", ""));
        }
        if (multiUse !== undefined) {
            requestContext.setQueryParam("multi_use", ObjectSerializer.serialize(multiUse, "boolean", ""));
        }
        if (_public !== undefined) {
            requestContext.setQueryParam("public", ObjectSerializer.serialize(_public, "boolean", ""));
        }

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "CreateInvitationRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Create a new static connection
     * @param body 
     */
    public async createStatic(body?: ConnectionStaticRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/connections/create-static';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "ConnectionStaticRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Remove an existing connection record
     * @param connId Connection identifier
     */
    public async deleteConnection(connId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling deleteConnection.');
        }


        // Path Params
        const localVarPath = '/connections/{conn_id}'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.DELETE);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Fetch a single connection record
     * @param connId Connection identifier
     */
    public async getConnection(connId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling getConnection.');
        }


        // Path Params
        const localVarPath = '/connections/{conn_id}'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
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
    public async getConnections(alias?: string, invitationKey?: string, myDid?: string, state?: 'start' | 'error' | 'response' | 'init' | 'abandoned' | 'active' | 'request' | 'invitation' | 'completed', theirDid?: string, theirRole?: 'invitee' | 'requester' | 'inviter' | 'responder', options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;







        // Path Params
        const localVarPath = '/connections';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (alias !== undefined) {
            requestContext.setQueryParam("alias", ObjectSerializer.serialize(alias, "string", ""));
        }
        if (invitationKey !== undefined) {
            requestContext.setQueryParam("invitation_key", ObjectSerializer.serialize(invitationKey, "string", ""));
        }
        if (myDid !== undefined) {
            requestContext.setQueryParam("my_did", ObjectSerializer.serialize(myDid, "string", ""));
        }
        if (state !== undefined) {
            requestContext.setQueryParam("state", ObjectSerializer.serialize(state, "'start' | 'error' | 'response' | 'init' | 'abandoned' | 'active' | 'request' | 'invitation' | 'completed'", ""));
        }
        if (theirDid !== undefined) {
            requestContext.setQueryParam("their_did", ObjectSerializer.serialize(theirDid, "string", ""));
        }
        if (theirRole !== undefined) {
            requestContext.setQueryParam("their_role", ObjectSerializer.serialize(theirRole, "'invitee' | 'requester' | 'inviter' | 'responder'", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Fetch connection metadata
     * @param connId Connection identifier
     * @param key Key to retrieve.
     */
    public async getMetadata(connId: string, key?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling getMetadata.');
        }



        // Path Params
        const localVarPath = '/connections/{conn_id}/metadata'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (key !== undefined) {
            requestContext.setQueryParam("key", ObjectSerializer.serialize(key, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Receive a new connection invitation
     * @param alias Alias
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param body 
     */
    public async receiveInvitation(alias?: string, autoAccept?: string, mediationId?: string, body?: ReceiveInvitationRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;





        // Path Params
        const localVarPath = '/connections/receive-invitation';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (alias !== undefined) {
            requestContext.setQueryParam("alias", ObjectSerializer.serialize(alias, "string", ""));
        }
        if (autoAccept !== undefined) {
            requestContext.setQueryParam("auto_accept", ObjectSerializer.serialize(autoAccept, "string", ""));
        }
        if (mediationId !== undefined) {
            requestContext.setQueryParam("mediation_id", ObjectSerializer.serialize(mediationId, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "ReceiveInvitationRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Set connection metadata
     * @param connId Connection identifier
     * @param body 
     */
    public async setMetadata(connId: string, body?: ConnectionMetadataSetRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling setMetadata.');
        }



        // Path Params
        const localVarPath = '/connections/{conn_id}/metadata'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "ConnectionMetadataSetRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class ConnectionApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to connectionsConnIdAcceptInvitationPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async connectionsConnIdAcceptInvitationPost(response: ResponseContext): Promise<ConnRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to connectionsConnIdAcceptRequestPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async connectionsConnIdAcceptRequestPost(response: ResponseContext): Promise<ConnRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to connectionsConnIdEndpointsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async connectionsConnIdEndpointsGet(response: ResponseContext): Promise<EndpointsResult > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: EndpointsResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "EndpointsResult", ""
            ) as EndpointsResult;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: EndpointsResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "EndpointsResult", ""
            ) as EndpointsResult;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to connectionsConnIdEstablishInboundRefIdPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async connectionsConnIdEstablishInboundRefIdPost(response: ResponseContext): Promise<any > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: any = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "any", ""
            ) as any;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: any = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "any", ""
            ) as any;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to createInvitation
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async createInvitation(response: ResponseContext): Promise<InvitationResult > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: InvitationResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "InvitationResult", ""
            ) as InvitationResult;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: InvitationResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "InvitationResult", ""
            ) as InvitationResult;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to createStatic
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async createStatic(response: ResponseContext): Promise<ConnectionStaticResult > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnectionStaticResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnectionStaticResult", ""
            ) as ConnectionStaticResult;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnectionStaticResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnectionStaticResult", ""
            ) as ConnectionStaticResult;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to deleteConnection
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async deleteConnection(response: ResponseContext): Promise<any > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: any = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "any", ""
            ) as any;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: any = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "any", ""
            ) as any;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to getConnection
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async getConnection(response: ResponseContext): Promise<ConnRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to getConnections
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async getConnections(response: ResponseContext): Promise<ConnectionList > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnectionList = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnectionList", ""
            ) as ConnectionList;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnectionList = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnectionList", ""
            ) as ConnectionList;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to getMetadata
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async getMetadata(response: ResponseContext): Promise<ConnectionMetadata > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnectionMetadata = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnectionMetadata", ""
            ) as ConnectionMetadata;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnectionMetadata = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnectionMetadata", ""
            ) as ConnectionMetadata;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to receiveInvitation
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async receiveInvitation(response: ResponseContext): Promise<ConnRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to setMetadata
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async setMetadata(response: ResponseContext): Promise<ConnectionMetadata > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnectionMetadata = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnectionMetadata", ""
            ) as ConnectionMetadata;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnectionMetadata = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnectionMetadata", ""
            ) as ConnectionMetadata;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
