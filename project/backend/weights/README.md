# Weights

Drop trained checkpoints here. Filenames must match `weights_file` in
[`registry.py`](../registry.py) — the server resolves them by name.

| File | Model id | Produced by | Size |
| --- | --- | --- | --- |
| `pneumonia_resnet50.pth` | `pneumonia-resnet50` | `Model1.ipynb` final cell | ~94 MB |
| `glaucoma_cnn.pth` | `glaucoma-cnn` | `Glaucoma.ipynb` final cell | ~67 MB |
| `model.pth` | `organ-resnet18` | `train_organamnist.py` — already in the backend root, no move needed | ~45 MB |

Aliases are also accepted, so a checkpoint exported under the notebook's own
name still resolves without renaming: `pneumonia_resnet50_valsplit.pth` and
`glaucoma_cnn_valsplit.pth`.

## Exporting from the notebook

The notebook's last cell already saves under the right name:

```python
SAVE_PATH = "pneumonia_resnet50.pth"
torch.save(model.state_dict(), SAVE_PATH)
```

To keep it past the Colab session and pull it down:

```python
from google.colab import drive
drive.mount('/content/drive')
torch.save(model.state_dict(), "/content/drive/MyDrive/pneumonia_resnet50.pth")

from google.colab import files
files.download("/content/drive/MyDrive/pneumonia_resnet50.pth")
```

The file is ~95 MB. Copy it into this folder and reload the page — **no server
restart needed**; availability is re-checked on every request.

(One exception: if you replace a checkpoint the server has *already served a
prediction with*, it stays cached in memory. Restart uvicorn to pick up the new
one.)

## What the server expects

A bare `state_dict` (a checkpoint dict with a `state_dict` key also works). It
is loaded with `strict=True` into:

```python
model = resnet50(weights=None)
model.fc = nn.Sequential(nn.Dropout(p=0.4), nn.Linear(2048, 2))
```

which is exactly `build_model(n_classes)` from the notebook. Epoch count does
not matter — 25 or 100 epochs produce an identically shaped `state_dict`. Only
the *architecture* has to match; a mismatch raises at load time rather than
quietly producing garbage predictions.

Nothing here is committed — add `*.pth` to `.gitignore` if you version this
folder.
