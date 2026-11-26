#!/usr/bin/env python3
"""Quick smoke test for industrial-twin-skill manifests and scaffolding."""
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent


def run(cmd: list[str]) -> None:
    print(">>", " ".join(cmd))
    res = subprocess.run(cmd, cwd=ROOT)
    if res.returncode != 0:
        sys.exit(res.returncode)


def main() -> None:
    manifests = [
        ROOT / "assets" / "template" / "twin.manifest.json",
        ROOT / "examples" / "smart-factory-scada" / "twin.manifest.json",
        ROOT / "examples" / "smt-pick-and-place" / "twin.manifest.json",
    ]
    for m in manifests:
        run([sys.executable, "scripts/validate_manifest.py", str(m)])

    with tempfile.TemporaryDirectory() as tmp:
        out_dir = Path(tmp) / "smoke-line"
        run([sys.executable, "scripts/make_project.py", "--out", str(out_dir), "--mode", "html"])
        run([sys.executable, "scripts/validate_manifest.py", str(out_dir / "twin.manifest.json")])

    print("\nALL SMOKE TESTS PASSED.")


if __name__ == "__main__":
    main()
