import base64
import io
import json
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB upload limit

limiter = Limiter(get_remote_address, app=app, default_limits=[], storage_uri="memory://")

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

LINE_MAX_W = 320
LINE_MAX_H = 270
LINE_MIN_FRAMES = 5
LINE_MAX_FRAMES = 20
LINE_MAX_DURATION = 4.0
LINE_MAX_FILE_SIZE = 500 * 1024  # 500 KB


def probe_video(path: str) -> dict:
    """Return basic video metadata via ffprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-print_format", "json",
        "-show_streams", "-show_format",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
    data = json.loads(result.stdout)

    video_stream = next(
        (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
        None,
    )
    if not video_stream:
        raise ValueError("No video stream found in file")

    width = int(video_stream["width"])
    height = int(video_stream["height"])

    # Parse fps (e.g. "30000/1001" or "30/1"); "0/0" means unknown
    fps_raw = video_stream.get("r_frame_rate", "30/1")
    num, den = fps_raw.split("/")
    num_f, den_f = float(num), float(den)
    fps = (num_f / den_f) if den_f != 0 and num_f != 0 else 30.0

    duration = float(data.get("format", {}).get("duration", 0))
    return {"width": width, "height": height, "fps": fps, "duration": duration}


def compute_target_dimensions(src_w: int, src_h: int) -> tuple[int, int]:
    """Scale to fit within LINE's 320×270 constraint, at least one side = 270px."""
    scale = min(LINE_MAX_W / src_w, LINE_MAX_H / src_h)
    w = int(src_w * scale)
    h = int(src_h * scale)
    # Must be even for video filters
    w -= w % 2
    h -= h % 2
    # Clamp to be safe
    w = max(2, min(LINE_MAX_W, w))
    h = max(2, min(LINE_MAX_H, h))
    return w, h


def auto_frame_count(duration: float) -> int:
    """Return a sensible frame count within LINE's 5–20 limit."""
    clamped = min(duration, LINE_MAX_DURATION)
    frames = round(clamped * 10)  # aim for ~10 fps
    return max(LINE_MIN_FRAMES, min(LINE_MAX_FRAMES, frames))


def hex_to_ffmpeg_color(hex_color: str) -> str:
    """Convert #RRGGBB to 0xRRGGBB for FFmpeg colorkey filter."""
    return "0x" + hex_color.lstrip("#").upper()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/preview", methods=["POST"])
