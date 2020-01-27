import { InboundMessage } from "../../types";
import { createOutboundMessage } from "../helpers";
import { createTrustPingResponseMessage } from "./messages";
import { Connection } from "../..";

export class TrustPingService {
    process(inboundMessage: InboundMessage, connection: Connection) {
        if (inboundMessage.message['response_requested']) {
            const reply = createTrustPingResponseMessage(inboundMessage.message["@id"]);
            return createOutboundMessage(connection, reply)
        }
        return null;
    }
}