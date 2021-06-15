from typing import Any, Dict, List, Type, TypeVar

import attr

from ..models.connection_metadata_set_request_metadata import ConnectionMetadataSetRequestMetadata

T = TypeVar("T", bound="ConnectionMetadataSetRequest")


@attr.s(auto_attribs=True)
class ConnectionMetadataSetRequest:
    """ """

    metadata: ConnectionMetadataSetRequestMetadata
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        metadata = self.metadata.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "metadata": metadata,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        metadata = ConnectionMetadataSetRequestMetadata.from_dict(d.pop("metadata"))

        connection_metadata_set_request = cls(
            metadata=metadata,
        )

        connection_metadata_set_request.additional_properties = d
        return connection_metadata_set_request

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
