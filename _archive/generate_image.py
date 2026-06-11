#!/usr/bin/env python3
"""
generate_image.py — Bildgenerierung über die OpenAI Images API.

Liest den API-Key aus der Umgebungsvariable OPENAI_API_KEY (niemals im Code
hardcoden!), generiert aus einem Text-Prompt ein Bild mit dem aktuellen
OpenAI-Bildmodell `gpt-image-1` und speichert das Ergebnis als PNG im
Asset-Verzeichnis des Projekts (./assets).

Aufruf:
    python generate_image.py "ein Prompt-Text"
    python generate_image.py "ein Prompt-Text" --name hero-bild
    python generate_image.py "ein Prompt-Text" --size 1536x1024
"""

import argparse
import base64
import os
import re
import sys
from datetime import datetime

# Das aktuelle Bildmodell von OpenAI. Falls in deinem Account ein anderer
# Name freigeschaltet ist, kannst du ihn per --model überschreiben.
DEFAULT_MODEL = "gpt-image-1"

# Asset-Verzeichnis passend zur (flachen) Projektstruktur.
ASSET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")


def slugify(text: str) -> str:
    """Macht aus einem Prompt einen kurzen, dateinamenfreundlichen Slug."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return (text[:40] or "image").rstrip("-")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generiert ein Bild aus einem Text-Prompt über die OpenAI Images API."
    )
    parser.add_argument("prompt", help="Der Text-Prompt für das Bild.")
    parser.add_argument(
        "--name",
        help="Optionaler Dateiname (ohne .png). Standard: aus Prompt + Zeitstempel.",
    )
    parser.add_argument(
        "--size",
        default="1024x1024",
        help="Bildgröße, z.B. 1024x1024, 1536x1024, 1024x1536, auto (Standard: 1024x1024).",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Bildmodell (Standard: {DEFAULT_MODEL}).",
    )
    args = parser.parse_args()

    # --- API-Key aus der Umgebung lesen ---
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print(
            "Fehler: Die Umgebungsvariable OPENAI_API_KEY ist nicht gesetzt.\n"
            "Setze sie z.B. mit:  export OPENAI_API_KEY=\"sk-...\"",
            file=sys.stderr,
        )
        return 1

    # --- OpenAI-SDK importieren (klare Meldung, falls nicht installiert) ---
    try:
        from openai import OpenAI
    except ImportError:
        print(
            "Fehler: Das Paket 'openai' ist nicht installiert.\n"
            "Installiere es mit:  pip install openai",
            file=sys.stderr,
        )
        return 1

    client = OpenAI(api_key=api_key)

    # --- Bild generieren ---
    try:
        print(f"Generiere Bild mit Modell '{args.model}' …")
        result = client.images.generate(
            model=args.model,
            prompt=args.prompt,
            size=args.size,
            n=1,
        )
    except Exception as exc:  # API-, Netzwerk- oder Validierungsfehler
        print(f"Fehler bei der Bildgenerierung: {exc}", file=sys.stderr)
        return 1

    # --- Bilddaten extrahieren (gpt-image-1 liefert base64) ---
    item = result.data[0]
    if getattr(item, "b64_json", None):
        image_bytes = base64.b64decode(item.b64_json)
    elif getattr(item, "url", None):
        # Fallback für Modelle/Antworten, die eine URL liefern.
        try:
            import urllib.request

            with urllib.request.urlopen(item.url) as resp:
                image_bytes = resp.read()
        except Exception as exc:
            print(f"Fehler beim Laden des Bildes von der URL: {exc}", file=sys.stderr)
            return 1
    else:
        print("Fehler: Die API-Antwort enthielt keine Bilddaten.", file=sys.stderr)
        return 1

    # --- Speichern ---
    os.makedirs(ASSET_DIR, exist_ok=True)
    if args.name:
        filename = f"{slugify(args.name)}.png"
    else:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"{slugify(args.prompt)}-{timestamp}.png"

    out_path = os.path.join(ASSET_DIR, filename)
    with open(out_path, "wb") as f:
        f.write(image_bytes)

    print(f"Bild gespeichert unter: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
