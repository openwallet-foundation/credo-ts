from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.cred_brief_attrs import CredBriefAttrs
from ..types import UNSET, Unset

T = TypeVar("T", bound="CredBrief")


@attr.s(auto_attribs=True)
class CredBrief:
    """ """

    attrs: Union[Unset, CredBriefAttrs] = UNSET
    cred_def_id: Union[Unset, str] = UNSET
    cred_rev_id: Union[Unset, str] = UNSET
    referent: Union[Unset, str] = UNSET
    rev_reg_id: Union[Unset, str] = UNSET
    schema_id: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        attrs: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.attrs, Unset):
            attrs = self.attrs.to_dict()

        cred_def_id = self.cred_def_id
        cred_rev_id = self.cred_rev_id
        referent = self.referent
        rev_reg_id = self.rev_reg_id
        schema_id = self.schema_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if attrs is not UNSET:
            field_dict["attrs"] = attrs
        if cred_def_id is not UNSET:
            field_dict["cred_def_id"] = cred_def_id
        if cred_rev_id is not UNSET:
            field_dict["cred_rev_id"] = cred_rev_id
        if referent is not UNSET:
            field_dict["referent"] = referent
        if rev_reg_id is not UNSET:
            field_dict["rev_reg_id"] = rev_reg_id
        if schema_id is not UNSET:
            field_dict["schema_id"] = schema_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        attrs: Union[Unset, CredBriefAttrs] = UNSET
        _attrs = d.pop("attrs", UNSET)
        if not isinstance(_attrs, Unset):
            attrs = CredBriefAttrs.from_dict(_attrs)

        cred_def_id = d.pop("cred_def_id", UNSET)

        cred_rev_id = d.pop("cred_rev_id", UNSET)

        referent = d.pop("referent", UNSET)

        rev_reg_id = d.pop("rev_reg_id", UNSET)

        schema_id = d.pop("schema_id", UNSET)

        cred_brief = cls(
            attrs=attrs,
            cred_def_id=cred_def_id,
            cred_rev_id=cred_rev_id,
            referent=referent,
            rev_reg_id=rev_reg_id,
            schema_id=schema_id,
        )

        cred_brief.additional_properties = d
        return cred_brief

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
