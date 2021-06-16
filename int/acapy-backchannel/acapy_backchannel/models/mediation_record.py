from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="MediationRecord")


@attr.s(auto_attribs=True)
class MediationRecord:
    """ """

    connection_id: str
    role: str
    created_at: Union[Unset, str] = UNSET
    endpoint: Union[Unset, str] = UNSET
    mediation_id: Union[Unset, str] = UNSET
    mediator_terms: Union[Unset, List[str]] = UNSET
    recipient_terms: Union[Unset, List[str]] = UNSET
    routing_keys: Union[Unset, List[str]] = UNSET
    state: Union[Unset, str] = UNSET
    updated_at: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        connection_id = self.connection_id
        role = self.role
        created_at = self.created_at
        endpoint = self.endpoint
        mediation_id = self.mediation_id
        mediator_terms: Union[Unset, List[str]] = UNSET
        if not isinstance(self.mediator_terms, Unset):
            mediator_terms = self.mediator_terms

        recipient_terms: Union[Unset, List[str]] = UNSET
        if not isinstance(self.recipient_terms, Unset):
            recipient_terms = self.recipient_terms

        routing_keys: Union[Unset, List[str]] = UNSET
        if not isinstance(self.routing_keys, Unset):
            routing_keys = self.routing_keys

        state = self.state
        updated_at = self.updated_at

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "connection_id": connection_id,
                "role": role,
            }
        )
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if endpoint is not UNSET:
            field_dict["endpoint"] = endpoint
        if mediation_id is not UNSET:
            field_dict["mediation_id"] = mediation_id
        if mediator_terms is not UNSET:
            field_dict["mediator_terms"] = mediator_terms
        if recipient_terms is not UNSET:
            field_dict["recipient_terms"] = recipient_terms
        if routing_keys is not UNSET:
            field_dict["routing_keys"] = routing_keys
        if state is not UNSET:
            field_dict["state"] = state
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        connection_id = d.pop("connection_id")

        role = d.pop("role")

        created_at = d.pop("created_at", UNSET)

        endpoint = d.pop("endpoint", UNSET)

        mediation_id = d.pop("mediation_id", UNSET)

        mediator_terms = cast(List[str], d.pop("mediator_terms", UNSET))

        recipient_terms = cast(List[str], d.pop("recipient_terms", UNSET))

        routing_keys = cast(List[str], d.pop("routing_keys", UNSET))

        state = d.pop("state", UNSET)

        updated_at = d.pop("updated_at", UNSET)

        mediation_record = cls(
            connection_id=connection_id,
            role=role,
            created_at=created_at,
            endpoint=endpoint,
            mediation_id=mediation_id,
            mediator_terms=mediator_terms,
            recipient_terms=recipient_terms,
            routing_keys=routing_keys,
            state=state,
            updated_at=updated_at,
        )

        mediation_record.additional_properties = d
        return mediation_record

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
