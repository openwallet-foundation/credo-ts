from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.did_endpoint_with_type_endpoint_type import DIDEndpointWithTypeEndpointType
from ..types import UNSET, Unset

T = TypeVar("T", bound="DIDEndpointWithType")


@attr.s(auto_attribs=True)
class DIDEndpointWithType:
    """ """

    did: str
    endpoint: Union[Unset, str] = UNSET
    endpoint_type: Union[Unset, DIDEndpointWithTypeEndpointType] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        did = self.did
        endpoint = self.endpoint
        endpoint_type: Union[Unset, str] = UNSET
        if not isinstance(self.endpoint_type, Unset):
            endpoint_type = self.endpoint_type.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "did": did,
            }
        )
        if endpoint is not UNSET:
            field_dict["endpoint"] = endpoint
        if endpoint_type is not UNSET:
            field_dict["endpoint_type"] = endpoint_type

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        did = d.pop("did")

        endpoint = d.pop("endpoint", UNSET)

        endpoint_type: Union[Unset, DIDEndpointWithTypeEndpointType] = UNSET
        _endpoint_type = d.pop("endpoint_type", UNSET)
        if not isinstance(_endpoint_type, Unset):
            endpoint_type = DIDEndpointWithTypeEndpointType(_endpoint_type)

        did_endpoint_with_type = cls(
            did=did,
            endpoint=endpoint,
            endpoint_type=endpoint_type,
        )

        did_endpoint_with_type.additional_properties = d
        return did_endpoint_with_type

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
