"""Tests for UUID validation utilities"""
import pytest
from app.utils.validation import is_valid_uuid, validate_uuid
from fastapi import HTTPException


class TestUUIDValidation:
    """Test UUID validation functions"""

    def test_is_valid_uuid_with_valid_uuid(self):
        """Valid UUID should return True"""
        valid_uuid = "123e4567-e89b-12d3-a456-426614174000"
        assert is_valid_uuid(valid_uuid) is True

    def test_is_valid_uuid_with_invalid_format(self):
        """Invalid UUID format should return False"""
        assert is_valid_uuid("not-a-uuid") is False

    def test_is_valid_uuid_with_empty_string(self):
        """Empty string should return False"""
        assert is_valid_uuid("") is False

    def test_is_valid_uuid_with_none(self):
        """None should return False"""
        assert is_valid_uuid(None) is False

    def test_is_valid_uuid_with_uppercase(self):
        """Uppercase UUID should be valid"""
        assert is_valid_uuid("123E4567-E89B-12D3-A456-426614174000") is True

    def test_is_valid_uuid_with_no_hyphens(self):
        """UUID without hyphens should be valid"""
        assert is_valid_uuid("123e4567e89b12d3a456426614174000") is True

    def test_validate_uuid_with_valid_uuid(self):
        """validate_uuid should return UUID string for valid input"""
        valid_uuid = "123e4567-e89b-12d3-a456-426614174000"
        result = validate_uuid(valid_uuid, "user_id")
        assert result == valid_uuid

    def test_validate_uuid_with_invalid_uuid(self):
        """validate_uuid should raise HTTPException for invalid UUID"""
        with pytest.raises(HTTPException) as exc_info:
            validate_uuid("invalid-uuid", "user_id")

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["code"] == "INVALID_UUID"
        assert "user_id" in exc_info.value.detail["detail"]

    def test_validate_uuid_custom_field_name(self):
        """validate_uuid should include custom field name in error"""
        with pytest.raises(HTTPException) as exc_info:
            validate_uuid("bad", "upload_id")

        assert "upload_id" in exc_info.value.detail["detail"]
