// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { AdminMediationDeny } from '../models/AdminMediationDeny';
import { Keylist } from '../models/Keylist';
import { KeylistQuery } from '../models/KeylistQuery';
import { KeylistQueryFilterRequest } from '../models/KeylistQueryFilterRequest';
import { KeylistUpdate } from '../models/KeylistUpdate';
import { KeylistUpdateRequest } from '../models/KeylistUpdateRequest';
import { MediationCreateRequest } from '../models/MediationCreateRequest';
import { MediationDeny } from '../models/MediationDeny';
import { MediationGrant } from '../models/MediationGrant';
import { MediationList } from '../models/MediationList';
import { MediationRecord } from '../models/MediationRecord';

/**
 * no description
 */
export class MediationApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Clear default mediator
     */
    public async mediationDefaultMediatorDelete(options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // Path Params
        const localVarPath = '/mediation/default-mediator';

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
     * Get default mediator
     */
    public async mediationDefaultMediatorGet(options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // Path Params
        const localVarPath = '/mediation/default-mediator';

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
     * Retrieve keylists by connection or role
     * @param connId Connection identifier (optional)
     * @param role Filer on role, &#39;client&#39; for keys         mediated by other agents, &#39;server&#39; for keys         mediated by this agent
     */
    public async mediationKeylistsGet(connId?: string, role?: 'client' | 'server', options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;



        // Path Params
        const localVarPath = '/mediation/keylists';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (connId !== undefined) {
            requestContext.setQueryParam("conn_id", ObjectSerializer.serialize(connId, "string", "uuid"));
        }
        if (role !== undefined) {
            requestContext.setQueryParam("role", ObjectSerializer.serialize(role, "'client' | 'server'", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send keylist query to mediator
     * @param mediationId Mediation record identifier
     * @param paginateLimit limit number of results
     * @param paginateOffset offset to use in pagination
     * @param body 
     */
    public async mediationKeylistsMediationIdSendKeylistQueryPost(mediationId: string, paginateLimit?: number, paginateOffset?: number, body?: KeylistQueryFilterRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'mediationId' is not null or undefined
        if (mediationId === null || mediationId === undefined) {
            throw new RequiredError('Required parameter mediationId was null or undefined when calling mediationKeylistsMediationIdSendKeylistQueryPost.');
        }





        // Path Params
        const localVarPath = '/mediation/keylists/{mediation_id}/send-keylist-query'
            .replace('{' + 'mediation_id' + '}', encodeURIComponent(String(mediationId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (paginateLimit !== undefined) {
            requestContext.setQueryParam("paginate_limit", ObjectSerializer.serialize(paginateLimit, "number", "int32"));
        }
        if (paginateOffset !== undefined) {
            requestContext.setQueryParam("paginate_offset", ObjectSerializer.serialize(paginateOffset, "number", "int32"));
        }

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "KeylistQueryFilterRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send keylist update to mediator
     * @param mediationId Mediation record identifier
     * @param body 
     */
    public async mediationKeylistsMediationIdSendKeylistUpdatePost(mediationId: string, body?: KeylistUpdateRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'mediationId' is not null or undefined
        if (mediationId === null || mediationId === undefined) {
            throw new RequiredError('Required parameter mediationId was null or undefined when calling mediationKeylistsMediationIdSendKeylistUpdatePost.');
        }



        // Path Params
        const localVarPath = '/mediation/keylists/{mediation_id}/send-keylist-update'
            .replace('{' + 'mediation_id' + '}', encodeURIComponent(String(mediationId)));

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
            ObjectSerializer.serialize(body, "KeylistUpdateRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Set default mediator
     * @param mediationId Mediation record identifier
     */
    public async mediationMediationIdDefaultMediatorPut(mediationId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'mediationId' is not null or undefined
        if (mediationId === null || mediationId === undefined) {
            throw new RequiredError('Required parameter mediationId was null or undefined when calling mediationMediationIdDefaultMediatorPut.');
        }


        // Path Params
        const localVarPath = '/mediation/{mediation_id}/default-mediator'
            .replace('{' + 'mediation_id' + '}', encodeURIComponent(String(mediationId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.PUT);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Request mediation from connection
     * @param connId Connection identifier
     * @param body 
     */
    public async mediationRequestConnIdPost(connId: string, body?: MediationCreateRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling mediationRequestConnIdPost.');
        }



        // Path Params
        const localVarPath = '/mediation/request/{conn_id}'
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
            ObjectSerializer.serialize(body, "MediationCreateRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Query mediation requests, returns list of all mediation records
     * @param connId Connection identifier (optional)
     * @param mediatorTerms List of mediator rules for recipient
     * @param recipientTerms List of recipient rules for mediation
     * @param state Mediation state (optional)
     */
    public async mediationRequestsGet(connId?: string, mediatorTerms?: Array<string>, recipientTerms?: Array<string>, state?: 'request' | 'granted' | 'denied', options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;





        // Path Params
        const localVarPath = '/mediation/requests';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (connId !== undefined) {
            requestContext.setQueryParam("conn_id", ObjectSerializer.serialize(connId, "string", "uuid"));
        }
        if (mediatorTerms !== undefined) {
            requestContext.setQueryParam("mediator_terms", ObjectSerializer.serialize(mediatorTerms, "Array<string>", ""));
        }
        if (recipientTerms !== undefined) {
            requestContext.setQueryParam("recipient_terms", ObjectSerializer.serialize(recipientTerms, "Array<string>", ""));
        }
        if (state !== undefined) {
            requestContext.setQueryParam("state", ObjectSerializer.serialize(state, "'request' | 'granted' | 'denied'", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Delete mediation request by ID
     * @param mediationId Mediation record identifier
     */
    public async mediationRequestsMediationIdDelete(mediationId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'mediationId' is not null or undefined
        if (mediationId === null || mediationId === undefined) {
            throw new RequiredError('Required parameter mediationId was null or undefined when calling mediationRequestsMediationIdDelete.');
        }


        // Path Params
        const localVarPath = '/mediation/requests/{mediation_id}'
            .replace('{' + 'mediation_id' + '}', encodeURIComponent(String(mediationId)));

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
     * Deny a stored mediation request
     * @param mediationId Mediation record identifier
     * @param body 
     */
    public async mediationRequestsMediationIdDenyPost(mediationId: string, body?: AdminMediationDeny, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'mediationId' is not null or undefined
        if (mediationId === null || mediationId === undefined) {
            throw new RequiredError('Required parameter mediationId was null or undefined when calling mediationRequestsMediationIdDenyPost.');
        }



        // Path Params
        const localVarPath = '/mediation/requests/{mediation_id}/deny'
            .replace('{' + 'mediation_id' + '}', encodeURIComponent(String(mediationId)));

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
            ObjectSerializer.serialize(body, "AdminMediationDeny", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Retrieve mediation request record
     * @param mediationId Mediation record identifier
     */
    public async mediationRequestsMediationIdGet(mediationId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'mediationId' is not null or undefined
        if (mediationId === null || mediationId === undefined) {
            throw new RequiredError('Required parameter mediationId was null or undefined when calling mediationRequestsMediationIdGet.');
        }


        // Path Params
        const localVarPath = '/mediation/requests/{mediation_id}'
            .replace('{' + 'mediation_id' + '}', encodeURIComponent(String(mediationId)));

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
     * Grant received mediation
     * @param mediationId Mediation record identifier
     */
    public async mediationRequestsMediationIdGrantPost(mediationId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'mediationId' is not null or undefined
        if (mediationId === null || mediationId === undefined) {
            throw new RequiredError('Required parameter mediationId was null or undefined when calling mediationRequestsMediationIdGrantPost.');
        }


        // Path Params
        const localVarPath = '/mediation/requests/{mediation_id}/grant'
            .replace('{' + 'mediation_id' + '}', encodeURIComponent(String(mediationId)));

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

}

export class MediationApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationDefaultMediatorDelete
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationDefaultMediatorDelete(response: ResponseContext): Promise<MediationRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationDefaultMediatorGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationDefaultMediatorGet(response: ResponseContext): Promise<MediationRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationKeylistsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationKeylistsGet(response: ResponseContext): Promise<Keylist > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: Keylist = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "Keylist", ""
            ) as Keylist;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: Keylist = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "Keylist", ""
            ) as Keylist;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationKeylistsMediationIdSendKeylistQueryPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationKeylistsMediationIdSendKeylistQueryPost(response: ResponseContext): Promise<KeylistQuery > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: KeylistQuery = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "KeylistQuery", ""
            ) as KeylistQuery;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: KeylistQuery = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "KeylistQuery", ""
            ) as KeylistQuery;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationKeylistsMediationIdSendKeylistUpdatePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationKeylistsMediationIdSendKeylistUpdatePost(response: ResponseContext): Promise<KeylistUpdate > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: KeylistUpdate = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "KeylistUpdate", ""
            ) as KeylistUpdate;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: KeylistUpdate = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "KeylistUpdate", ""
            ) as KeylistUpdate;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationMediationIdDefaultMediatorPut
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationMediationIdDefaultMediatorPut(response: ResponseContext): Promise<MediationRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationRequestConnIdPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationRequestConnIdPost(response: ResponseContext): Promise<MediationRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationRequestsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationRequestsGet(response: ResponseContext): Promise<MediationList > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: MediationList = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationList", ""
            ) as MediationList;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationList = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationList", ""
            ) as MediationList;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationRequestsMediationIdDelete
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationRequestsMediationIdDelete(response: ResponseContext): Promise<MediationRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationRequestsMediationIdDenyPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationRequestsMediationIdDenyPost(response: ResponseContext): Promise<MediationDeny > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: MediationDeny = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationDeny", ""
            ) as MediationDeny;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationDeny = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationDeny", ""
            ) as MediationDeny;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationRequestsMediationIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationRequestsMediationIdGet(response: ResponseContext): Promise<MediationRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationRecord", ""
            ) as MediationRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to mediationRequestsMediationIdGrantPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async mediationRequestsMediationIdGrantPost(response: ResponseContext): Promise<MediationGrant > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("201", response.httpStatusCode)) {
            const body: MediationGrant = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationGrant", ""
            ) as MediationGrant;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: MediationGrant = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "MediationGrant", ""
            ) as MediationGrant;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
