from typing import Any, Dict, List, Optional, Type, TypeVar

import attr

from ..models.aml_record import AMLRecord
from ..models.taa_acceptance import TAAAcceptance
from ..models.taa_record import TAARecord

T = TypeVar("T", bound="TAAInfo")


@attr.s(auto_attribs=True)
class TAAInfo:
    """ """

    aml_record: AMLRecord
    taa_record: TAARecord
    taa_required: bool
    taa_accepted: Optional[TAAAcceptance]
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        aml_record = self.aml_record.to_dict()

        taa_record = self.taa_record.to_dict()

        taa_required = self.taa_required
        taa_accepted = self.taa_accepted.to_dict() if self.taa_accepted else None

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "aml_record": aml_record,
                "taa_record": taa_record,
                "taa_required": taa_required,
                "taa_accepted": taa_accepted,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        aml_record = AMLRecord.from_dict(d.pop("aml_record"))

        taa_record = TAARecord.from_dict(d.pop("taa_record"))

        taa_required = d.pop("taa_required")

        taa_accepted = None
        _taa_accepted = d.pop("taa_accepted")
        if _taa_accepted is not None:
            taa_accepted = TAAAcceptance.from_dict(_taa_accepted)

        taa_info = cls(
            aml_record=aml_record,
            taa_record=taa_record,
            taa_required=taa_required,
            taa_accepted=taa_accepted,
        )

        taa_info.additional_properties = d
        return taa_info

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
