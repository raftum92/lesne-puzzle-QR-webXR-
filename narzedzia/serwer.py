"""Serwer do podglądu aplikacji: pliki projektu z obsługą nagłówka Range.

Bez Range Safari w ogóle nie odtworzy filmu, a inne przeglądarki nie pozwolą go przewijać.
Strona główna przekierowuje do aplikacji w app/.

Uruchomienie z katalogu projektu:
    python3 narzedzia/serwer.py                  # http://localhost:8000/app/
    python3 narzedzia/serwer.py --host 0.0.0.0   # także dla tabletu lub telefonu w tej samej sieci Wi-Fi
"""
import argparse
import functools
import http.server
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Po każdej zmianie w kodzie przeglądarka ma pobrać nową wersję plików.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        self.remaining = None
        if self.path == "/":
            self.send_response(302)
            self.send_header("Location", "/app/")
            self.end_headers()
            return None
        path = self.translate_path(self.path)
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if not match or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        first, last = match.groups()
        if first:
            start, end = int(first), min(int(last or size - 1), size - 1)
        else:  # „bytes=-500” to ostatnie 500 bajtów
            start, end = max(size - int(last or 0), 0), size - 1
        if start > end:
            self.send_error(416)
            return None
        handle = open(path, "rb")
        handle.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self.remaining = end - start + 1
        return handle

    def copyfile(self, source, destination):
        if self.remaining is None:
            return super().copyfile(source, destination)
        while self.remaining > 0:
            chunk = source.read(min(65536, self.remaining))
            if not chunk:
                break
            destination.write(chunk)
            self.remaining -= len(chunk)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--host", default="127.0.0.1", help="0.0.0.0 udostępnia aplikację w sieci lokalnej")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Aplikacja: http://localhost:{args.port}/app/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
