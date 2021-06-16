from enum import Enum


class DIDEndpointWithTypeEndpointType(str, Enum):
    ENDPOINT = "Endpoint"
    PROFILE = "Profile"
    LINKEDDOMAINS = "LinkedDomains"

    def __str__(self) -> str:
        return str(self.value)
