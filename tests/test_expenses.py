from app import app


def test_summary_initially_empty():
    client = app.test_client()
    client.post('/reset')
    response = client.get('/summary')
    assert response.status_code == 200
    data = response.get_json()
    assert data['balances'] == {}
    assert data['settlements'] == []


def test_add_expense_and_compute_balances():
    client = app.test_client()
    client.post('/reset')

    payload = {
        'description': 'Lunch',
        'amount': 900,
        'paid_by': 'Alice',
        'participants': ['Alice', 'Bob', 'Cara']
    }
    add_resp = client.post('/expenses', json=payload)
    assert add_resp.status_code == 201

    summary = client.get('/summary').get_json()

    # Each share = 300. Alice paid 900, so net +600.
    assert round(summary['balances']['Alice'], 2) == 600.0
    assert round(summary['balances']['Bob'], 2) == -300.0
    assert round(summary['balances']['Cara'], 2) == -300.0


def test_settlement_for_multiple_expenses():
    client = app.test_client()
    client.post('/reset')

    client.post('/expenses', json={
        'description': 'Lunch',
        'amount': 900,
        'paid_by': 'Alice',
        'participants': ['Alice', 'Bob', 'Cara']
    })
    client.post('/expenses', json={
        'description': 'Taxi',
        'amount': 300,
        'paid_by': 'Bob',
        'participants': ['Alice', 'Bob', 'Cara']
    })

    summary = client.get('/summary').get_json()

    # Net balances expected:
    # Alice: +500, Bob: -100, Cara: -400
    assert round(summary['balances']['Alice'], 2) == 500.0
    assert round(summary['balances']['Bob'], 2) == -100.0
    assert round(summary['balances']['Cara'], 2) == -400.0

    settlements = summary['settlements']
    assert len(settlements) == 2
    # Order-independent checks
    normalized = {(s['from'], s['to'], round(s['amount'], 2)) for s in settlements}
    assert ('Bob', 'Alice', 100.0) in normalized
    assert ('Cara', 'Alice', 400.0) in normalized


def test_validation_rejects_bad_amount():
    client = app.test_client()
    client.post('/reset')
    bad = client.post('/expenses', json={
        'description': 'Bad',
        'amount': 0,
        'paid_by': 'Alice',
        'participants': ['Alice', 'Bob']
    })
    assert bad.status_code == 400
