from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="RouteRecord")


@attr.s(auto_attribs=True)
class RouteRecord:
    """ """

    recipient_key: str
    connection_id: Union[Unset, str] = UNSET
    created_at: Union[Unset, str] = UNSET
    record_id: Union[Unset, str] = UNSET
    role: Union[Unset, str] = UNSET
    state: Union[Unset, str] = UNSET
    updated_at: Union[Unset, str] = UNSET
    wallet_id: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        recipient_key = self.recipient_key
        connection_id = self.connection_id
        created_at = self.created_at
        record_id = self.record_id
        role = self.role
        state = self.state
        updated_at = self.updated_at
        wallet_id = self.wallet_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "recipient_key": recipient_key,
            }
        )
        if connection_id is not UNSET:
            field_dict["connection_id"] = connection_id
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if record_id is not UNSET:
            field_dict["record_id"] = record_id
        if role is not UNSET:
            field_dict["role"] = role
        if state is not UNSET:
            field_dict["state"] = state
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at
        if wallet_id is not UNSET:
            field_dict["wallet_id"] = wallet_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        recipient_key = d.pop("recipient_key")

        connection_id = d.pop("connection_id", UNSET)

        created_at = d.pop("created_at", UNSET)

        record_id = d.pop("record_id", UNSET)

        role = d.pop("role", UNSET)

        state = d.pop("state", UNSET)

        updated_at = d.pop("updated_at", UNSET)

        wallet_id = d.pop("wallet_id", UNSET)

        route_record = cls(
            recipient_key=recipient_key,
            connection_id=connection_id,
            created_at=created_at,
            record_id=record_id,
            role=role,
            state=state,
            updated_at=updated_at,
            wallet_id=wallet_id,
        )

        route_record.additional_properties = d
        return route_record

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
