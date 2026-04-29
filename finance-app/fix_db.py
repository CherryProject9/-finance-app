import json

base_categories = [
    { 'name': '주거비', 'spent': 0, 'limit': 1500000, 'colorClass': 'warning', 'colorHex': '#6366f1' },
    { 'name': '식비', 'spent': 0, 'limit': 500000, 'colorClass': 'primary', 'colorHex': '#818cf8' },
    { 'name': '외식', 'spent': 0, 'limit': 300000, 'colorClass': 'primary', 'colorHex': '#a78bfa' },
    { 'name': '교통비', 'spent': 0, 'limit': 300000, 'colorClass': 'primary', 'colorHex': '#10b981' },
    { 'name': '여가비', 'spent': 0, 'limit': 200000, 'colorClass': 'danger', 'colorHex': '#f43f5e' },
    { 'name': '공과금', 'spent': 0, 'limit': 200000, 'colorClass': 'primary', 'colorHex': '#f59e0b' },
    { 'name': '기타', 'spent': 0, 'limit': 400000, 'colorClass': 'primary', 'colorHex': '#475569' },
    { 'name': '쇼핑', 'spent': 0, 'limit': 200000, 'colorClass': 'primary', 'colorHex': '#ec4899' }
]

def merge_db():
    try:
        with open('database.json', 'r') as f:
            db = json.load(f)
            
        current_cats = db.get('budgetState', {}).get('categories', [])
        current_map = {c['name']: c for c in current_cats}
        
        merged = []
        for bc in base_categories:
            if bc['name'] in current_map:
                merged.append(current_map[bc['name']])
            else:
                merged.append(bc)
                
        db['budgetState']['categories'] = merged
        
        with open('database.json', 'w') as f:
            json.dump(db, f)
        print("Successfully merged 8 categories natively into database.json")
    except Exception as e:
        print("Error:", e)

merge_db()
