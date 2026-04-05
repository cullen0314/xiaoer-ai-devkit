from __future__ import annotations

import json
from dataclasses import MISSING, asdict, fields
from typing import Any, get_args, get_origin, get_type_hints


class SimpleModel:
    @classmethod
    def model_validate(cls, data: Any):
        if isinstance(data, cls):
            return data
        if data is None:
            data = {}
        if not isinstance(data, dict):
            raise TypeError(f"{cls.__name__} expects dict data")
        kwargs = {}
        type_hints = get_type_hints(cls)
        for field in fields(cls):
            if field.name in data:
                value = data[field.name]
            elif field.default is not MISSING:
                value = field.default
            elif field.default_factory is not MISSING:
                value = field.default_factory()
            else:
                value = getattr(cls, field.name, None)
            field_type = type_hints.get(field.name, field.type)
            kwargs[field.name] = _convert_value(field_type, value)
        return cls(**kwargs)

    @classmethod
    def model_validate_json(cls, value: str):
        return cls.model_validate(json.loads(value))

    def model_dump(self) -> dict[str, Any]:
        return asdict(self)


def _convert_value(tp: Any, value: Any):
    origin = get_origin(tp)
    args = get_args(tp)
    if origin is not None and type(None) in args:
        non_none = [arg for arg in args if arg is not type(None)]
        if value is None:
            return None
        if non_none:
            return _convert_value(non_none[0], value)
    if origin is list and args:
        return [_convert_value(args[0], item) for item in (value or [])]
    if origin is dict and args:
        return {k: _convert_value(args[1], v) for k, v in (value or {}).items()}
    if tp is list:
        return list(value or [])
    if tp is dict:
        return dict(value or {})
    if value is None:
        return None
    if isinstance(tp, type) and issubclass(tp, SimpleModel):
        return tp.model_validate(value)
    return value
