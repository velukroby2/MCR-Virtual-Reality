"""Optional maintainer helper; Python is not needed to run or deploy this app."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256
import os
root = Path(__file__).resolve().parent.parent
out = root.parent / "MCR-Live-Lite-Render.zip"
partial = out.with_suffix(".zip.partial")
entries = {}
# Source-only GitHub repo: Render builds dist/. No photos or private files.
for name in ["index.html", "style.css", "package.json", "render.yaml", "README.md", ".gitignore", "src", "media", "vendor", "scripts", "tests"]:
    path = root / name
    files = [path] if path.is_file() else sorted(p for p in path.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    for file in files:
        entries[file.relative_to(root).as_posix()] = file.read_bytes()
with ZipFile(partial, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in entries.items():
        archive.writestr(name, data)
with ZipFile(partial) as archive:
    assert archive.testzip() is None
    assert {"render.yaml", "package.json", "index.html", "vendor/three.module.js", "media/Input A.svg", "media/Rescue.svg"}.issubset(archive.namelist())
    for name, data in entries.items():
        assert sha256(archive.read(name)).digest() == sha256(data).digest()
os.replace(partial, out)
print(f"Verified {out.name}: {len(entries)} files, {out.stat().st_size:,} bytes. ZIP root is ready for GitHub.")
