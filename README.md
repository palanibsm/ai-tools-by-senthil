# youtube-test

Simple Python Flask web app with tests.

## Endpoints
- `GET /` → `{ "message": "Hello from youtube-test webapp" }`
- `GET /health` → `{ "status": "ok" }`

## Setup
```bash
python3 -m ensurepip --user
python3 -m pip install --user -r requirements.txt
```

## Run app
```bash
python3 app.py
```

## Run tests
```bash
~/.local/bin/pytest -q
```
