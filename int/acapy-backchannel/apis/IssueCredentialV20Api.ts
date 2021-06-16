// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { V20CredCreate } from '../models/V20CredCreate';
import { V20CredExRecord } from '../models/V20CredExRecord';
import { V20CredExRecordDetail } from '../models/V20CredExRecordDetail';
import { V20CredExRecordListResult } from '../models/V20CredExRecordListResult';
import { V20CredIssueProblemReportRequest } from '../models/V20CredIssueProblemReportRequest';
import { V20CredIssueRequest } from '../models/V20CredIssueRequest';
import { V20CredOfferRequest } from '../models/V20CredOfferRequest';
import { V20CredProposalRequestPreviewMand } from '../models/V20CredProposalRequestPreviewMand';
import { V20CredProposalRequestPreviewOpt } from '../models/V20CredProposalRequestPreviewOpt';
import { V20CredStoreRequest } from '../models/V20CredStoreRequest';

/**
 * no description
 */
export class IssueCredentialV20ApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Send holder a credential, automating entire flow
     * @param body 
     */
    public async issueCredential20CreatePost(body?: V20CredCreate, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/issue-credential-2.0/create';

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
            ObjectSerializer.serialize(body, "V20CredCreate", ""),
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
    public async issueCredential20RecordsCredExIdDelete(credExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredential20RecordsCredExIdDelete.');
        }


        // Path Params
        const localVarPath = '/issue-credential-2.0/records/{cred_ex_id}'
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
    public async issueCredential20RecordsCredExIdGet(credExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredential20RecordsCredExIdGet.');
        }


        // Path Params
        const localVarPath = '/issue-credential-2.0/records/{cred_ex_id}'
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
    public async issueCredential20RecordsCredExIdIssuePost(credExId: string, body?: V20CredIssueRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredential20RecordsCredExIdIssuePost.');
        }



        // Path Params
        const localVarPath = '/issue-credential-2.0/records/{cred_ex_id}/issue'
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
            ObjectSerializer.serialize(body, "V20CredIssueRequest", ""),
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
    public async issueCredential20RecordsCredExIdProblemReportPost(credExId: string, body?: V20CredIssueProblemReportRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredential20RecordsCredExIdProblemReportPost.');
        }



        // Path Params
        const localVarPath = '/issue-credential-2.0/records/{cred_ex_id}/problem-report'
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
            ObjectSerializer.serialize(body, "V20CredIssueProblemReportRequest", ""),
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
    public async issueCredential20RecordsCredExIdSendOfferPost(credExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredential20RecordsCredExIdSendOfferPost.');
        }


        // Path Params
        const localVarPath = '/issue-credential-2.0/records/{cred_ex_id}/send-offer'
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
    public async issueCredential20RecordsCredExIdSendRequestPost(credExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredential20RecordsCredExIdSendRequestPost.');
        }


        // Path Params
        const localVarPath = '/issue-credential-2.0/records/{cred_ex_id}/send-request'
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
    public async issueCredential20RecordsCredExIdStorePost(credExId: string, body?: V20CredStoreRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credExId' is not null or undefined
        if (credExId === null || credExId === undefined) {
            throw new RequiredError('Required parameter credExId was null or undefined when calling issueCredential20RecordsCredExIdStorePost.');
        }



        // Path Params
        const localVarPath = '/issue-credential-2.0/records/{cred_ex_id}/store'
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
            ObjectSerializer.serialize(body, "V20CredStoreRequest", ""),
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
    public async issueCredential20RecordsGet(connectionId?: string, role?: 'issuer' | 'holder', state?: 'proposal-sent' | 'proposal-received' | 'offer-sent' | 'offer-received' | 'request-sent' | 'request-received' | 'credential-issued' | 'credential-received' | 'done', threadId?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;





        // Path Params
        const localVarPath = '/issue-credential-2.0/records';

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
            requestContext.setQueryParam("state", ObjectSerializer.serialize(state, "'proposal-sent' | 'proposal-received' | 'offer-sent' | 'offer-received' | 'request-sent' | 'request-received' | 'credential-issued' | 'credential-received' | 'done'", ""));
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
    public async issueCredential20SendOfferPost(body?: V20CredOfferRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/issue-credential-2.0/send-offer';

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
            ObjectSerializer.serialize(body, "V20CredOfferRequest", ""),
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
    public async issueCredential20SendPost(body?: V20CredProposalRequestPreviewMand, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/issue-credential-2.0/send';

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
            ObjectSerializer.serialize(body, "V20CredProposalRequestPreviewMand", ""),
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
    public async issueCredential20SendProposalPost(body?: V20CredProposalRequestPreviewOpt, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/issue-credential-2.0/send-proposal';

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
            ObjectSerializer.serialize(body, "V20CredProposalRequestPreviewOpt", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class IssueCredentialV20ApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20CreatePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20CreatePost(response: ResponseContext): Promise<V20CredExRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20RecordsCredExIdDelete
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20RecordsCredExIdDelete(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to issueCredential20RecordsCredExIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20RecordsCredExIdGet(response: ResponseContext): Promise<V20CredExRecordDetail > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecordDetail = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecordDetail", ""
            ) as V20CredExRecordDetail;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecordDetail = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecordDetail", ""
            ) as V20CredExRecordDetail;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20RecordsCredExIdIssuePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20RecordsCredExIdIssuePost(response: ResponseContext): Promise<V20CredExRecordDetail > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecordDetail = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecordDetail", ""
            ) as V20CredExRecordDetail;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecordDetail = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecordDetail", ""
            ) as V20CredExRecordDetail;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20RecordsCredExIdProblemReportPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20RecordsCredExIdProblemReportPost(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to issueCredential20RecordsCredExIdSendOfferPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20RecordsCredExIdSendOfferPost(response: ResponseContext): Promise<V20CredExRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20RecordsCredExIdSendRequestPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20RecordsCredExIdSendRequestPost(response: ResponseContext): Promise<V20CredExRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20RecordsCredExIdStorePost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20RecordsCredExIdStorePost(response: ResponseContext): Promise<V20CredExRecordDetail > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecordDetail = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecordDetail", ""
            ) as V20CredExRecordDetail;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecordDetail = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecordDetail", ""
            ) as V20CredExRecordDetail;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20RecordsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20RecordsGet(response: ResponseContext): Promise<V20CredExRecordListResult > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecordListResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecordListResult", ""
            ) as V20CredExRecordListResult;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecordListResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecordListResult", ""
            ) as V20CredExRecordListResult;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20SendOfferPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20SendOfferPost(response: ResponseContext): Promise<V20CredExRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20SendPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20SendPost(response: ResponseContext): Promise<V20CredExRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to issueCredential20SendProposalPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async issueCredential20SendProposalPost(response: ResponseContext): Promise<V20CredExRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V20CredExRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V20CredExRecord", ""
            ) as V20CredExRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
