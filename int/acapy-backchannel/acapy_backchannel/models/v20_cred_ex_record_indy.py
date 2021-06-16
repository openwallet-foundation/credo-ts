from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.v20_cred_ex_record_indy_cred_request_metadata import V20CredExRecordIndyCredRequestMetadata
from ..types import UNSET, Unset

T = TypeVar("T", bound="V20CredExRecordIndy")


@attr.s(auto_attribs=True)
class V20CredExRecordIndy:
    """ """

    created_at: Union[Unset, str] = UNSET
    cred_ex_id: Union[Unset, str] = UNSET
    cred_ex_indy_id: Union[Unset, str] = UNSET
    cred_request_metadata: Union[Unset, V20CredExRecordIndyCredRequestMetadata] = UNSET
    cred_rev_id: Union[Unset, str] = UNSET
    rev_reg_id: Union[Unset, str] = UNSET
    state: Union[Unset, str] = UNSET
    updated_at: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        created_at = self.created_at
        cred_ex_id = self.cred_ex_id
        cred_ex_indy_id = self.cred_ex_indy_id
        cred_request_metadata: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.cred_request_metadata, Unset):
            cred_request_metadata = self.cred_request_metadata.to_dict()

        cred_rev_id = self.cred_rev_id
        rev_reg_id = self.rev_reg_id
        state = self.state
        updated_at = self.updated_at

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if cred_ex_id is not UNSET:
            field_dict["cred_ex_id"] = cred_ex_id
        if cred_ex_indy_id is not UNSET:
            field_dict["cred_ex_indy_id"] = cred_ex_indy_id
        if cred_request_metadata is not UNSET:
            field_dict["cred_request_metadata"] = cred_request_metadata
        if cred_rev_id is not UNSET:
            field_dict["cred_rev_id"] = cred_rev_id
        if rev_reg_id is not UNSET:
            field_dict["rev_reg_id"] = rev_reg_id
        if state is not UNSET:
            field_dict["state"] = state
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        created_at = d.pop("created_at", UNSET)

        cred_ex_id = d.pop("cred_ex_id", UNSET)

        cred_ex_indy_id = d.pop("cred_ex_indy_id", UNSET)

        cred_request_metadata: Union[Unset, V20CredExRecordIndyCredRequestMetadata] = UNSET
        _cred_request_metadata = d.pop("cred_request_metadata", UNSET)
        if not isinstance(_cred_request_metadata, Unset):
            cred_request_metadata = V20CredExRecordIndyCredRequestMetadata.from_dict(_cred_request_metadata)

        cred_rev_id = d.pop("cred_rev_id", UNSET)

        rev_reg_id = d.pop("rev_reg_id", UNSET)

        state = d.pop("state", UNSET)

        updated_at = d.pop("updated_at", UNSET)

        v20_cred_ex_record_indy = cls(
            created_at=created_at,
            cred_ex_id=cred_ex_id,
            cred_ex_indy_id=cred_ex_indy_id,
            cred_request_metadata=cred_request_metadata,
            cred_rev_id=cred_rev_id,
            rev_reg_id=rev_reg_id,
            state=state,
            updated_at=updated_at,
        )

        v20_cred_ex_record_indy.additional_properties = d
        return v20_cred_ex_record_indy

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
