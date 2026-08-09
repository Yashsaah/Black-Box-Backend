/**
 * Offline mirror of the backend model registry (backend/registry.py).
 *
 * The picker fetches GET /models at mount and uses that when it can. This copy
 * is the fallback so the page still renders a real catalogue when the backend
 * is asleep — the cards just show "backend offline" instead of live status.
 *
 * One model per detection type. Keep the ids in sync with registry.py.
 */

export const FALLBACK_CATALOG = {
  default: "pneumonia-resnet50",
  diseases: [
    {
      name: "Pneumonia",
      models: [
        {
          id: "pneumonia-resnet50",
          name: "Pneumonia ResNet-50",
          disease: "Pneumonia",
          task: "Binary classification — Normal vs Pneumonia",
          architecture: "ResNet-50 (ImageNet-pretrained, fine-tuned)",
          dataset: "PneumoniaMNIST 224×224 (MedMNIST+), RGB",
          classes: ["normal", "pneumonia"],
          summary:
            "Detects pneumonia in chest X-rays and shows which regions drove the call.",
          weights_file: "pneumonia_resnet50.pth",
          available: null,
        },
      ],
    },
    {
      name: "Glaucoma",
      models: [
        {
          id: "glaucoma-cnn",
          name: "Glaucoma CNN",
          disease: "Glaucoma",
          task: "Binary classification — Glaucoma vs Normal",
          architecture: "Custom CNN (2 conv blocks + 3 dense layers)",
          dataset: "RIM-ONE DL fundus photographs, 128×128 RGB",
          classes: ["glaucoma", "normal"],
          summary:
            "Detects glaucoma in retinal fundus photographs and highlights the optic disc region it keyed on.",
          weights_file: "glaucoma_cnn.pth",
          available: null,
        },
      ],
    },
  ],
};
