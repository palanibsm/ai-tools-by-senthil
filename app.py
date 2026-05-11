from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

expenses = []


def compute_balances(expense_items):
    balances = {}
    for exp in expense_items:
        amount = float(exp['amount'])
        paid_by = exp['paid_by']
        participants = exp['participants']
        share = amount / len(participants)

        balances.setdefault(paid_by, 0.0)
        balances[paid_by] += amount

        for person in participants:
            balances.setdefault(person, 0.0)
            balances[person] -= share

    # Round and clean tiny floats
    clean = {}
    for person, value in balances.items():
        v = round(value, 2)
        if abs(v) > 0.0:
            clean[person] = v
        else:
            clean[person] = 0.0
    return clean


def compute_settlements(balances):
    creditors = []
    debtors = []

    for person, bal in balances.items():
        if bal > 0.0:
            creditors.append([person, bal])
        elif bal < 0.0:
            debtors.append([person, -bal])  # owed amount as positive

    settlements = []
    i = j = 0
    while i < len(debtors) and j < len(creditors):
        debtor, owe = debtors[i]
        creditor, recv = creditors[j]
        amount = round(min(owe, recv), 2)

        if amount > 0:
            settlements.append({"from": debtor, "to": creditor, "amount": amount})

        owe = round(owe - amount, 2)
        recv = round(recv - amount, 2)

        debtors[i][1] = owe
        creditors[j][1] = recv

        if owe == 0:
            i += 1
        if recv == 0:
            j += 1

    return settlements


@app.get('/')
def home():
    if request.headers.get('Accept', '').startswith('application/json'):
        return jsonify({"message": "Hello from youtube-test webapp"})
    return render_template('index.html')


@app.get('/health')
def health():
    return jsonify({"status": "ok"})


@app.get('/expenses')
def list_expenses():
    return jsonify({"expenses": expenses})


@app.post('/expenses')
def add_expense():
    payload = request.get_json(silent=True) or {}
    description = payload.get('description', '').strip()
    amount = payload.get('amount')
    paid_by = payload.get('paid_by', '').strip()
    participants = payload.get('participants', [])

    if not description or not paid_by or not isinstance(participants, list) or len(participants) == 0:
        return jsonify({"error": "description, paid_by, participants are required"}), 400

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400

    if amount <= 0:
        return jsonify({"error": "amount must be greater than zero"}), 400

    participants = [str(p).strip() for p in participants if str(p).strip()]
    if len(participants) == 0:
        return jsonify({"error": "participants cannot be empty"}), 400

    if paid_by not in participants:
        participants.append(paid_by)

    item = {
        'description': description,
        'amount': round(amount, 2),
        'paid_by': paid_by,
        'participants': participants,
    }
    expenses.append(item)

    return jsonify(item), 201


@app.get('/summary')
def summary():
    balances = compute_balances(expenses)
    settlements = compute_settlements(balances)
    return jsonify({
        'total_expenses': round(sum(float(e['amount']) for e in expenses), 2),
        'balances': balances,
        'settlements': settlements,
    })


@app.post('/reset')
def reset():
    expenses.clear()
    return jsonify({"ok": True})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
