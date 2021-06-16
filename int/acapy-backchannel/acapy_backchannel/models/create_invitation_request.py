from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..models.create_invitation_request_metadata import CreateInvitationRequestMetadata
from ..types import UNSET, Unset

T = TypeVar("T", bound="CreateInvitationRequest")


@attr.s(auto_attribs=True)
class CreateInvitationRequest:
    """ """

    mediation_id: Union[Unset, str] = UNSET
    metadata: Union[Unset, CreateInvitationRequestMetadata] = UNSET
    recipient_keys: Union[Unset, List[str]] = UNSET
    routing_keys: Union[Unset, List[str]] = UNSET
    service_endpoint: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        mediation_id = self.mediation_id
        metadata: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.metadata, Unset):
            metadata = self.metadata.to_dict()

        recipient_keys: Union[Unset, List[str]] = UNSET
        if not isinstance(self.recipient_keys, Unset):
            recipient_keys = self.recipient_keys

        routing_keys: Union[Unset, List[str]] = UNSET
        if not isinstance(self.routing_keys, Unset):
            routing_keys = self.routing_keys

        service_endpoint = self.service_endpoint

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if mediation_id is not UNSET:
            field_dict["mediation_id"] = mediation_id
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if recipient_keys is not UNSET:
            field_dict["recipient_keys"] = recipient_keys
        if routing_keys is not UNSET:
            field_dict["routing_keys"] = routing_keys
        if service_endpoint is not UNSET:
            field_dict["service_endpoint"] = service_endpoint

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        mediation_id = d.pop("mediation_id", UNSET)

        metadata: Union[Unset, CreateInvitationRequestMetadata] = UNSET
        _metadata = d.pop("metadata", UNSET)
        if not isinstance(_metadata, Unset):
            metadata = CreateInvitationRequestMetadata.from_dict(_metadata)

        recipient_keys = cast(List[str], d.pop("recipient_keys", UNSET))

        routing_keys = cast(List[str], d.pop("routing_keys", UNSET))

        service_endpoint = d.pop("service_endpoint", UNSET)

        create_invitation_request = cls(
            mediation_id=mediation_id,
            metadata=metadata,
            recipient_keys=recipient_keys,
            routing_keys=routing_keys,
            service_endpoint=service_endpoint,
        )

        create_invitation_request.additional_properties = d
        return create_invitation_request

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
