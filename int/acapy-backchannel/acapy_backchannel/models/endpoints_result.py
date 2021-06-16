from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="EndpointsResult")


@attr.s(auto_attribs=True)
class EndpointsResult:
    """ """

    my_endpoint: Union[Unset, str] = UNSET
    their_endpoint: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        my_endpoint = self.my_endpoint
        their_endpoint = self.their_endpoint

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if my_endpoint is not UNSET:
            field_dict["my_endpoint"] = my_endpoint
        if their_endpoint is not UNSET:
            field_dict["their_endpoint"] = their_endpoint

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        my_endpoint = d.pop("my_endpoint", UNSET)

        their_endpoint = d.pop("their_endpoint", UNSET)

        endpoints_result = cls(
            my_endpoint=my_endpoint,
            their_endpoint=their_endpoint,
        )

        endpoints_result.additional_properties = d
        return endpoints_result

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
