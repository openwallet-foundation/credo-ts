from enum import Enum


class GetConnectionsTheirRole(str, Enum):
    INVITEE = "invitee"
    REQUESTER = "requester"
    INVITER = "inviter"
    RESPONDER = "responder"

    def __str__(self) -> str:
        return str(self.value)
