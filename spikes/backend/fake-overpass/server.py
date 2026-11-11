"""A stand-in for Overpass in the measurements: answers every POST with the same recorded JSON.

Using the real Overpass in a measurement would load the same machine and make the numbers depend on
it, and a public server must not be hit by a load test. `answer.json` is a recorded answer of the
local Overpass server for a small area around the Rondje Eilanden.
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ANSWER = (Path(__file__).parent / "answer.json").read_bytes()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.rfile.read(int(self.headers.get("content-length", 0)))
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(ANSWER)))
        self.end_headers()
        self.wfile.write(ANSWER)

    def log_message(self, *args):
        pass


HTTPServer(("0.0.0.0", 8081), Handler).serve_forever()
