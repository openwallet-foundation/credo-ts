// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { ConnRecord } from '../models/ConnRecord';
import { DIDXRequest } from '../models/DIDXRequest';

/**
 * no description
 */
export class DidExchangeApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Accept a stored connection invitation
     * @param connId Connection identifier
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection request
     */
    public async didexchangeConnIdAcceptInvitationPost(connId: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling didexchangeConnIdAcceptInvitationPost.');
        }




        // Path Params
        const localVarPath = '/didexchange/{conn_id}/accept-invitation'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
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
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     */
    public async didexchangeConnIdAcceptRequestPost(connId: string, mediationId?: string, myEndpoint?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling didexchangeConnIdAcceptRequestPost.');
        }




        // Path Params
        const localVarPath = '/didexchange/{conn_id}/accept-request'
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

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Create request against public DID's implicit invitation
     * @param theirPublicDid Public DID to which to request connection
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param myLabel Label for connection request
     */
    public async didexchangeCreateRequestPost(theirPublicDid: string, mediationId?: string, myEndpoint?: string, myLabel?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'theirPublicDid' is not null or undefined
        if (theirPublicDid === null || theirPublicDid === undefined) {
            throw new RequiredError('Required parameter theirPublicDid was null or undefined when calling didexchangeCreateRequestPost.');
        }





        // Path Params
        const localVarPath = '/didexchange/create-request';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (theirPublicDid !== undefined) {
            requestContext.setQueryParam("their_public_did", ObjectSerializer.serialize(theirPublicDid, "string", ""));
        }
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
     * Receive request against public DID's implicit invitation
     * @param alias Alias for connection
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param myEndpoint My URL endpoint
     * @param body 
     */
    public async didexchangeReceiveRequestPost(alias?: string, autoAccept?: string, mediationId?: string, myEndpoint?: string, body?: DIDXRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;






        // Path Params
        const localVarPath = '/didexchange/receive-request';

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
        if (myEndpoint !== undefined) {
            requestContext.setQueryParam("my_endpoint", ObjectSerializer.serialize(myEndpoint, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "DIDXRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class DidExchangeApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to didexchangeConnIdAcceptInvitationPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async didexchangeConnIdAcceptInvitationPost(response: ResponseContext): Promise<ConnRecord > {
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
     * @params response Response returned by the server for a request to didexchangeConnIdAcceptRequestPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async didexchangeConnIdAcceptRequestPost(response: ResponseContext): Promise<ConnRecord > {
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
     * @params response Response returned by the server for a request to didexchangeCreateRequestPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async didexchangeCreateRequestPost(response: ResponseContext): Promise<DIDXRequest > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: DIDXRequest = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "DIDXRequest", ""
            ) as DIDXRequest;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: DIDXRequest = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "DIDXRequest", ""
            ) as DIDXRequest;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to didexchangeReceiveRequestPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async didexchangeReceiveRequestPost(response: ResponseContext): Promise<ConnRecord > {
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

}
