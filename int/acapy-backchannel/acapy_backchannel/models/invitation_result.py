from typing import Any, Dict, List, Type, TypeVar

import attr

from ..models.connection_invitation import ConnectionInvitation

T = TypeVar("T", bound="InvitationResult")


@attr.s(auto_attribs=True)
class InvitationResult:
    """ """

    connection_id: str
    invitation: ConnectionInvitation
    invitation_url: str
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        connection_id = self.connection_id
        invitation = self.invitation.to_dict()

        invitation_url = self.invitation_url

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "connection_id": connection_id,
                "invitation": invitation,
                "invitation_url": invitation_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        connection_id = d.pop("connection_id")

        invitation = ConnectionInvitation.from_dict(d.pop("invitation"))

        invitation_url = d.pop("invitation_url")

        invitation_result = cls(
            connection_id=connection_id,
            invitation=invitation,
            invitation_url=invitation_url,
        )

        invitation_result.additional_properties = d
        return invitation_result

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
