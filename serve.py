#!/usr/bin/env python3
"""
Local server for the Mumbai DP 2034 Explorer.

Serves this folder with HTTP Range support (MapLibre reads the .pmtiles archives in
byte ranges) and opens the app in the default browser.

    python3 serve.py          # http://localhost:8000, or the next free port
    python3 serve.py 8080
"""
import functools
import http.server
import os
import socket
import socketserver
import sys
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
START_PORT = int(ARGS[0]) if ARGS else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".pmtiles": "application/octet-stream", ".json": "application/json",
                      ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        rng = self.headers.get("Range", "")
        path = self.translate_path(self.path)
        if not rng.startswith("bytes=") or not os.path.isfile(path):
            return super().do_GET()
        size = os.path.getsize(path)
        start_s, _, end_s = rng[6:].split(",")[0].partition("-")
        try:
            if start_s:
                start, end = int(start_s), int(end_s) if end_s else size - 1
            else:                                   # suffix range: last N bytes
                start, end = max(0, size - int(end_s)), size - 1
        except ValueError:
            return super().do_GET()
        end = min(end, size - 1)
        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        try:
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(1 << 16, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *args):
        pass


def free_port(start):
    for p in range(start, start + 50):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    raise SystemExit("no free port found")


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    port = free_port(START_PORT)
    with Server(("127.0.0.1", port), functools.partial(Handler, directory=HERE)) as httpd:
        url = f"http://localhost:{port}/"
        print(f"\n  Mumbai DP 2034 Explorer running at {url}\n  Press Ctrl+C to stop.\n", flush=True)
        if "--no-browser" not in sys.argv:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("  Stopped.")


if __name__ == "__main__":
    main()
