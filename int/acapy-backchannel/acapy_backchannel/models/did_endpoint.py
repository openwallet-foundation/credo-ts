from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="DIDEndpoint")


@attr.s(auto_attribs=True)
class DIDEndpoint:
    """ """

    did: str
    endpoint: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        did = self.did
        endpoint = self.endpoint

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "did": did,
            }
        )
        if endpoint is not UNSET:
            field_dict["endpoint"] = endpoint

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        did = d.pop("did")

        endpoint = d.pop("endpoint", UNSET)

        did_endpoint = cls(
            did=did,
            endpoint=endpoint,
        )

        did_endpoint.additional_properties = d
        return did_endpoint

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
