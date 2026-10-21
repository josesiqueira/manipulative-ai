"""
Fetch the local speech models at image build, pinned to Hugging Face
revisions and checked against SHA-256 sums, so the image is reproducible and
a changed upstream file fails the build instead of running.

Usage: python scripts/fetch_speech_models.py /app/models
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

PIPER_REVISION = "c10ece1aade47bb51c153c893d14e5bf8e5b7117"  # rhasspy/piper-voices, 2026-10-17
PIPER_FILES = {
    "fi/fi_FI/harri/medium/fi_FI-harri-medium.onnx": "a44167faa34caed940e4fcad139fcc35922266b2593bcebe77701774c0fb2389",
    "fi/fi_FI/harri/medium/fi_FI-harri-medium.onnx.json": "3f9c9f76f74adf1fbe7279e41eea17d6610757e45effd6808bbea6be74b8916d",
    "en/en_GB/alan/medium/en_GB-alan-medium.onnx": "0a309668932205e762801f1efc2736cd4b0120329622adf62be09e56339d3330",
    "en/en_GB/alan/medium/en_GB-alan-medium.onnx.json": "c0f0d124e5895c00e7c03b35dcc8287f319a6998a365b182deb5c8e752ee8c1e",
}
WHISPER_REVISION = "536b0662742c02347bc0e980a01041f333bce120"  # Systran/faster-whisper-small, 2026-10-17
# NVIDIA Parakeet TDT 0.6B v3 (CC BY 4.0), int8 ONNX export for onnx-asr:
# 0.9 s for an 8 s Finnish clip on 4 CPU and fewer Finnish errors than
# whisper small (measured 2026-10-21).
PARAKEET_REVISION = "8f23f0c03c8761650bdb5b40aaf3e40d2c15f1ce"  # istupakov/parakeet-tdt-0.6b-v3-onnx
PARAKEET_FILES = {
    "config.json": "666903c76b9798caf2c210afd4f6cd60b08a8dbf9800ec8d7a3bc0d2148ac466",
    "decoder_joint-model.int8.onnx": "eea7483ee3d1a30375daedc8ed83e3960c91b098812127a0d99d1c8977667a70",
    "encoder-model.int8.onnx": "6139d2fa7e1b086097b277c7149725edbab89cc7c7ae64b23c741be4055aff09",
    "vocab.txt": "d58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for rel, digest in PIPER_FILES.items():
        out = target / Path(rel).name
        url = f"https://huggingface.co/rhasspy/piper-voices/resolve/{PIPER_REVISION}/{rel}"
        urllib.request.urlretrieve(url, out)
        got = sha256(out)
        if got != digest:
            raise SystemExit(f"Checksum mismatch for {rel}: {got}")
        print(f"ok {out.name}")

    parakeet = target / "parakeet-tdt-0.6b-v3"
    parakeet.mkdir(exist_ok=True)
    for name, digest in PARAKEET_FILES.items():
        out = parakeet / name
        url = f"https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/resolve/{PARAKEET_REVISION}/{name}"
        urllib.request.urlretrieve(url, out)
        got = sha256(out)
        if got != digest:
            raise SystemExit(f"Checksum mismatch for parakeet {name}: {got}")
        print(f"ok parakeet {name}")

    from faster_whisper.utils import download_model

    download_model("small", output_dir=str(target / "whisper-small"), revision=WHISPER_REVISION)
    print("ok whisper-small")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
