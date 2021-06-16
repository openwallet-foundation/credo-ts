from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="TAAAcceptance")


@attr.s(auto_attribs=True)
class TAAAcceptance:
    """ """

    mechanism: Union[Unset, str] = UNSET
    time: Union[Unset, int] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        mechanism = self.mechanism
        time = self.time

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if mechanism is not UNSET:
            field_dict["mechanism"] = mechanism
        if time is not UNSET:
            field_dict["time"] = time

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        mechanism = d.pop("mechanism", UNSET)

        time = d.pop("time", UNSET)

        taa_acceptance = cls(
            mechanism=mechanism,
            time=time,
        )

        taa_acceptance.additional_properties = d
        return taa_acceptance

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
