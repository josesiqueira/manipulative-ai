"""Audio in memory: float samples to WAV or MP3 bytes, WAV back to samples."""
from __future__ import annotations

import io
import wave

import numpy as np


def write_wav(samples: np.ndarray, rate: int) -> bytes:
    clipped = np.clip(samples, -1.0, 1.0)
    pcm = (clipped * 32767).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def write_mp3(samples: np.ndarray, rate: int, bit_rate: int = 64000) -> bytes:
    """MP3, mono, at the voice's own rate: an 8 s sentence is about 65 KB
    instead of 360 KB as WAV, which matters with a lecture room of phones on
    one Wi-Fi. Every browser's decodeAudioData reads it."""
    import av

    buf = io.BytesIO()
    with av.open(buf, mode="w", format="mp3") as container:
        stream = container.add_stream("libmp3lame", rate=rate)
        stream.bit_rate = bit_rate
        stream.layout = "mono"
        data = np.clip(samples, -1.0, 1.0).astype(np.float32).reshape(1, -1)
        frame = av.AudioFrame.from_ndarray(data, format="fltp", layout="mono")
        frame.sample_rate = rate
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    return buf.getvalue()


def read_wav(src: io.BytesIO) -> tuple[np.ndarray, int]:
    with wave.open(src, "rb") as w:
        rate = w.getframerate()
        channels = w.getnchannels()
        width = w.getsampwidth()
        frames = w.readframes(w.getnframes())
    if width != 2:
        raise ValueError("Only 16-bit WAV is supported")
    data = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    return data, rate


def resample(samples: np.ndarray, rate: int, target: int) -> np.ndarray:
    if rate == target or samples.size == 0:
        return samples.astype(np.float32)
    n = int(round(samples.size * target / rate))
    x_old = np.linspace(0.0, 1.0, samples.size, endpoint=False)
    x_new = np.linspace(0.0, 1.0, n, endpoint=False)
    return np.interp(x_new, x_old, samples).astype(np.float32)
