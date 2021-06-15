from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.perform_request_params import PerformRequestParams
from ..types import UNSET, Unset

T = TypeVar("T", bound="PerformRequest")


@attr.s(auto_attribs=True)
class PerformRequest:
    """ """

    name: Union[Unset, str] = UNSET
    params: Union[Unset, PerformRequestParams] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        name = self.name
        params: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.params, Unset):
            params = self.params.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if params is not UNSET:
            field_dict["params"] = params

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        name = d.pop("name", UNSET)

        params: Union[Unset, PerformRequestParams] = UNSET
        _params = d.pop("params", UNSET)
        if not isinstance(_params, Unset):
            params = PerformRequestParams.from_dict(_params)

        perform_request = cls(
            name=name,
            params=params,
        )

        perform_request.additional_properties = d
        return perform_request

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
