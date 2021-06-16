from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="V20CredFilterDIF")


@attr.s(auto_attribs=True)
class V20CredFilterDIF:
    """ """

    some_dif_criterion: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        some_dif_criterion = self.some_dif_criterion

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if some_dif_criterion is not UNSET:
            field_dict["some_dif_criterion"] = some_dif_criterion

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        some_dif_criterion = d.pop("some_dif_criterion", UNSET)

        v20_cred_filter_dif = cls(
            some_dif_criterion=some_dif_criterion,
        )

        v20_cred_filter_dif.additional_properties = d
        return v20_cred_filter_dif

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
