// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { V10CredentialCreate } from '../models/V10CredentialCreate';
import { V10CredentialExchange } from '../models/V10CredentialExchange';
import { V10CredentialExchangeListResult } from '../models/V10CredentialExchangeListResult';
import { V10CredentialIssueRequest } from '../models/V10CredentialIssueRequest';
import { V10CredentialOfferRequest } from '../models/V10CredentialOfferRequest';
import { V10CredentialProblemReportRequest } from '../models/V10CredentialProblemReportRequest';
import { V10CredentialProposalRequestMand } from '../models/V10CredentialProposalRequestMand';
import { V10CredentialProposalRequestOpt } from '../models/V10CredentialProposalRequestOpt';
import { V10CredentialStoreRequest } from '../models/V10CredentialStoreRequest';

/**
 * no description
 */
export class IssueCredentialV10ApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public async issueCredentialAutomated(body?: V10CredentialProposalRequestMand, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/issue-credential/send';

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
            ObjectSerializer.serialize(body, "V10CredentialProposalRequestMand", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public async issueCredentialCreatePost(body?: V10CredentialCreate, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/issue-credential/create';

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
            ObjectSerializer.serialize(body, "V10CredentialCreate", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Remove an existing credential exchange record
     * @param credExId Credential exchange identifier
     */
    public async issueCredentialRecordsCredExIdDelete(credExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredentialRecordsCredExIdDelete.');
        }


        // Path Params
        const localVarPath = '/issue-credential/records/{cred_ex_id}'
            .replace('{' + 'cred_ex_id' + '}', encodeURIComponent(String(credExId)));

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
     * Fetch a single credential exchange record
     * @param credExId Credential exchange identifier
     */
    public async issueCredentialRecordsCredExIdGet(credExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredentialRecordsCredExIdGet.');
        }


        // Path Params
        const localVarPath = '/issue-credential/records/{cred_ex_id}'
            .replace('{' + 'cred_ex_id' + '}', encodeURIComponent(String(credExId)));

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
     * Send holder a credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public async issueCredentialRecordsCredExIdIssuePost(credExId: string, body?: V10CredentialIssueRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredentialRecordsCredExIdIssuePost.');
        }



        // Path Params
        const localVarPath = '/issue-credential/records/{cred_ex_id}/issue'
            .replace('{' + 'cred_ex_id' + '}', encodeURIComponent(String(credExId)));

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
            ObjectSerializer.serialize(body, "V10CredentialIssueRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send a problem report for credential exchange
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public async issueCredentialRecordsCredExIdProblemReportPost(credExId: string, body?: V10CredentialProblemReportRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredentialRecordsCredExIdProblemReportPost.');
        }



        // Path Params
        const localVarPath = '/issue-credential/records/{cred_ex_id}/problem-report'
            .replace('{' + 'cred_ex_id' + '}', encodeURIComponent(String(credExId)));

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
            ObjectSerializer.serialize(body, "V10CredentialProblemReportRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send holder a credential offer in reference to a proposal with preview
     * @param credExId Credential exchange identifier
     */
    public async issueCredentialRecordsCredExIdSendOfferPost(credExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredentialRecordsCredExIdSendOfferPost.');
        }


        // Path Params
        const localVarPath = '/issue-credential/records/{cred_ex_id}/send-offer'
            .replace('{' + 'cred_ex_id' + '}', encodeURIComponent(String(credExId)));

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
     * Send issuer a credential request
     * @param credExId Credential exchange identifier
     */
    public async issueCredentialRecordsCredExIdSendRequestPost(credExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredentialRecordsCredExIdSendRequestPost.');
        }


        // Path Params
        const localVarPath = '/issue-credential/records/{cred_ex_id}/send-request'
            .replace('{' + 'cred_ex_id' + '}', encodeURIComponent(String(credExId)));

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
     * Store a received credential
     * @param credExId Credential exchange identifier
     * @param body 
     */
    public async issueCredentialRecordsCredExIdStorePost(credExId: string, body?: V10CredentialStoreRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredentialRecordsCredExIdStorePost.');
        }



        // Path Params
        const localVarPath = '/issue-credential/records/{cred_ex_id}/store'
            .replace('{' + 'cred_ex_id' + '}', encodeURIComponent(String(credExId)));

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
            ObjectSerializer.serialize(body, "V10CredentialStoreRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Fetch all credential exchange records
     * @param connectionId Connection identifier
     * @param role Role assigned in credential exchange
     * @param state Credential exchange state
     * @param threadId Thread identifier
     */
    public async issueCredentialRecordsGet(connectionId?: string, role?: 'issuer' | 'holder', state?: 'proposal_sent' | 'proposal_received' | 'offer_sent' | 'offer_received' | 'request_sent' | 'request_received' | 'credential_issued' | 'credential_received' | 'credential_acked', threadId?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;





        // Path Params
        const localVarPath = '/issue-credential/records';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (connectionId !== undefined) {
            requestContext.setQueryParam("connection_id", ObjectSerializer.serialize(connectionId, "string", "uuid"));
        }
        if (role !== undefined) {
            requestContext.setQueryParam("role", ObjectSerializer.serialize(role, "'issuer' | 'holder'", ""));
        }
        if (state !== undefined) {
            requestContext.setQueryParam("state", ObjectSerializer.serialize(state, "'proposal_sent' | 'proposal_received' | 'offer_sent' | 'offer_received' | 'request_sent' | 'request_received' | 'credential_issued' | 'credential_received' | 'credential_acked'", ""));
        }
        if (threadId !== undefined) {
            requestContext.setQueryParam("thread_id", ObjectSerializer.serialize(threadId, "string", "uuid"));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send holder a credential offer, independent of any proposal
     * @param body 
     */
    public async issueCredentialSendOfferPost(body?: V10CredentialOfferRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/issue-credential/send-offer';

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
            ObjectSerializer.serialize(body, "V10CredentialOfferRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send issuer a credential proposal
     * @param body 
     */
    public async issueCredentialSendProposalPost(body?: V10CredentialProposalRequestOpt, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/issue-credential/send-proposal';

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
            ObjectSerializer.serialize(body, "V10CredentialProposalRequestOpt", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class IssueCredentialV10ApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialAutomated
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialAutomated(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialCreatePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialCreatePost(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialRecordsCredExIdDelete
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialRecordsCredExIdDelete(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to issueCredentialRecordsCredExIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialRecordsCredExIdGet(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialRecordsCredExIdIssuePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialRecordsCredExIdIssuePost(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialRecordsCredExIdProblemReportPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialRecordsCredExIdProblemReportPost(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to issueCredentialRecordsCredExIdSendOfferPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialRecordsCredExIdSendOfferPost(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialRecordsCredExIdSendRequestPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialRecordsCredExIdSendRequestPost(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialRecordsCredExIdStorePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialRecordsCredExIdStorePost(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialRecordsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialRecordsGet(response: ResponseContext): Promise<V10CredentialExchangeListResult > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchangeListResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchangeListResult", ""
            ) as V10CredentialExchangeListResult;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchangeListResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchangeListResult", ""
            ) as V10CredentialExchangeListResult;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialSendOfferPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialSendOfferPost(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredentialSendProposalPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredentialSendProposalPost(response: ResponseContext): Promise<V10CredentialExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10CredentialExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10CredentialExchange", ""
            ) as V10CredentialExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
