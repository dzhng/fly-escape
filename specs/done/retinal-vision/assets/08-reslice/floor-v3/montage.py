"""Display the input-only doorway capture with unchanged RGB and explicit labels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 24)
small = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 19)
image = Image.new('RGB', (1696, 1120), '#fafaf1')
draw = ImageDraw.Draw(image)
draw.text((32, 20), 'INPUT-ONLY SPATIAL PROPOSAL: near-doorway occlusion; no neural run', fill='#183e32', font=font)
draw.text((32, 60), 'Eye position (4.55, 0, 2.55), facing +X. The same white board and room lighting remain in both cases.', fill='#183e32', font=small)
draw.text((32, 90), 'Only the black doorway blocker is added. 128×128 cameras / 721 RGB samples per eye; sRGB display.', fill='#183e32', font=small)
for row, name in enumerate(['floor-opening', 'floor-blocker']):
    y = 150 + row * 490
    draw.text((32, y), 'Open doorway' if row == 0 else 'Blocked doorway', fill='#183e32', font=font)
    for col, (suffix, label) in enumerate([('L','Left samples'), ('L-camera','Left camera'), ('R','Right samples'), ('R-camera','Right camera')]):
        x = 32 + col * 416
        draw.text((x, y + 35), label, fill='#183e32', font=small)
        source = Image.open(HERE / f'{name}-{suffix}.png').convert('RGBA')
        background = Image.new('RGBA', source.size, '#e1e7df')
        background.alpha_composite(source)
        image.paste(background.convert('RGB').resize((384,384),Image.Resampling.NEAREST),(x,y+64))
image.save(HERE / 'inputs.png')
