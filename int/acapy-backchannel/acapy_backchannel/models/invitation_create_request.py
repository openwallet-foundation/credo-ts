from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..models.attachment_def import AttachmentDef
from ..models.invitation_create_request_metadata import InvitationCreateRequestMetadata
from ..types import UNSET, Unset

T = TypeVar("T", bound="InvitationCreateRequest")


@attr.s(auto_attribs=True)
class InvitationCreateRequest:
    """ """

    alias: Union[Unset, str] = UNSET
    attachments: Union[Unset, List[AttachmentDef]] = UNSET
    handshake_protocols: Union[Unset, List[str]] = UNSET
    mediation_id: Union[Unset, str] = UNSET
    metadata: Union[Unset, InvitationCreateRequestMetadata] = UNSET
    my_label: Union[Unset, str] = UNSET
    use_public_did: Union[Unset, bool] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        alias = self.alias
        attachments: Union[Unset, List[Dict[str, Any]]] = UNSET
        if not isinstance(self.attachments, Unset):
            attachments = []
            for attachments_item_data in self.attachments:
                attachments_item = attachments_item_data.to_dict()

                attachments.append(attachments_item)

        handshake_protocols: Union[Unset, List[str]] = UNSET
        if not isinstance(self.handshake_protocols, Unset):
            handshake_protocols = self.handshake_protocols

        mediation_id = self.mediation_id
        metadata: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.metadata, Unset):
            metadata = self.metadata.to_dict()

        my_label = self.my_label
        use_public_did = self.use_public_did

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if alias is not UNSET:
            field_dict["alias"] = alias
        if attachments is not UNSET:
            field_dict["attachments"] = attachments
        if handshake_protocols is not UNSET:
            field_dict["handshake_protocols"] = handshake_protocols
        if mediation_id is not UNSET:
            field_dict["mediation_id"] = mediation_id
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if my_label is not UNSET:
            field_dict["my_label"] = my_label
        if use_public_did is not UNSET:
            field_dict["use_public_did"] = use_public_did

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        alias = d.pop("alias", UNSET)

        attachments = []
        _attachments = d.pop("attachments", UNSET)
        for attachments_item_data in _attachments or []:
            attachments_item = AttachmentDef.from_dict(attachments_item_data)

            attachments.append(attachments_item)

        handshake_protocols = cast(List[str], d.pop("handshake_protocols", UNSET))

        mediation_id = d.pop("mediation_id", UNSET)

        metadata: Union[Unset, InvitationCreateRequestMetadata] = UNSET
        _metadata = d.pop("metadata", UNSET)
        if not isinstance(_metadata, Unset):
            metadata = InvitationCreateRequestMetadata.from_dict(_metadata)

        my_label = d.pop("my_label", UNSET)

        use_public_did = d.pop("use_public_did", UNSET)

        invitation_create_request = cls(
            alias=alias,
            attachments=attachments,
            handshake_protocols=handshake_protocols,
            mediation_id=mediation_id,
            metadata=metadata,
            my_label=my_label,
            use_public_did=use_public_did,
        )

        invitation_create_request.additional_properties = d
        return invitation_create_request

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
