from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="CredentialDefinitionSendRequest")


@attr.s(auto_attribs=True)
class CredentialDefinitionSendRequest:
    """ """

    revocation_registry_size: Union[Unset, int] = UNSET
    schema_id: Union[Unset, str] = UNSET
    support_revocation: Union[Unset, bool] = UNSET
    tag: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        revocation_registry_size = self.revocation_registry_size
        schema_id = self.schema_id
        support_revocation = self.support_revocation
        tag = self.tag

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if revocation_registry_size is not UNSET:
            field_dict["revocation_registry_size"] = revocation_registry_size
        if schema_id is not UNSET:
            field_dict["schema_id"] = schema_id
        if support_revocation is not UNSET:
            field_dict["support_revocation"] = support_revocation
        if tag is not UNSET:
            field_dict["tag"] = tag

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        revocation_registry_size = d.pop("revocation_registry_size", UNSET)

        schema_id = d.pop("schema_id", UNSET)

        support_revocation = d.pop("support_revocation", UNSET)

        tag = d.pop("tag", UNSET)

        credential_definition_send_request = cls(
            revocation_registry_size=revocation_registry_size,
            schema_id=schema_id,
            support_revocation=support_revocation,
            tag=tag,
        )

        credential_definition_send_request.additional_properties = d
        return credential_definition_send_request

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
