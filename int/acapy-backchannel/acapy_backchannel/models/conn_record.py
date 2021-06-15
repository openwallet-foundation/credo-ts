from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.conn_record_accept import ConnRecordAccept
from ..models.conn_record_invitation_mode import ConnRecordInvitationMode
from ..models.conn_record_routing_state import ConnRecordRoutingState
from ..models.conn_record_their_role import ConnRecordTheirRole
from ..types import UNSET, Unset

T = TypeVar("T", bound="ConnRecord")


@attr.s(auto_attribs=True)
class ConnRecord:
    """ """

    connection_id: str
    state: str
    accept: Union[Unset, ConnRecordAccept] = UNSET
    alias: Union[Unset, str] = UNSET
    created_at: Union[Unset, str] = UNSET
    error_msg: Union[Unset, str] = UNSET
    inbound_connection_id: Union[Unset, str] = UNSET
    invitation_key: Union[Unset, str] = UNSET
    invitation_mode: Union[Unset, ConnRecordInvitationMode] = UNSET
    invitation_msg_id: Union[Unset, str] = UNSET
    my_did: Union[Unset, str] = UNSET
    request_id: Union[Unset, str] = UNSET
    rfc_23_state: Union[Unset, str] = UNSET
    routing_state: Union[Unset, ConnRecordRoutingState] = UNSET
    their_did: Union[Unset, str] = UNSET
    their_label: Union[Unset, str] = UNSET
    their_public_did: Union[Unset, str] = UNSET
    their_role: Union[Unset, ConnRecordTheirRole] = UNSET
    updated_at: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        connection_id = self.connection_id
        state = self.state
        accept: Union[Unset, str] = UNSET
        if not isinstance(self.accept, Unset):
            accept = self.accept.value

        alias = self.alias
        created_at = self.created_at
        error_msg = self.error_msg
        inbound_connection_id = self.inbound_connection_id
        invitation_key = self.invitation_key
        invitation_mode: Union[Unset, str] = UNSET
        if not isinstance(self.invitation_mode, Unset):
            invitation_mode = self.invitation_mode.value

        invitation_msg_id = self.invitation_msg_id
        my_did = self.my_did
        request_id = self.request_id
        rfc_23_state = self.rfc_23_state
        routing_state: Union[Unset, str] = UNSET
        if not isinstance(self.routing_state, Unset):
            routing_state = self.routing_state.value

        their_did = self.their_did
        their_label = self.their_label
        their_public_did = self.their_public_did
        their_role: Union[Unset, str] = UNSET
        if not isinstance(self.their_role, Unset):
            their_role = self.their_role.value

        updated_at = self.updated_at

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "connection_id": connection_id,
                "state": state,
            }
        )
        if accept is not UNSET:
            field_dict["accept"] = accept
        if alias is not UNSET:
            field_dict["alias"] = alias
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if error_msg is not UNSET:
            field_dict["error_msg"] = error_msg
        if inbound_connection_id is not UNSET:
            field_dict["inbound_connection_id"] = inbound_connection_id
        if invitation_key is not UNSET:
            field_dict["invitation_key"] = invitation_key
        if invitation_mode is not UNSET:
            field_dict["invitation_mode"] = invitation_mode
        if invitation_msg_id is not UNSET:
            field_dict["invitation_msg_id"] = invitation_msg_id
        if my_did is not UNSET:
            field_dict["my_did"] = my_did
        if request_id is not UNSET:
            field_dict["request_id"] = request_id
        if rfc_23_state is not UNSET:
            field_dict["rfc23_state"] = rfc_23_state
        if routing_state is not UNSET:
            field_dict["routing_state"] = routing_state
        if their_did is not UNSET:
            field_dict["their_did"] = their_did
        if their_label is not UNSET:
            field_dict["their_label"] = their_label
        if their_public_did is not UNSET:
            field_dict["their_public_did"] = their_public_did
        if their_role is not UNSET:
            field_dict["their_role"] = their_role
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        connection_id = d.pop("connection_id")

        state = d.pop("state")

        accept: Union[Unset, ConnRecordAccept] = UNSET
        _accept = d.pop("accept", UNSET)
        if not isinstance(_accept, Unset):
            accept = ConnRecordAccept(_accept)

        alias = d.pop("alias", UNSET)

        created_at = d.pop("created_at", UNSET)

        error_msg = d.pop("error_msg", UNSET)

        inbound_connection_id = d.pop("inbound_connection_id", UNSET)

        invitation_key = d.pop("invitation_key", UNSET)

        invitation_mode: Union[Unset, ConnRecordInvitationMode] = UNSET
        _invitation_mode = d.pop("invitation_mode", UNSET)
        if not isinstance(_invitation_mode, Unset):
            invitation_mode = ConnRecordInvitationMode(_invitation_mode)

        invitation_msg_id = d.pop("invitation_msg_id", UNSET)

        my_did = d.pop("my_did", UNSET)

        request_id = d.pop("request_id", UNSET)

        rfc_23_state = d.pop("rfc23_state", UNSET)

        routing_state: Union[Unset, ConnRecordRoutingState] = UNSET
        _routing_state = d.pop("routing_state", UNSET)
        if not isinstance(_routing_state, Unset):
            routing_state = ConnRecordRoutingState(_routing_state)

        their_did = d.pop("their_did", UNSET)

        their_label = d.pop("their_label", UNSET)

        their_public_did = d.pop("their_public_did", UNSET)

        their_role: Union[Unset, ConnRecordTheirRole] = UNSET
        _their_role = d.pop("their_role", UNSET)
        if not isinstance(_their_role, Unset):
            their_role = ConnRecordTheirRole(_their_role)

        updated_at = d.pop("updated_at", UNSET)

        conn_record = cls(
            connection_id=connection_id,
            state=state,
            accept=accept,
            alias=alias,
            created_at=created_at,
            error_msg=error_msg,
            inbound_connection_id=inbound_connection_id,
            invitation_key=invitation_key,
            invitation_mode=invitation_mode,
            invitation_msg_id=invitation_msg_id,
            my_did=my_did,
            request_id=request_id,
            rfc_23_state=rfc_23_state,
            routing_state=routing_state,
            their_did=their_did,
            their_label=their_label,
            their_public_did=their_public_did,
            their_role=their_role,
            updated_at=updated_at,
        )

        conn_record.additional_properties = d
        return conn_record

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
