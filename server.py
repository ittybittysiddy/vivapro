import os
os.environ["MEDIAPIPE_DISABLE_GPU"] = "1"
os.environ["MEDIAPIPE_THREAD_POOL_SIZE"] = "1"

# deals with whisper, gTTS, mediapipe, YOLO, OpenCV

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from gtts import gTTS
import whisper
import io #used for handling data in memory like temporary audio buffer
import shutil
import tempfile
import traceback
import glob
import base64
import numpy as np

# ── OpenCV + MediaPipe ────────────────────────────────────────────────────────
try:
    import cv2
    import mediapipe as mp
    import threading

    _face_mesh_lock = threading.Lock()
    _face_mesh = mp.solutions.face_mesh.FaceMesh(
        max_num_faces=3,
        refine_landmarks=True,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.5,
        static_image_mode=True,   # KEY: disables internal tracking threads — prevents pthread crash
    )

    def get_face_mesh():
        return _face_mesh

    PROCTORING_AVAILABLE = True
    print("MediaPipe face detection loaded (single global instance)")

except Exception as e:
    PROCTORING_AVAILABLE = False
    print("MediaPipe/OpenCV not installed — video proctoring disabled")
    print("Error:", e)


# ── YOLO ─────────────────────────────────────────────────────────────────────
try:
    from ultralytics import YOLO

    yolo_model = YOLO("best.pt")

    _dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    yolo_model(_dummy, verbose=False)
    del _dummy

    YOLO_AVAILABLE = True
    print("YOLO loaded and pre-warmed (best.pt)")

except ImportError:
    YOLO_AVAILABLE = False
    yolo_model = None
    print("Ultralytics YOLO not installed")
except Exception as e:
    YOLO_AVAILABLE = False
    yolo_model = None
    print("YOLO failed to load:", e)

# {0:'book', 1:'cell phone', 2:'headphone', 3:'laptop', 4:'person', 5:'tv'}
CLASS_BOOK   = 0
CLASS_PHONE  = 1
CLASS_PERSON = 4
# headphone=2, laptop=3, tv=5 — DISABLED


# ── ffmpeg ────────────────────────────────────────────────────────────────────
def find_ffmpeg():
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return os.path.dirname(ffmpeg)
    winget_base = os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages")
    matches = glob.glob(os.path.join(winget_base, "**", "bin", "ffmpeg.exe"), recursive=True)
    if matches:
        return os.path.dirname(matches[0])
    winget_links = os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Links")
    if os.path.exists(os.path.join(winget_links, "ffmpeg.exe")):
        return winget_links
    for p in [r"C:\ProgramData\chocolatey\bin", r"C:\ffmpeg\bin"]:
        if os.path.exists(os.path.join(p, "ffmpeg.exe")):
            return p
    return None

ffmpeg_dir = find_ffmpeg()
if ffmpeg_dir:
    os.environ["PATH"] += os.pathsep + ffmpeg_dir
    print(f"ffmpeg found at: {ffmpeg_dir}")
else:
    print("WARNING: ffmpeg not found")


# ── Flask ─────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

print("Loading Whisper base model...")
whisper_model = whisper.load_model("base")
print("Whisper loaded")


# ══════════════════════════════════════════════════════════════════════════════
#  STREAK COUNTERS   all violation decisions made server-side
#
#  Tuning guide:
#    frames run at ~600 ms each.
#    STREAK_REQUIRED = N  →  violation fires after N × 0.6 s of continuous bad behaviour.
#
#    gaze_away  : 5 frames = 3 s  — noticeable but not hair-trigger
#    no_face    : 5 frames = 3 s  — student clearly left
#    multiple   : 6 frames = 3.6 s — rules out single-frame shadow/hair false positives
#    phone      : 3 frames = 1.8 s — YOLO is reliable, respond faster
#    book       : 3 frames = 1.8 s
# ══════════════════════════════════════════════════════════════════════════════

STREAK_REQUIRED = {
    'gaze_away' : 5,
    'no_face'   : 5,
    'multiple'  : 6,
    'phone'     : 3,
    'book'      : 3,
}

# ── Per-student session state ─────────────────────────────────────────────────
# Keyed by student_id sent from the frontend.
# Replaces the old single-global approach which caused cross-request streak
# corruption when Flask runs threaded=True.
import threading as _threading
_session_lock   = _threading.Lock()
_session_states = {}

