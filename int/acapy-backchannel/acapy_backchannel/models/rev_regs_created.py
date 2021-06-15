from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="RevRegsCreated")


@attr.s(auto_attribs=True)
class RevRegsCreated:
    """ """

    rev_reg_ids: Union[Unset, List[str]] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        rev_reg_ids: Union[Unset, List[str]] = UNSET
        if not isinstance(self.rev_reg_ids, Unset):
            rev_reg_ids = self.rev_reg_ids

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if rev_reg_ids is not UNSET:
            field_dict["rev_reg_ids"] = rev_reg_ids

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        rev_reg_ids = cast(List[str], d.pop("rev_reg_ids", UNSET))

        rev_regs_created = cls(
            rev_reg_ids=rev_reg_ids,
        )

        rev_regs_created.additional_properties = d
        return rev_regs_created

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
