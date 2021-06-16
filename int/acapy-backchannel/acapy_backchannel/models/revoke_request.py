from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="RevokeRequest")


@attr.s(auto_attribs=True)
class RevokeRequest:
    """ """

    cred_ex_id: Union[Unset, str] = UNSET
    cred_rev_id: Union[Unset, str] = UNSET
    publish: Union[Unset, bool] = UNSET
    rev_reg_id: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        cred_ex_id = self.cred_ex_id
        cred_rev_id = self.cred_rev_id
        publish = self.publish
        rev_reg_id = self.rev_reg_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if cred_ex_id is not UNSET:
            field_dict["cred_ex_id"] = cred_ex_id
        if cred_rev_id is not UNSET:
            field_dict["cred_rev_id"] = cred_rev_id
        if publish is not UNSET:
            field_dict["publish"] = publish
        if rev_reg_id is not UNSET:
            field_dict["rev_reg_id"] = rev_reg_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        cred_ex_id = d.pop("cred_ex_id", UNSET)

        cred_rev_id = d.pop("cred_rev_id", UNSET)

        publish = d.pop("publish", UNSET)

        rev_reg_id = d.pop("rev_reg_id", UNSET)

        revoke_request = cls(
            cred_ex_id=cred_ex_id,
            cred_rev_id=cred_rev_id,
            publish=publish,
            rev_reg_id=rev_reg_id,
        )

        revoke_request.additional_properties = d
        return revoke_request

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
