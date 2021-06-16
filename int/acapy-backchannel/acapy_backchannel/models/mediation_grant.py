from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="MediationGrant")


@attr.s(auto_attribs=True)
class MediationGrant:
    """ """

    id: Union[Unset, str] = UNSET
    type: Union[Unset, str] = UNSET
    endpoint: Union[Unset, str] = UNSET
    routing_keys: Union[Unset, List[str]] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        id = self.id
        type = self.type
        endpoint = self.endpoint
        routing_keys: Union[Unset, List[str]] = UNSET
        if not isinstance(self.routing_keys, Unset):
            routing_keys = self.routing_keys

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if id is not UNSET:
            field_dict["@id"] = id
        if type is not UNSET:
            field_dict["@type"] = type
        if endpoint is not UNSET:
            field_dict["endpoint"] = endpoint
        if routing_keys is not UNSET:
            field_dict["routing_keys"] = routing_keys

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        id = d.pop("@id", UNSET)

        type = d.pop("@type", UNSET)

        endpoint = d.pop("endpoint", UNSET)

        routing_keys = cast(List[str], d.pop("routing_keys", UNSET))

        mediation_grant = cls(
            id=id,
            type=type,
            endpoint=endpoint,
            routing_keys=routing_keys,
        )

        mediation_grant.additional_properties = d
        return mediation_grant

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
