"""Smoke tests for Infyro auth helpers and allow-list."""

from __future__ import annotations

from infyro_api.security import generate_otp, hash_otp
from infyro_api.services.auth_service import normalize_phone


def test_normalize_phone():
    assert normalize_phone("15551212").startswith("+")


def test_otp_hash_roundtrip_shape():
    code = generate_otp()
    assert len(code) == 6
    assert hash_otp(code) != code
    assert hash_otp(code) == hash_otp(code)
