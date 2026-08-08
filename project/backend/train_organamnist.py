import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import transforms, models
import medmnist
from medmnist import OrganAMNIST, INFO

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

NUM_CLASSES = 11
IMG_SIZE = 224

BATCH_SIZE = 64
EPOCHS = 10
LEARNING_RATE = 1e-4

"""## 3. Data

`OrganAMNIST` images ship at 28x28 by default; passing `size=224` downloads
the higher-resolution version so it matches what the backend expects.
Images are single-channel — `transforms.Grayscale(num_output_channels=3)`
duplicates that channel to 3, which is what a plain `resnet18` expects as
input and what `backend/main.py` does too.
"""

transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
])

train_dataset = OrganAMNIST(split="train", transform=transform, download=True, size=IMG_SIZE)
val_dataset = OrganAMNIST(split="val", transform=transform, download=True, size=IMG_SIZE)
test_dataset = OrganAMNIST(split="test", transform=transform, download=True, size=IMG_SIZE)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)
test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

print("Train size:", len(train_dataset))
print("Val size:", len(val_dataset))
print("Test size:", len(test_dataset))
print("Classes:", INFO["organamnist"]["label"])

"""## 4. Model — ResNet18 with the final layer swapped for 11 classes"""

model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
model.fc = nn.Linear(model.fc.in_features, NUM_CLASSES)
model = model.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

"""## 5. Train"""

def run_epoch(loader, train_mode):
    model.train(train_mode)
    total_loss, correct, total = 0.0, 0, 0

    for images, labels in loader:
        images = images.to(device)
        labels = labels.to(device).squeeze().long()  # medmnist labels come as shape (N, 1)

        if train_mode:
            optimizer.zero_grad()

        with torch.set_grad_enabled(train_mode):
            outputs = model(images)
            loss = criterion(outputs, labels)
            if train_mode:
                loss.backward()
                optimizer.step()

        total_loss += loss.item() * images.size(0)
        correct += (outputs.argmax(dim=1) == labels).sum().item()
        total += images.size(0)

    return total_loss / total, correct / total


for epoch in range(1, EPOCHS + 1):
    train_loss, train_acc = run_epoch(train_loader, train_mode=True)
    val_loss, val_acc = run_epoch(val_loader, train_mode=False)
    print(f"Epoch {epoch}/{EPOCHS} — "
          f"train loss {train_loss:.4f} acc {train_acc:.3f} — "
          f"val loss {val_loss:.4f} acc {val_acc:.3f}")

"""## 6. Test set accuracy (sanity check)"""

test_loss, test_acc = run_epoch(test_loader, train_mode=False)
print(f"Test accuracy: {test_acc:.3f}")

"""## 7. Save `model.pth`

This saves only the weights (`state_dict`), which is what `backend/main.py`
expects — it rebuilds the same `resnet18` architecture and loads these
weights into it.
"""

torch.save(model.state_dict(), "model.pth")
print("Saved model.pth")