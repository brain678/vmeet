import os, sys
repo_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
backend_dir = os.path.join(repo_root, 'backend')
sys.path.insert(0, backend_dir)
from face_verification import get_face_verifier

path = os.path.join(repo_root, 'public', 'images', 'sample-face-photo.jpg')
with open(path, 'rb') as f:
    b = f.read()
fv = get_face_verifier()
print('Running verify_face_quality_from_bytes...')
res = fv.verify_face_quality_from_bytes(b)
print('Result:', res)
print('Running get_embedding_from_image_bytes...')
emb = fv.get_embedding_from_image_bytes(b)
print('Embedding type:', type(emb), 'len:', len(emb) if emb else None)
