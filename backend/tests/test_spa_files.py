"""Production static serving: every PWA build file reachable, nothing outside it."""

import importlib

from fastapi.testclient import TestClient


def _client(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "demo").mkdir(parents=True)
    (dist / "index.html").write_text("<html>shell</html>", encoding="utf-8")
    (dist / "push-sw.js").write_text("self.addEventListener('push',()=>{})", encoding="utf-8")
    (dist / "demo" / "zebra-list.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("nope", encoding="utf-8")
    monkeypatch.setenv("SERVE_FRONTEND", "true")
    monkeypatch.setenv("FRONTEND_DIST", str(dist))
    monkeypatch.setenv("LIVE_WATCH", "false")
    from src.core.config import reload_settings
    import src.main as main

    reload_settings()
    importlib.reload(main)
    return TestClient(main.app)


def test_serves_build_files_and_shell(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    assert "push" in c.get("/push-sw.js").text
    assert c.get("/demo/zebra-list.svg").text == "<svg/>"
    assert "shell" in c.get("/app/live").text
    assert "shell" in c.get("/").text


def test_blocks_traversal_and_unknown_api(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    assert "nope" not in c.get("/..%2Fsecret.txt").text
    assert c.get("/api/does-not-exist").status_code == 404
