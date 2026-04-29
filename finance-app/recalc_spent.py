import json

try:
    with open('database.json', 'r') as f:
        db = json.load(f)
        
    transactions = db.get('transactionsState', [])
    categories = db.get('budgetState', {}).get('categories', [])
    
    # 1. Reset all spent to 0
    for cat in categories:
        cat['spent'] = 0
        
    # 2. Recalculate strictly based on existing transactions arrays
    for tx in transactions:
        amount = tx.get('amount', 0)
        cname = tx.get('category', '기타')
        
        found = False
        for cat in categories:
            if cat['name'] == cname:
                cat['spent'] += amount
                found = True
                break
        
        # If it somehow matches an unknown category, throw it into 기타 (Other)
        if not found:
            for cat in categories:
                if cat['name'] == '기타':
                    cat['spent'] += amount
                    break

    # 3. Save it back securely
    with open('database.json', 'w') as f:
        json.dump(db, f)
        
    print("Database spending metrics perfectly recalibrated based on individual transaction histories!")
except Exception as e:
    print("Failed to recalibrate:", e)