def _get_session(student_id: str) -> dict:
    with _session_lock:
        if student_id not in _session_states:
            _session_states[student_id] = {
                'streaks'       : {k: 0 for k in STREAK_REQUIRED},
                'last_sent'     : None,
                'last_sent_time': 0,
                'gaze_buf'      : [],
            }
        return _session_states[student_id]

def _reset_session(student_id: str):
    with _session_lock:
        _session_states.pop(student_id, None)


# ── Gaze smoothing ────────────────────────────────────────────────────────────
GAZE_BUF_SIZE    = 5    # look at last 5 frames
GAZE_CONFIRM_CNT = 3    # need 3 out of 5 to agree (60 %)


def _smooth_gaze(gaze_buf: list, raw: str) -> str:
    gaze_buf.append(raw)
    if len(gaze_buf) > GAZE_BUF_SIZE:
        del gaze_buf[:-GAZE_BUF_SIZE]
    for direction in ('left', 'right', 'up', 'away'):
        if gaze_buf.count(direction) >= GAZE_CONFIRM_CNT:
            return direction
    return 'center'


def _compute_raw_gaze(lm) -> str:
    """
    Return raw gaze direction from MediaPipe face landmarks.

    Threshold philosophy
    ────────────────────
    We use BOTH head-pose (nose position) AND iris ratio so that even small
    head turns are caught.  The dead-zone is deliberately moderate:

      nose_norm  < 0.38  → left   (head turned left by ~15-20°)
      nose_norm  > 0.62  → right
      iris_avg   < 0.40  → right  (eyes pulled right)
      iris_avg   > 0.60  → left

    These are tighter than the last version (0.30/0.70) which was so wide
    that obvious looking-away was ignored entirely.
    They are wider than the original (0.43/0.57) which fired on micro-movements.
    Result: catches clear cheating-style looks while ignoring normal reading shifts.
    """
    try:
        li_x = lm[468].x
        ri_x = lm[473].x

        le_outer, le_inner = lm[33].x, lm[133].x
        le_w = abs(le_inner - le_outer)
        left_iris_ratio = (
            (li_x - min(le_outer, le_inner)) / le_w if le_w > 0.005 else 0.5
        )

        re_outer, re_inner = lm[362].x, lm[263].x
        re_w = abs(re_inner - re_outer)
        right_iris_ratio = (
            (ri_x - min(re_inner, re_outer)) / re_w if re_w > 0.005 else 0.5
        )

        iris_avg = (left_iris_ratio + right_iris_ratio) / 2

        lc_x, rc_x = lm[234].x, lm[454].x
        nose_x    = lm[1].x
        face_span = abs(rc_x - lc_x)
        nose_norm = (
            (nose_x - min(lc_x, rc_x)) / face_span if face_span > 0.01 else 0.5
        )

        nose_y, chin_y, fore_y = lm[1].y, lm[152].y, lm[10].y
        face_h      = abs(chin_y - fore_y)
        nose_norm_y = (
            (nose_y - min(chin_y, fore_y)) / face_h if face_h > 0.01 else 0.5
        )

        # Head tilted far up
        if nose_norm_y < 0.30:
            return 'up'
        # Head turned left / right  (primary signal)
        if nose_norm < 0.38:
            return 'left'
        if nose_norm > 0.62:
            return 'right'
        # Iris drift left / right  (secondary signal — catches eyes-only movement)
        if iris_avg < 0.40:
            return 'right'
        if iris_avg > 0.60:
            return 'left'

        return 'center'

    except Exception:
        return 'unknown'


# ── /speak ────────────────────────────────────────────────────────────────────
@app.route('/speak', methods=['POST'])
def speak():
    data = request.get_json()
    text = data.get('text', '').strip()
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    tts = gTTS(text=text, lang='en', slow=False)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return send_file(buf, mimetype='audio/mpeg')


# ── /transcribe ───────────────────────────────────────────────────────────────
@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    audio_file = request.files['audio']
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
        tmp_path = tmp.name
        audio_file.save(tmp_path)
    try:
        result = whisper_model.transcribe(tmp_path, language='en')
        return jsonify({'text': result['text'].strip()})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ── /analyze_frame ────────────────────────────────────────────────────────────
