"""Run pinned, unmodified FlyGym Retina on reproducible camera fixtures."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import types
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial.transform import Rotation
from scipy.ndimage import sobel
import yaml

FLYGYM = 'c7affce924cb1c6add16619adf83be5c6b223e89'
FLY_API = 'a6ad07a810b1a43cd0356149c07b32105eb46d2a'
FILES = {
    'flygym': ['flygym/vision/retina.py', 'flygym/config.yaml', 'flygym/fly.py',
               'flygym/data/vision/ommatidia_id_map.npy', 'flygym/data/vision/pale_mask.npy',
               'flygym/data/mjcf/neuromechfly_seqik_kinorder_ypr.xml', 'LICENSE'],
    'fly-api': ['demo/svt_taxis.py', 'demo/track_b_embodied.py', 'LICENSE'],
}


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def fetch_sources(cache):
    provenance = []
    for repo, paths in FILES.items():
        revision = FLYGYM if repo == 'flygym' else FLY_API
        owner = 'NeLy-EPFL' if repo == 'flygym' else 'dtch1997'
        for path in paths:
            url = f'https://raw.githubusercontent.com/{owner}/{repo}/{revision}/{path}'
            dest = cache / repo / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                with urllib.request.urlopen(url, timeout=45) as response:
                    dest.write_bytes(response.read())
            provenance.append(dict(repository=repo, revision=revision, path=path, url=url,
                                   sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
    return provenance


def load_retina(root):
    # Only package/config discovery is supplied locally; execute original sampler unchanged.
    util = types.ModuleType('flygym.util')
    util.get_data_path = lambda package, path: root / 'flygym' / path
    util.load_config = lambda: yaml.safe_load((root / 'flygym/config.yaml').read_text())
    sys.modules['flygym.util'] = util
    spec = importlib.util.spec_from_file_location('original_retina', root / 'flygym/vision/retina.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Retina(), util.load_config()


def fixture(eye, frame):
    image = Image.new('RGB', (450, 512), (210, 210, 210))
    draw = ImageDraw.Draw(image)
    # Eye identity and asymmetric corners are encoded in the camera input itself.
    patches = [
        ('1 upper red', [70, 75, 170, 175], [255, 0, 0]),
        ('2 upper green', [280, 120, 395, 215], [0, 255, 0]),
        ('3 lower blue', [80, 290, 185, 390], [0, 0, 255]),
        ('4 lower yellow', [280, 310, 385, 430], [255, 255, 0]),
        (f'5 {eye} marker', [190, 205, 260, 255], [0, 255, 255] if eye == 'L' else [255, 0, 255]),
        ('6 moving dark', [140 + frame * 75, 260, 175 + frame * 75, 280], [0, 0, 0]),
    ]
    for _, bounds, color in patches:
        draw.rectangle(bounds, fill=tuple(color))
    return np.asarray(image).copy(), patches


def rgb_pool(image, ids, count):
    active = ids > 0
    return np.stack([np.bincount(ids[active] - 1, weights=image[:, :, ch][active], minlength=len(count))
                     / count / 255 for ch in range(3)], axis=1)


def rig_profile(root, config):
    xml = ET.parse(root / 'flygym/data/mjcf/neuromechfly_seqik_kinorder_ypr.xml')
    head = np.fromstring(xml.find('.//body[@name="Head"]').get('pos'), sep=' ')
    # Proper cyclic basis change, into native local +Z forward / +Y up.
    basis = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]])
    eyes = {}
    for side in ['L', 'R']:
        settings = config['vision']['sensor_positions'][side + 'Eye_cam']
        eye = np.fromstring(xml.find(f'.//body[@name="{side}Eye"]').get('pos'), sep=' ')
        matrix = Rotation.from_euler('xyz', settings['orientation']).as_matrix()
        position = head + eye + settings['rel_pos']
        assert np.linalg.det(matrix) > .999999
        eyes[side] = dict(**settings, neutral_thorax_relative_mm=position.tolist(),
                         camera_to_source_rotation=matrix.tolist(),
                         forward_source=(matrix @ [0, 0, -1]).tolist(),
                         up_source=(matrix @ [0, 1, 0]).tolist(),
                         native_body_relative_metres=(basis @ position * .001).tolist(),
                         camera_to_native_body_rotation=(basis @ matrix).tolist())
    assert eyes['L']['forward_source'][1] > 0 and eyes['R']['forward_source'][1] < 0
    assert all(eyes[e]['up_source'][2] > .99 for e in eyes)
    return dict(source_units='millimetres', source_axes='+X forward, +Y left, +Z up',
                euler='MuJoCo uppercase XYZ: fixed/extrinsic axes, radians',
                camera_axes='+X image right, +Y image up, -Z forward',
                source_to_native_body=basis.tolist(),
                native_body_axes='+Z forward, +Y up; apply native full quaternion after basis conversion',
                scope='Neutral source head joints only. Product asset placement belongs to slice 03.', eyes=eyes)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    provenance = fetch_sources(args.cache)
    manifest = Path(__file__).with_name('source-manifest.json')
    if manifest.exists():
        assert provenance == json.loads(manifest.read_text()), 'Pinned source bytes changed'
    write_json(args.out / 'source-manifest.json', provenance)
    retina, config = load_retina(args.cache / 'flygym')
    ids = retina.ommatidia_id_map
    count = retina.num_pixels_per_ommatidia
    assert ids.shape == (512, 450) and len(count) == 721 and count.min() > 0
    records, samples, panels = [], {}, []
    for eye in ['L', 'R']:
        for frame in [0, 1]:
            raw, patches = fixture(eye, frame)
            fish = retina.correct_fisheye(raw)
            values = retina.raw_image_to_hex_pxls(fish)
            rgb = rgb_pool(fish, ids, count)
            expected = np.zeros((721, 2))
            selected = retina.pale_type_mask.astype(int)
            expected[np.arange(721), selected] = rgb[np.arange(721), selected + 1]
            error = float(np.max(np.abs(values - expected)))
            assert error < 1e-12, error
            # False color exposes the original G/B channel assignment; RGB is a separate pooling oracle.
            display = np.column_stack([np.zeros(721), values])
            mosaic = retina.hex_pxls_to_human_readable(display, color_8bit=True)
            oracle_mosaic = retina.hex_pxls_to_human_readable(np.column_stack([np.zeros(721), expected]), color_8bit=True)
            pixel_delta = np.abs(mosaic.astype(int) - oracle_mosaic.astype(int))
            # Independent mean order can cross the original display's uint8 truncation boundary.
            assert pixel_delta.max() <= 1
            Image.fromarray((pixel_delta * 255).astype(np.uint8)).save(args.out / f'{eye}-{frame}-oracle-diff.png')
            key = f'{eye}-{frame}'
            for name, arr in [('raw', raw), ('fisheye', fish), ('retinal', mosaic)]:
                Image.fromarray(arr).save(args.out / f'{key}-{name}.png')
            samples[key] = values
            landmark_records = []
            for name, bounds, color in patches:
                mask = np.zeros_like(raw)
                x0, y0, x1, y1 = bounds
                mask[y0:y1 + 1, x0:x1 + 1] = 255
                mapped = retina.correct_fisheye(mask)[:, :, 0] > 0
                active = mapped & (ids > 0)
                rows, cols = np.nonzero(active)
                assert len(rows), name
                affected = np.unique(ids[active])
                landmark_records.append(dict(name=name, raw_bounds_xyxy=bounds, raw_rgb=color,
                    corrected_centroid_row_col=[float(rows.mean()), float(cols.mean())],
                    sample_ids_one_based=affected.tolist(), covered_pixels=int(active.sum())))
            records.append(dict(eye=eye, frame=frame, landmarks=landmark_records,
                                pooling_max_abs_error=error, original_vs_oracle_max_channel_delta=int(pixel_delta.max()),
                                original_vs_oracle_changed_pixel_fraction=float(np.any(pixel_delta, axis=2).mean()),
                                original_vs_oracle_mean_channel_delta=float(pixel_delta.mean()),
                                nonzero_channels=int(np.count_nonzero(values)),
                                dark_target_sample_ids=landmark_records[-1]['sample_ids_one_based']))
            panels.append((key, [raw, fish, mosaic]))
    assert not np.array_equal(samples['L-0'], samples['R-0'])
    assert all(not np.array_equal(samples[f'{eye}-0'], samples[f'{eye}-1']) for eye in ['L', 'R'])
    np.savez_compressed(args.out / 'samples.npz', **samples)
    for offset in [0, 2]:
        before, after = records[offset:offset+2]
        assert before['dark_target_sample_ids'] != after['dark_target_sample_ids']
        landmarks = before['landmarks']
        assert landmarks[0]['corrected_centroid_row_col'][0] < landmarks[2]['corrected_centroid_row_col'][0]
        assert landmarks[0]['corrected_centroid_row_col'][1] < landmarks[1]['corrected_centroid_row_col'][1]
    # Uniform fields isolate channel selection from distortion's black exterior.
    chromatic = {}
    for name, color in [('red', [255, 0, 0]), ('green', [0, 255, 0]), ('blue', [0, 0, 255])]:
        uniform = np.empty((512, 450, 3), dtype=np.uint8); uniform[:] = color
        response = retina.raw_image_to_hex_pxls(uniform)
        chromatic[name] = response.sum(axis=0).tolist()
    assert chromatic['red'] == [0, 0]
    np.testing.assert_allclose(chromatic['green'], [int((retina.pale_type_mask == 0).sum()), 0], atol=1e-9)
    np.testing.assert_allclose(chromatic['blue'], [0, int((retina.pale_type_mask == 1).sum())], atol=1e-9)
    centers = np.array([np.argwhere(ids == i).mean(axis=0) for i in range(1, 722)])
    np.save(args.out / 'sample-centers-row-col.npy', centers)
    profile = dict(flygym_revision=FLYGYM, fly_api_revision=FLY_API, reproduction='original-sampler fixtures; no MuJoCo render',
                   cameras=rig_profile(args.cache / 'flygym', config), vision=config['vision'],
                   raster=dict(width=450, height=512, aspect=450/512, row_direction='top to bottom; sampler never flips',
                               projection='rectilinear perspective before original correct_fisheye'),
                   samples=dict(per_eye=721, order='original map IDs 1..721; see sample-centers-row-col.npy; not product61 axial order',
                                minimum_pool_pixels=int(count.min()), maximum_pool_pixels=int(count.max())),
                   channels='one selected channel per sample: mask0 -> input G/output0; mask1 -> input B/output1. R ignored; no linearization.',
                   photometry='Original divides 8-bit channel means by255. It does not calibrate spectra or decode sRGB.',
                   licenses='See reproduce.md source ledger; original files fetched to temporary cache, not vendored.')
    write_json(args.out / 'reference-profile.json', profile)
    write_json(args.out / 'correspondence.json', dict(cases=records, uniform_patch_channel_sums=chromatic,
                verdict='PASS original-sampler scope', limitations=['No rendered scene or runtime MuJoCo handedness test',
                'Rig checked from source transforms, not a compiled articulated model', 'No production RGB adapter or61cell layout implied']))
    font = ImageFont.load_default(size=18)
    sheet = Image.new('RGB', (1380, 2420), '#f4f5f7'); draw = ImageDraw.Draw(sheet)
    draw.text((18, 12), 'Original FlyGym sampler | generated camera fixtures | NO MuJoCo render', fill='black', font=font)
    for col, title in enumerate(['Raw RGB camera fixture', 'Original fisheye correction', 'Original retinal samples (false G/B color)']):
        draw.text((18 + col*460, 48), title, fill='black', font=font)
    for row, (key, imgs) in enumerate(panels):
        y = 92 + row*548
        draw.text((18, y-23), f'Eye {key[0]} | frame {key[-1]}', fill='black', font=font)
        for col, arr in enumerate(imgs):
            sheet.paste(Image.fromarray(arr), (18 + col*460, y))
        _, patches = fixture(key[0], int(key[-1]))
        for number, (_, bounds, _) in enumerate(patches, 1):
            x0, y0, _, _ = bounds
            draw.rectangle((18+x0, y+y0, 40+x0, y+y0+24), fill='white')
            draw.text((20+x0, y+y0+1), str(number), fill='black', font=font)
        for number, landmark in enumerate(records[row]['landmarks'], 1):
            cy, cx = landmark['corrected_centroid_row_col']
            for col in [1, 2]:
                px, py = int(18 + col*460 + cx), int(y + cy)
                draw.rectangle((px, py, px+22, py+24), fill='white')
                draw.text((px+2, py+1), str(number), fill='black', font=font)
    draw.text((18, 2280), '1 upper red; 2 upper green; 3 lower blue; 4 lower yellow; 5 center eye marker; 6 moving dark', fill='black', font=font)
    draw.text((18, 2308), 'Labels are overlays; standalone PNGs and crops preserve unannotated sampler output. Rows increase downward.', fill='black', font=font)
    draw.text((18, 2336), 'Blue/green speckling is the original one-channel-per-cell mask; red is discarded. This is NOT final RGB vision.', fill='black', font=font)
    draw.text((18, 2364), 'Oracle-diff PNG scale: black = equal; full green/blue = 1 byte-level difference, amplified x255.', fill='black', font=font)
    draw.text((18, 2392), 'White is the original display outside the lattice; partial cells at raster edges are retained, not trimmed.', fill='black', font=font)
    sheet.save(args.out / 'contact-sheet.png')
    for key, _ in panels:
        Image.open(args.out / f'{key}-retinal.png').crop((55, 50, 405, 462)).resize((700,824), Image.Resampling.NEAREST).save(args.out / f'{key}-interior-2x.png')
    metrics = {}
    for path in sorted(args.out.glob('*.png')):
        pixels = np.asarray(Image.open(path).convert('RGB'))
        gray = .2126*pixels[:,:,0] + .7152*pixels[:,:,1] + .0722*pixels[:,:,2]
        _, frequencies = np.unique((pixels // 32).reshape(-1, 3), axis=0, return_counts=True)
        probabilities = frequencies / frequencies.sum()
        metrics[path.name] = dict(color_entropy_bits=float(-(probabilities*np.log2(probabilities)).sum()),
            dominant_quantized_color_share=float(probabilities.max()), luminance_range=float(np.ptp(gray)),
            mean_luminance=float(gray.mean()), mean_sobel_energy=float(np.hypot(sobel(gray,0),sobel(gray,1)).mean()),
            dimensions=list(Image.open(path).size), transparent_share=0)
    write_json(args.out / 'visual-metrics.json', metrics)
    print(json.dumps(dict(verdict='PASS original-sampler scope', cases=len(records), samples_per_eye=721,
                         worst_pooling_error=max(x['pooling_max_abs_error'] for x in records), channels=chromatic)))


if __name__ == '__main__':
    main()