@limiter.limit("10 per minute")
def preview():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    tmp_dir = UPLOAD_DIR / str(uuid.uuid4())
    tmp_dir.mkdir()

    try:
        input_path = tmp_dir / "input.mp4"
        file.save(str(input_path))

        info = probe_video(str(input_path))
        target_w, target_h = compute_target_dimensions(info["width"], info["height"])
        suggested_frames = auto_frame_count(info["duration"])

        # Extract first frame
        frame_path = tmp_dir / "frame.png"
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(input_path),
                "-vframes", "1",
                "-vf", f"scale={target_w}:{target_h}:flags=lanczos",
                str(frame_path),
            ],
            capture_output=True,
            check=True,
            timeout=60,
        )

        with open(frame_path, "rb") as f:
            frame_b64 = base64.b64encode(f.read()).decode()

        return jsonify({
            "width": info["width"],
            "height": info["height"],
            "duration": round(info["duration"], 2),
            "fps": round(info["fps"], 2),
            "target_width": target_w,
            "target_height": target_h,
            "suggested_frames": suggested_frames,
            "frame_b64": frame_b64,
        })
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Processing timed out"}), 504
    except subprocess.CalledProcessError as e:
        stderr = e.stderr[-500:] if e.stderr else ""
        return jsonify({"error": f"FFmpeg error: {stderr}"}), 500
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.route("/convert", methods=["POST"])
@limiter.limit("5 per minute")
def convert():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    bg_color = request.form.get("bg_color", "").strip()
    try:
        similarity = float(request.form.get("similarity", "0.30"))
        blend = float(request.form.get("blend", "0.20"))
        frame_count = int(request.form.get("frame_count", "10"))
    except ValueError:
        return jsonify({"error": "similarity and blend must be numbers; frame_count must be an integer"}), 400

    # Clamp values to safe ranges
    similarity = max(0.01, min(0.5, similarity))
    blend = max(0.0, min(0.3, blend))
    frame_count = max(LINE_MIN_FRAMES, min(LINE_MAX_FRAMES, frame_count))

    # Validate bg_color is a proper #RRGGBB hex string
    if bg_color and not re.fullmatch(r"#[0-9A-Fa-f]{6}", bg_color):
        return jsonify({"error": "bg_color must be a hex color like #00FF00"}), 400

    tmp_dir = UPLOAD_DIR / str(uuid.uuid4())
    tmp_dir.mkdir()

    try:
        input_path = tmp_dir / "input.mp4"
        file.save(str(input_path))

        info = probe_video(str(input_path))
        target_w, target_h = compute_target_dimensions(info["width"], info["height"])

        duration = min(info["duration"], LINE_MAX_DURATION)
        if duration <= 0:
            raise ValueError("Video has zero or unknown duration")
        output_path = tmp_dir / "sticker.png"
        original_frame_count = frame_count

        # Auto-compression: retry with proportionally fewer frames until under 500 KB
        for _ in range(3):
            output_fps = frame_count / duration
            scale_filter = f"scale={target_w}:{target_h}:flags=lanczos"
            fps_filter = f"fps={output_fps:.4f}"

            if bg_color:
                ffmpeg_color = hex_to_ffmpeg_color(bg_color)
                colorkey_filter = f"colorkey={ffmpeg_color}:{similarity:.3f}:{blend:.3f}"
                vf = f"{fps_filter},{scale_filter},{colorkey_filter},format=rgba"
            else:
                vf = f"{fps_filter},{scale_filter},format=rgba"

            cmd = [
                "ffmpeg", "-y",
                "-i", str(input_path),
                "-vf", vf,
                "-frames:v", str(frame_count),
                "-f", "apng",
                "-plays", "0",
                "-compression_level", "9",
                str(output_path),
            ]
            subprocess.run(cmd, capture_output=True, check=True, timeout=120)

            file_size = output_path.stat().st_size
            if file_size <= LINE_MAX_FILE_SIZE or frame_count <= LINE_MIN_FRAMES:
                break
            # Proportional reduction with 10% safety margin
            frame_count = max(LINE_MIN_FRAMES, int(frame_count * LINE_MAX_FILE_SIZE / file_size * 0.90))

        size_warning = None
        if file_size > LINE_MAX_FILE_SIZE:
            size_warning = (
                f"Output is {file_size // 1024} KB even at {frame_count} frames (LINE's minimum). "
                "Try using a shorter video clip (≤ 2 seconds)."
            )

        # Read into memory before cleanup so the temp dir can be deleted safely
        apng_bytes = output_path.read_bytes()

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Conversion timed out (2 min limit)"}), 504
    except subprocess.CalledProcessError as e:
        stderr = e.stderr[-500:] if e.stderr else ""
        return jsonify({"error": f"FFmpeg error: {stderr}"}), 500
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    response = send_file(
        io.BytesIO(apng_bytes),
        mimetype="image/png",
        as_attachment=True,
        download_name="sticker.png",
    )
    response.headers["X-File-Size"] = str(file_size)
    response.headers["X-Target-Width"] = str(target_w)
    response.headers["X-Target-Height"] = str(target_h)
    response.headers["X-Frame-Count"] = str(frame_count)
    if frame_count < original_frame_count:
        response.headers["X-Auto-Compressed"] = (
            f"Auto-compressed: frames reduced from {original_frame_count} to {frame_count} to fit within 500 KB."
        )
    if size_warning:
        response.headers["X-Size-Warning"] = size_warning
    return response


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("DEBUG", "false").lower() == "true"
    app.run(debug=debug, port=port, host="0.0.0.0")
