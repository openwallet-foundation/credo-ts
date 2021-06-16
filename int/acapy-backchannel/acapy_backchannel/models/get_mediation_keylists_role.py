from enum import Enum


class GetMediationKeylistsRole(str, Enum):
    CLIENT = "client"
    SERVER = "server"

    def __str__(self) -> str:
        return str(self.value)
