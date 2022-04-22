export enum MessageType {
    REQUESTED = `https://didcomm.org/vtp/1.0/request-payment`,
    ACCEPTED = `https://didcomm.org/vtp/1.0/accept-payment`,
    GIVER_REJECTED = `https://didcomm.org/vtp/1.0/giver-reject`,
    GETTER_REJECTED = `https://didcomm.org/vtp/1.0/getter-reject`,
    WITNESS_REJECTED = `https://didcomm.org/vtp/1.0/witness-reject`,
    GETTER_PROOF = `https://didcomm.org/vtp/1.0/accept-cash`,
    GIVER_ROOF = `https://didcomm.org/vtp/1.0/remove-cash`,
    WITNESSED = `https://didcomm.org/vtp/1.0/receipt`
}
