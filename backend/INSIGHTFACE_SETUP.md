GPU and InsightFace setup

This project uses InsightFace for face detection and recognition embeddings. To enable GPU-accelerated inference and ONNX runtime:

1. Python environment

- Create and activate a virtualenv (recommended):

```bash
python -m venv .venv
source .venv/bin/activate   # linux/mac
.venv\Scripts\Activate     # windows
```

2. Install packages

CPU-only (default):

```bash
pip install -r requirements.txt
```

GPU (preferred for speed):

```bash
pip install -r requirements.txt
pip install onnxruntime-gpu
```

3. Enable GPU in the app

Set the environment variable `INSIGHTFACE_USE_GPU=1` before starting the server. Example (Linux/macOS):

```bash
export INSIGHTFACE_USE_GPU=1
uvicorn main:app --reload
```

On Windows PowerShell:

```powershell
$env:INSIGHTFACE_USE_GPU=1
uvicorn main:app --reload
```

4. Notes and troubleshooting

- InsightFace will download required model files to its model cache on first run. If you run in an offline environment, pre-download models or set `INSIGHTFACE_MODEL_DIR` as needed (see InsightFace docs).
- If you have CUDA but still use CPU, ensure `onnxruntime-gpu` is installed and CUDA drivers are available.
- If FaceAnalysis fails to initialize, check the server logs for the initialization error; the app will fall back by raising a helpful exception where used.

If you want, I can add an explicit GPU check and more detailed MXNet/ONNX provider config in `face_verification.py`.