@app.route('/analyze_frame', methods=['POST'])
def analyze_frame_route():
    if not PROCTORING_AVAILABLE:
        return jsonify({'warnings': [], 'face_count': 0, 'gaze': 'unknown'})

    data       = request.json or {}
    image_data = data.get('image', '')
    student_id = data.get('student_id', 'default')   # frontend must send this
    if not image_data:
        return jsonify({'error': 'No image provided'}), 400

    # Per-student state — no more shared globals
    sess = _get_session(student_id)

    try:
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)   # BGR — for YOLO

        if frame is None:
            return jsonify({'warnings': [], 'face_count': 0, 'gaze': 'unknown'})

        rgb        = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)  # MediaPipe only
        face_count = 0

        # ── MediaPipe ─────────────────────────────────────────────────────────
        # Lock ensures only one frame processed at a time — safe with single instance
        with _face_mesh_lock:
            mp_results = get_face_mesh().process(rgb)

        # Per-frame bad flags — True means the condition was present this frame
        frame_flags = {k: False for k in STREAK_REQUIRED}

        if mp_results.multi_face_landmarks:
            face_count = len(mp_results.multi_face_landmarks)
            # Do NOT set 'multiple' here — MediaPipe picks up faces on posters,
            # photos, reflections, etc. YOLO (fine-tuned) handles person counting.

            raw_gaze = _compute_raw_gaze(mp_results.multi_face_landmarks[0].landmark)
            # Only smooth gaze when a face is actually present
            gaze = _smooth_gaze(sess['gaze_buf'], raw_gaze)
            if gaze in ('left', 'right', 'up'):
                frame_flags['gaze_away'] = True
        else:
            face_count = 0
            gaze       = 'away'
            frame_flags['no_face'] = True
            # Do NOT feed 'away' into the gaze buffer no_face and gaze_away
            # are separate violations; poisoning the buffer caused phantom
            # gaze_away streaks whenever the student briefly left frame.

        # ── YOLO ─────────────────────────────────────────────────────────────
        if YOLO_AVAILABLE and yolo_model is not None:
            yolo_res         = yolo_model(frame, verbose=False, conf=0.50)
            persons_detected = 0

            for det in yolo_res[0].boxes:
                cls_id = int(det.cls[0])
                conf   = float(det.conf[0])

                if cls_id == CLASS_PERSON:
                    persons_detected += 1

                if cls_id == CLASS_PHONE and conf > 0.50:
                    frame_flags['phone'] = True

                if cls_id == CLASS_BOOK and conf > 0.55:
                    frame_flags['book'] = True

                # headphone / laptop / tv are DISABLED

            if persons_detected > 1:
                frame_flags['multiple'] = True

        # ── Update streaks ────────────────────────────────────────────────────
        streaks = sess['streaks']
        for key, is_bad in frame_flags.items():
            if is_bad:
                streaks[key] += 1
            else:
                streaks[key] = 0   # clean frame resets that streak immediately

        # ── Decide what to send ───────────────────────────────────────────────
        # use >= (not ==) so a violation keeps firing every frame
        # until the scene clears, instead of silently stopping after frame N+1.
        ready    = [k for k, thr in STREAK_REQUIRED.items() if streaks[k] >= thr]
        priority = ['multiple', 'phone', 'book', 'no_face', 'gaze_away']
        chosen   = next((p for p in priority if p in ready), None)

        messages = {
            'multiple'  : 'Multiple persons detected',
            'phone'     : 'Phone detected',
            'book'      : 'Book detected',
            'no_face'   : 'Student not visible please stay in frame',
            'gaze_away' : f'Looking away from screen ({gaze})',
        }

        import time as _time
        now = _time.time()
        RESEND_COOLDOWN = 8  # same violation can re-fire after 8s of continuous bad behaviour

        warnings = []
        if chosen:
            time_since_last = now - sess['last_sent_time']
            if chosen != sess['last_sent'] or time_since_last >= RESEND_COOLDOWN:
                warnings               = [messages[chosen]]
                sess['last_sent']      = chosen
                sess['last_sent_time'] = now
        else:
            sess['last_sent']      = None   # scene clean — same violation can fire again next time
            sess['last_sent_time'] = 0

        return jsonify({'warnings': warnings, 'face_count': face_count, 'gaze': gaze})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── /reset_proctoring ─────────────────────────────────────────────────────────
# Call this from the frontend when a student's viva ends (or starts fresh).
# Clears all streak + gaze state for that student so stale data from a previous
# session doesn't bleed into the next one.
@app.route('/reset_proctoring', methods=['POST'])
def reset_proctoring():
    data       = request.get_json() or {}
    student_id = data.get('student_id', 'default')
    _reset_session(student_id)
    return jsonify({'ok': True})


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("Server running on http://localhost:5000")
    app.run(port=5000, debug=True, use_reloader=False, threaded=False)