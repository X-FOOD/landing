"""Генерирует favicon-набор и OG-картинку из src/assets/logo.png (запускать вручную при смене логотипа)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, os

A = "src/assets"
logo = Image.open(f"{A}/logo.png").convert("RGBA")
alpha = np.array(logo)[:, :, 3]

# --- знак X: первый кластер непрозрачных колонок ---
cols = (alpha > 10).any(axis=0)
xs = np.where(cols)[0]
gaps = np.where(np.diff(xs) > 20)[0]
x_end = xs[gaps[0]] + 1 if len(gaps) else xs[-1] + 1
mark = logo.crop((xs[0], 0, x_end, logo.height))
bbox = mark.getbbox(); mark = mark.crop(bbox)

def square(img, size, pad=0.12, bg=(0, 0, 0, 0)):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = int(size * (1 - 2 * pad))
    scale = min(inner / img.width, inner / img.height)
    im = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas

square(mark, 32).save(f"{A}/favicon-32.png")
square(mark, 192, bg=(255, 255, 255, 255)).save(f"{A}/icon-192.png")
square(mark, 512, bg=(255, 255, 255, 255)).save(f"{A}/icon-512.png")
square(mark, 180, pad=0.16, bg=(255, 255, 255, 255)).convert("RGB").save(f"{A}/apple-touch-icon.png")
square(mark, 64).save(f"{A}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# --- OG 1200x630 ---
W, H = 1200, 630
og = Image.new("RGB", (W, H), (0, 0, 0))
lg = logo.copy(); lg.thumbnail((360, 120), Image.LANCZOS)
og.paste(lg, (80, 80), lg)
d = ImageDraw.Draw(og)
font_path = next(p for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"] if os.path.exists(p))
f1 = ImageFont.truetype(font_path, 84); f2 = ImageFont.truetype(font_path, 36)
d.text((80, 250), "Посмотрим ваши", font=f1, fill=(255, 255, 255))
d.text((80, 345), "камеры за вас.", font=f1, fill=(255, 255, 255))
d.text((80, 480), "Первая проверка — 1 руб. • далее от 3 999 руб./мес", font=f2, fill=(160, 160, 160))
d.text((80, 540), "xfood.tech", font=f2, fill=(255, 102, 0))
og.save(f"{A}/og.png", optimize=True)
print("mark", mark.size, "| files:", sorted(os.listdir(A)))
