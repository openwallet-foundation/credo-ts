from enum import Enum


class V10PresentationExchangeInitiator(str, Enum):
    SELF = "self"
    EXTERNAL = "external"

    def __str__(self) -> str:
        return str(self.value)
