// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { AdminAPIMessageTracing } from '../models/AdminAPIMessageTracing';
import { IndyCredPrecis } from '../models/IndyCredPrecis';
import { V10PresentationCreateRequestRequest } from '../models/V10PresentationCreateRequestRequest';
import { V10PresentationExchange } from '../models/V10PresentationExchange';
import { V10PresentationExchangeList } from '../models/V10PresentationExchangeList';
import { V10PresentationProblemReportRequest } from '../models/V10PresentationProblemReportRequest';
import { V10PresentationProposalRequest } from '../models/V10PresentationProposalRequest';
import { V10PresentationRequest } from '../models/V10PresentationRequest';
import { V10PresentationSendRequestRequest } from '../models/V10PresentationSendRequestRequest';

/**
 * no description
 */
export class PresentProofApiRequestFactory extends BaseAPIRequestFactory {

    /**
     *      Creates a presentation request not bound to any proposal or existing connection     
     * @param body 
     */
    public async presentProofCreateRequestPost(body?: V10PresentationCreateRequestRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/present-proof/create-request';

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
            ObjectSerializer.serialize(body, "V10PresentationCreateRequestRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Fetch all present-proof exchange records
     * @param connectionId Connection identifier
     * @param role Role assigned in presentation exchange
     * @param state Presentation exchange state
     * @param threadId Thread identifier
     */
    public async presentProofRecordsGet(connectionId?: string, role?: 'prover' | 'verifier', state?: 'proposal_sent' | 'proposal_received' | 'request_sent' | 'request_received' | 'presentation_sent' | 'presentation_received' | 'verified' | 'presentation_acked', threadId?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;





        // Path Params
        const localVarPath = '/present-proof/records';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (connectionId !== undefined) {
            requestContext.setQueryParam("connection_id", ObjectSerializer.serialize(connectionId, "string", "uuid"));
        }
        if (role !== undefined) {
            requestContext.setQueryParam("role", ObjectSerializer.serialize(role, "'prover' | 'verifier'", ""));
        }
        if (state !== undefined) {
            requestContext.setQueryParam("state", ObjectSerializer.serialize(state, "'proposal_sent' | 'proposal_received' | 'request_sent' | 'request_received' | 'presentation_sent' | 'presentation_received' | 'verified' | 'presentation_acked'", ""));
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
     * Fetch credentials for a presentation request from wallet
     * @param presExId Presentation exchange identifier
     * @param count Maximum number to retrieve
     * @param extraQuery (JSON) object mapping referents to extra WQL queries
     * @param referent Proof request referents of interest, comma-separated
     * @param start Start index
     */
    public async presentProofRecordsPresExIdCredentialsGet(presExId: string, count?: string, extraQuery?: string, referent?: string, start?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'presExId' is not null or undefined
        if (presExId === null || presExId === undefined) {
            throw new RequiredError('Required parameter presExId was null or undefined when calling presentProofRecordsPresExIdCredentialsGet.');
        }






        // Path Params
        const localVarPath = '/present-proof/records/{pres_ex_id}/credentials'
            .replace('{' + 'pres_ex_id' + '}', encodeURIComponent(String(presExId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (count !== undefined) {
            requestContext.setQueryParam("count", ObjectSerializer.serialize(count, "string", ""));
        }
        if (extraQuery !== undefined) {
            requestContext.setQueryParam("extra_query", ObjectSerializer.serialize(extraQuery, "string", ""));
        }
        if (referent !== undefined) {
            requestContext.setQueryParam("referent", ObjectSerializer.serialize(referent, "string", ""));
        }
        if (start !== undefined) {
            requestContext.setQueryParam("start", ObjectSerializer.serialize(start, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Remove an existing presentation exchange record
     * @param presExId Presentation exchange identifier
     */
    public async presentProofRecordsPresExIdDelete(presExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'presExId' is not null or undefined
        if (presExId === null || presExId === undefined) {
            throw new RequiredError('Required parameter presExId was null or undefined when calling presentProofRecordsPresExIdDelete.');
        }


        // Path Params
        const localVarPath = '/present-proof/records/{pres_ex_id}'
            .replace('{' + 'pres_ex_id' + '}', encodeURIComponent(String(presExId)));

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
     * Fetch a single presentation exchange record
     * @param presExId Presentation exchange identifier
     */
    public async presentProofRecordsPresExIdGet(presExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'presExId' is not null or undefined
        if (presExId === null || presExId === undefined) {
            throw new RequiredError('Required parameter presExId was null or undefined when calling presentProofRecordsPresExIdGet.');
        }


        // Path Params
        const localVarPath = '/present-proof/records/{pres_ex_id}'
            .replace('{' + 'pres_ex_id' + '}', encodeURIComponent(String(presExId)));

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
     * Send a problem report for presentation exchange
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public async presentProofRecordsPresExIdProblemReportPost(presExId: string, body?: V10PresentationProblemReportRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'presExId' is not null or undefined
        if (presExId === null || presExId === undefined) {
            throw new RequiredError('Required parameter presExId was null or undefined when calling presentProofRecordsPresExIdProblemReportPost.');
        }



        // Path Params
        const localVarPath = '/present-proof/records/{pres_ex_id}/problem-report'
            .replace('{' + 'pres_ex_id' + '}', encodeURIComponent(String(presExId)));

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
            ObjectSerializer.serialize(body, "V10PresentationProblemReportRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Sends a proof presentation
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public async presentProofRecordsPresExIdSendPresentationPost(presExId: string, body?: V10PresentationRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'presExId' is not null or undefined
        if (presExId === null || presExId === undefined) {
            throw new RequiredError('Required parameter presExId was null or undefined when calling presentProofRecordsPresExIdSendPresentationPost.');
        }



        // Path Params
        const localVarPath = '/present-proof/records/{pres_ex_id}/send-presentation'
            .replace('{' + 'pres_ex_id' + '}', encodeURIComponent(String(presExId)));

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
            ObjectSerializer.serialize(body, "V10PresentationRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Sends a presentation request in reference to a proposal
     * @param presExId Presentation exchange identifier
     * @param body 
     */
    public async presentProofRecordsPresExIdSendRequestPost(presExId: string, body?: AdminAPIMessageTracing, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'presExId' is not null or undefined
        if (presExId === null || presExId === undefined) {
            throw new RequiredError('Required parameter presExId was null or undefined when calling presentProofRecordsPresExIdSendRequestPost.');
        }



        // Path Params
        const localVarPath = '/present-proof/records/{pres_ex_id}/send-request'
            .replace('{' + 'pres_ex_id' + '}', encodeURIComponent(String(presExId)));

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
            ObjectSerializer.serialize(body, "AdminAPIMessageTracing", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Verify a received presentation
     * @param presExId Presentation exchange identifier
     */
    public async presentProofRecordsPresExIdVerifyPresentationPost(presExId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'presExId' is not null or undefined
        if (presExId === null || presExId === undefined) {
            throw new RequiredError('Required parameter presExId was null or undefined when calling presentProofRecordsPresExIdVerifyPresentationPost.');
        }


        // Path Params
        const localVarPath = '/present-proof/records/{pres_ex_id}/verify-presentation'
            .replace('{' + 'pres_ex_id' + '}', encodeURIComponent(String(presExId)));

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
     * Sends a presentation proposal
     * @param body 
     */
    public async presentProofSendProposalPost(body?: V10PresentationProposalRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/present-proof/send-proposal';

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
            ObjectSerializer.serialize(body, "V10PresentationProposalRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Sends a free presentation request not bound to any proposal
     * @param body 
     */
    public async sendProofRequest(body?: V10PresentationSendRequestRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/present-proof/send-request';

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
            ObjectSerializer.serialize(body, "V10PresentationSendRequestRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class PresentProofApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to presentProofCreateRequestPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofCreateRequestPost(response: ResponseContext): Promise<V10PresentationExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to presentProofRecordsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofRecordsGet(response: ResponseContext): Promise<V10PresentationExchangeList > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10PresentationExchangeList = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchangeList", ""
            ) as V10PresentationExchangeList;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10PresentationExchangeList = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchangeList", ""
            ) as V10PresentationExchangeList;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to presentProofRecordsPresExIdCredentialsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofRecordsPresExIdCredentialsGet(response: ResponseContext): Promise<Array<IndyCredPrecis> > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: Array<IndyCredPrecis> = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "Array<IndyCredPrecis>", ""
            ) as Array<IndyCredPrecis>;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: Array<IndyCredPrecis> = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "Array<IndyCredPrecis>", ""
            ) as Array<IndyCredPrecis>;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to presentProofRecordsPresExIdDelete
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofRecordsPresExIdDelete(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to presentProofRecordsPresExIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofRecordsPresExIdGet(response: ResponseContext): Promise<V10PresentationExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to presentProofRecordsPresExIdProblemReportPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofRecordsPresExIdProblemReportPost(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to presentProofRecordsPresExIdSendPresentationPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofRecordsPresExIdSendPresentationPost(response: ResponseContext): Promise<V10PresentationExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to presentProofRecordsPresExIdSendRequestPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofRecordsPresExIdSendRequestPost(response: ResponseContext): Promise<V10PresentationExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to presentProofRecordsPresExIdVerifyPresentationPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofRecordsPresExIdVerifyPresentationPost(response: ResponseContext): Promise<V10PresentationExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to presentProofSendProposalPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async presentProofSendProposalPost(response: ResponseContext): Promise<V10PresentationExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to sendProofRequest
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async sendProofRequest(response: ResponseContext): Promise<V10PresentationExchange > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: V10PresentationExchange = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "V10PresentationExchange", ""
            ) as V10PresentationExchange;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
