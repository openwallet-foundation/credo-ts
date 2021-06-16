// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { PingRequest } from '../models/PingRequest';
import { PingRequestResponse } from '../models/PingRequestResponse';

/**
 * no description
 */
export class TrustpingApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Send a trust ping to a connection
     * @param connId Connection identifier
     * @param body 
     */
    public async connectionsConnIdSendPingPost(connId: string, body?: PingRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling connectionsConnIdSendPingPost.');
        }



        // Path Params
        const localVarPath = '/connections/{conn_id}/send-ping'
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
            ObjectSerializer.serialize(body, "PingRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class TrustpingApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to connectionsConnIdSendPingPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async connectionsConnIdSendPingPost(response: ResponseContext): Promise<PingRequestResponse > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: PingRequestResponse = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "PingRequestResponse", ""
            ) as PingRequestResponse;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: PingRequestResponse = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "PingRequestResponse", ""
            ) as PingRequestResponse;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
