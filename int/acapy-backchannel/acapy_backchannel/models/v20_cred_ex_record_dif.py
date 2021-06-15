from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.v20_cred_ex_record_dif_item import V20CredExRecordDIFItem
from ..types import UNSET, Unset

T = TypeVar("T", bound="V20CredExRecordDIF")


@attr.s(auto_attribs=True)
class V20CredExRecordDIF:
    """ """

    created_at: Union[Unset, str] = UNSET
    cred_ex_dif_id: Union[Unset, str] = UNSET
    cred_ex_id: Union[Unset, str] = UNSET
    item: Union[Unset, V20CredExRecordDIFItem] = UNSET
    state: Union[Unset, str] = UNSET
    updated_at: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        created_at = self.created_at
        cred_ex_dif_id = self.cred_ex_dif_id
        cred_ex_id = self.cred_ex_id
        item: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.item, Unset):
            item = self.item.to_dict()

        state = self.state
        updated_at = self.updated_at

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if cred_ex_dif_id is not UNSET:
            field_dict["cred_ex_dif_id"] = cred_ex_dif_id
        if cred_ex_id is not UNSET:
            field_dict["cred_ex_id"] = cred_ex_id
        if item is not UNSET:
            field_dict["item"] = item
        if state is not UNSET:
            field_dict["state"] = state
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        created_at = d.pop("created_at", UNSET)

        cred_ex_dif_id = d.pop("cred_ex_dif_id", UNSET)

        cred_ex_id = d.pop("cred_ex_id", UNSET)

        item: Union[Unset, V20CredExRecordDIFItem] = UNSET
        _item = d.pop("item", UNSET)
        if not isinstance(_item, Unset):
            item = V20CredExRecordDIFItem.from_dict(_item)

        state = d.pop("state", UNSET)

        updated_at = d.pop("updated_at", UNSET)

        v20_cred_ex_record_dif = cls(
            created_at=created_at,
            cred_ex_dif_id=cred_ex_dif_id,
            cred_ex_id=cred_ex_id,
            item=item,
            state=state,
            updated_at=updated_at,
        )

        v20_cred_ex_record_dif.additional_properties = d
        return v20_cred_ex_record_dif

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
