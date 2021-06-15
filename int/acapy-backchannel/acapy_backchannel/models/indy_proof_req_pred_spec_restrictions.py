from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="IndyProofReqPredSpecRestrictions")


@attr.s(auto_attribs=True)
class IndyProofReqPredSpecRestrictions:
    """ """

    cred_def_id: Union[Unset, str] = UNSET
    issuer_did: Union[Unset, str] = UNSET
    schema_id: Union[Unset, str] = UNSET
    schema_issuer_did: Union[Unset, str] = UNSET
    schema_name: Union[Unset, str] = UNSET
    schema_version: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        cred_def_id = self.cred_def_id
        issuer_did = self.issuer_did
        schema_id = self.schema_id
        schema_issuer_did = self.schema_issuer_did
        schema_name = self.schema_name
        schema_version = self.schema_version

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if cred_def_id is not UNSET:
            field_dict["cred_def_id"] = cred_def_id
        if issuer_did is not UNSET:
            field_dict["issuer_did"] = issuer_did
        if schema_id is not UNSET:
            field_dict["schema_id"] = schema_id
        if schema_issuer_did is not UNSET:
            field_dict["schema_issuer_did"] = schema_issuer_did
        if schema_name is not UNSET:
            field_dict["schema_name"] = schema_name
        if schema_version is not UNSET:
            field_dict["schema_version"] = schema_version

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        cred_def_id = d.pop("cred_def_id", UNSET)

        issuer_did = d.pop("issuer_did", UNSET)

        schema_id = d.pop("schema_id", UNSET)

        schema_issuer_did = d.pop("schema_issuer_did", UNSET)

        schema_name = d.pop("schema_name", UNSET)

        schema_version = d.pop("schema_version", UNSET)

        indy_proof_req_pred_spec_restrictions = cls(
            cred_def_id=cred_def_id,
            issuer_did=issuer_did,
            schema_id=schema_id,
            schema_issuer_did=schema_issuer_did,
            schema_name=schema_name,
            schema_version=schema_version,
        )

        indy_proof_req_pred_spec_restrictions.additional_properties = d
        return indy_proof_req_pred_spec_restrictions

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
