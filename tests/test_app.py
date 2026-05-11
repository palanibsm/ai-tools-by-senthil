from app import app


def test_home_route():
    client = app.test_client()
    response = client.get('/', headers={'Accept': 'application/json'})
    assert response.status_code == 200
    assert response.get_json() == {"message": "Hello from youtube-test webapp"}


def test_health_route():
    client = app.test_client()
    response = client.get('/health')
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
