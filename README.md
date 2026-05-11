# youtube-test

Simple Python Flask web app with tests.

## Team Expense Splitter (MVP)
A simple web app to track shared expenses (lunch, picnic, etc.) and calculate who should pay whom.

### Features
- Add members for an event
- Add expenses with:
  - description
  - amount
  - paid by
  - participants
- Auto-calculate:
  - per-person net balances
  - settlement instructions (who pays whom)
- Reset event data

## API Endpoints
- `GET /` → HTML web UI (or JSON hello message if `Accept: application/json`)
- `GET /health` → `{ "status": "ok" }`
- `GET /expenses` → list all expenses
- `POST /expenses` → add one expense
- `GET /summary` → total, balances, settlements
- `POST /reset` → clear current data

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
