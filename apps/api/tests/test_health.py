from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.main import create_app

client = TestClient(create_app())


def test_liveness_does_not_require_database() -> None:
    with patch("app.health.get_engine") as engine:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    engine.assert_not_called()


def test_readiness_reports_database_failure_without_leaking_credentials() -> None:
    with patch("app.health.get_engine") as engine:
        engine.return_value.connect.side_effect = OperationalError("secret-url", {}, Exception())
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_readiness_checks_the_database() -> None:
    with patch("app.health.get_engine") as engine:
        connection = MagicMock()
        engine.return_value.connect.return_value.__enter__.return_value = connection
        response = client.get("/ready")
        connection.execute.assert_called_once()
    assert response.status_code == 200


def test_business_routes_are_not_fake_successes() -> None:
    assert client.get("/api/v1/store/orders").status_code == 404


def test_cors_only_accepts_configured_web_origins() -> None:
    headers = {"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"}
    assert client.options("/health", headers=headers).status_code == 200
    headers["Origin"] = "https://untrusted.example"
    assert client.options("/health", headers=headers).status_code == 400
