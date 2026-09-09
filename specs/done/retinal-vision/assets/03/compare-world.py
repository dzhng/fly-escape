"""Compare deterministic presentation frames; differences are diagnostic, not a verdict."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy.ndimage import sobel

root = Path(__file__).resolve().parent
output = root / 'world-comparison'
output.mkdir(exist_ok=True)
results = []
for reference in sorted((root / 'world-reference').glob('*.png')):
    candidate = root / 'world-candidate' / reference.name
    left = np.asarray(Image.open(reference).convert('RGB'))
    right = np.asarray(Image.open(candidate).convert('RGB'))
    assert left.shape == right.shape
    delta = np.abs(left.astype(float) - right.astype(float))
    def luminance(image):
        return .2126*image[:,:,0] + .7152*image[:,:,1] + .0722*image[:,:,2]
    first, second = luminance(left), luminance(right)
    gray_delta = np.abs(first - second)
    results.append(dict(image=reference.name, png_bytes_equal=reference.read_bytes() == candidate.read_bytes(),
        changed_pixel_fraction=float(np.any(delta, axis=2).mean()), max_rgb_delta=float(delta.max()),
        gray_mae=float(gray_delta.mean()), gray_rmse=float(np.sqrt((gray_delta**2).mean())),
        diff_ratio_16=float((gray_delta > 16).mean()), diff_ratio_32=float((gray_delta > 32).mean()),
        edge_energy_reference=float(np.hypot(sobel(first,0),sobel(first,1)).mean()),
        edge_energy_candidate=float(np.hypot(sobel(second,0),sobel(second,1)).mean()),
        mean_luminance_reference=float(first.mean()), mean_luminance_candidate=float(second.mean())))
    Image.fromarray(np.clip(delta*8,0,255).astype('uint8')).save(output / reference.name)
    for label, path in [('reference',reference),('candidate',candidate)]:
        Image.open(path).crop((330,240,1010,810)).resize((1360,1140),Image.Resampling.NEAREST).save(output / f'{reference.stem}-{label}-crop.png')
assert results, 'No captured comparison pairs'
(root / 'world-comparison.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results))
