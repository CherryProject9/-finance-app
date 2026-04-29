import json
import urllib.request
import urllib.error

# Supabase Config
SUPABASE_URL = 'https://gqmqegrmydtqxfnzdpty.supabase.co'
SUPABASE_KEY = 'sb_publishable_UHVHuIwKWVGuMGgqD-ti6A_mFMAxXr9'
STORAGE_ID = '00000000-0000-0000-0000-000000000000'

def migrate():
    try:
        # 1. Read local data
        with open('database.json', 'r') as f:
            data = json.load(f)
        
        print(f"✅ Read local database.json")

        # 2. Prepare payload for Supabase (Upsert)
        payload = {
            "id": STORAGE_ID,
            "state": data
        }
        json_payload = json.dumps(payload).encode('utf-8')

        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }

        # 3. Push to Supabase using urllib
        url = f"{SUPABASE_URL}/rest/v1/finance_storage"
        req = urllib.request.Request(url, data=json_payload, headers=headers, method='POST')

        try:
            with urllib.request.urlopen(req) as response:
                status = response.getcode()
                if status in [200, 201, 204]:
                    print(f"🚀 Migration successful! Data is now in Supabase.")
                else:
                    print(f"❌ Migration failed with status: {status}")
        except urllib.error.HTTPError as e:
            print(f"❌ HTTP Error {e.code}: {e.read().decode('utf-8')}")
        except urllib.error.URLError as e:
            print(f"❌ URL Error: {e.reason}")

    except FileNotFoundError:
        print("❌ database.json not found.")
    except Exception as e:
        print(f"❌ Error during migration: {e}")

if __name__ == "__main__":
    migrate()
