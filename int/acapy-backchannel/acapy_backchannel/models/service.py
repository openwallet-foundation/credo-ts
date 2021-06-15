from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="Service")


@attr.s(auto_attribs=True)
class Service:
    """ """

    id: str
    type: str
    did: Union[Unset, str] = UNSET
    recipient_keys: Union[Unset, List[str]] = UNSET
    routing_keys: Union[Unset, List[str]] = UNSET
    service_endpoint: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        id = self.id
        type = self.type
        did = self.did
        recipient_keys: Union[Unset, List[str]] = UNSET
        if not isinstance(self.recipient_keys, Unset):
            recipient_keys = self.recipient_keys

        routing_keys: Union[Unset, List[str]] = UNSET
        if not isinstance(self.routing_keys, Unset):
            routing_keys = self.routing_keys

        service_endpoint = self.service_endpoint

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "type": type,
            }
        )
        if did is not UNSET:
            field_dict["did"] = did
        if recipient_keys is not UNSET:
            field_dict["recipientKeys"] = recipient_keys
        if routing_keys is not UNSET:
            field_dict["routingKeys"] = routing_keys
        if service_endpoint is not UNSET:
            field_dict["serviceEndpoint"] = service_endpoint

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        id = d.pop("id")

        type = d.pop("type")

        did = d.pop("did", UNSET)

        recipient_keys = cast(List[str], d.pop("recipientKeys", UNSET))

        routing_keys = cast(List[str], d.pop("routingKeys", UNSET))

        service_endpoint = d.pop("serviceEndpoint", UNSET)

        service = cls(
            id=id,
            type=type,
            did=did,
            recipient_keys=recipient_keys,
            routing_keys=routing_keys,
            service_endpoint=service_endpoint,
        )

        service.additional_properties = d
        return service

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
