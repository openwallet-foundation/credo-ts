// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';


/**
 * no description
 */
export class IntroductionApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Start an introduction between two connections
     * @param connId Connection identifier
     * @param targetConnectionId Target connection identifier
     * @param message Message
     */
    public async connectionsConnIdStartIntroductionPost(connId: string, targetConnectionId: string, message?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'connId' is not null or undefined
        if (connId === null || connId === undefined) {
            throw new RequiredError('Required parameter connId was null or undefined when calling connectionsConnIdStartIntroductionPost.');
        }


        // verify required parameter 'targetConnectionId' is not null or undefined
        if (targetConnectionId === null || targetConnectionId === undefined) {
            throw new RequiredError('Required parameter targetConnectionId was null or undefined when calling connectionsConnIdStartIntroductionPost.');
        }



        // Path Params
        const localVarPath = '/connections/{conn_id}/start-introduction'
            .replace('{' + 'conn_id' + '}', encodeURIComponent(String(connId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (targetConnectionId !== undefined) {
            requestContext.setQueryParam("target_connection_id", ObjectSerializer.serialize(targetConnectionId, "string", ""));
        }
        if (message !== undefined) {
            requestContext.setQueryParam("message", ObjectSerializer.serialize(message, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

}

export class IntroductionApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to connectionsConnIdStartIntroductionPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async connectionsConnIdStartIntroductionPost(response: ResponseContext): Promise<any > {
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

}
