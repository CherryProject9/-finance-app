import http.server
import socketserver
import json
import os
import shutil
import glob
from datetime import datetime

PORT = 8080
DB_FILE = 'database.json'
MAX_BACKUPS = 15

# Initialize DB if not exists
if not os.path.exists(DB_FILE):
    with open(DB_FILE, 'w') as f:
        json.dump({'budgetState': None, 'transactionsState': None, 'customCategoryRules': None}, f)

def manage_backups():
    if os.path.exists(DB_FILE):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f'database_bak_{timestamp}.json'
        shutil.copy2(DB_FILE, backup_name)
    
    # Cleanup old backups
    backups = sorted(glob.glob('database_bak_*.json'))
    if len(backups) > MAX_BACKUPS:
        for old in backups[:-MAX_BACKUPS]:
            os.remove(old)

class BackendHandler(http.server.SimpleHTTPRequestHandler):
    def add_cors_headers(self):
        origin = self.headers.get('Origin', '*')
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin')
        self.send_header('Access-Control-Allow-Credentials', 'true')

    def end_headers(self):
        # Force cache breaking for all files served
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/data':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.add_cors_headers()
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            with open(DB_FILE, 'r') as f:
                self.wfile.write(f.read().encode('utf-8'))
        elif self.path == '/api/backups':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.add_cors_headers()
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            backups = sorted(glob.glob('database_bak_*.json'), reverse=True)
            backup_data = []
            for b in backups:
                sz = os.path.getsize(b)
                backup_data.append({'filename': b, 'size': sz})
            self.wfile.write(json.dumps(backup_data).encode('utf-8'))
        elif self.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.add_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'version': 102}).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/data':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                manage_backups()
                with open(DB_FILE, 'w') as f:
                    json.dump(data, f)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.add_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.add_cors_headers()
                self.end_headers()
                self.wfile.write(b'Error saving data')
        elif self.path == '/api/restore':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                target_bak = payload.get('filename')
                if target_bak and os.path.exists(target_bak):
                    # Validate it's a backup file to prevent path traversal
                    if target_bak.startswith('database_bak_') and target_bak.endswith('.json'):
                        # Before we overwrite via restore, let's take a macro backup just in case of an accidental restore!
                        safe_copy = f'database_bak_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
                        shutil.copy2(DB_FILE, safe_copy)
                        
                        shutil.copy2(target_bak, DB_FILE)
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.add_cors_headers()
                        self.end_headers()
                        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
                        return
                self.send_response(400)
                self.add_cors_headers()
                self.end_headers()
                self.wfile.write(b'Invalid backup specified')
            except Exception as e:
                self.send_response(400)
                self.add_cors_headers()
                self.end_headers()
                self.wfile.write(b'Error restoring data')
        else:
            self.send_error(404, "Endpoint not found")

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.add_cors_headers()
        self.end_headers()

socketserver.TCPServer.allow_reuse_address = True

if __name__ == '__main__':
    import socket

    def get_local_ips():
        ips = []
        try:
            hostname = socket.gethostname()
            all_addrs = socket.getaddrinfo(hostname, None)
            for addr in all_addrs:
                ip = addr[4][0]
                if ip.startswith('172.') or ip.startswith('192.168.') or ip.startswith('10.'):
                    if ip not in ips:
                        ips.append(ip)
        except Exception:
            pass
        # Fallback: connect to a public address to determine outbound IP
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
            s.close()
            if ip not in ips:
                ips.append(ip)
        except Exception:
            pass
        return ips

    httpd = http.server.HTTPServer(("0.0.0.0", PORT), BackendHandler)
    print(f"\n✅ FinanceOS Server running on port {PORT}")
    print(f"   Local:   http://localhost:{PORT}")
    for ip in get_local_ips():
        print(f"   Network: http://{ip}:{PORT}   <-- use this on your phone")
    print("\nPress Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()
