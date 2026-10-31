# Obrázky cvičných otázek ZHVB z Rámcového OZ ZHVB 2026/27 (docs/pravidla/ramcova-oz-zhvb-2026-2027.pdf) → assets/zhvb/
# Postup (macOS, ImageMagick): swiftc -O nastroje/zhvb/pdf.swift -o /tmp/pdf; cd <pracovní složka>;
#   for s in 18 20 21 22 24 32; do /tmp/pdf render docs/pravidla/ramcova-oz-zhvb-2026-2027.pdf $s 3 str$s.png; done; python3 nastroje/zhvb/orez.py <výstup>
# Souřadnice mřížek platí pro OZ 2026/27 – u nového ročníku je přeměřit (str. = strana PDF, ne tištěné číslo). Číslo ani popisek nesmí na obrázku zůstat (prozradí odpověď).
# Ořez obrázků ZHVB z vykreslených stran (3×): buňka → zabělit číslo / popisek → oříznout na obsah → čtverec, bílé pozadí, max 400 px
from PIL import Image, ImageDraw, ImageChops
import os, sys
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
def ulozit(im, jmeno, okraj=0.08, max_px=400):
    im = im.convert('RGB'); bg = Image.new('RGB', im.size, (255, 255, 255))
    diff = ImageChops.difference(im, bg).convert('L').point(lambda p: 255 if p > 28 else 0)
    bb = diff.getbbox()
    if bb: im = im.crop(bb)
    w, h = im.size; s = int(max(w, h) * (1 + 2 * okraj))
    c = Image.new('RGB', (s, s), (255, 255, 255)); c.paste(im, ((s - w) // 2, (s - h) // 2))
    if s > max_px: c = c.resize((max_px, max_px), Image.LANCZOS)
    c.save(os.path.join(OUT, jmeno), optimize=True)
def bunky(strana, xs, ys, cisloRoh, cisloWH, inset=6, posledniWH=None):
    im = Image.open(f'str{strana}.png').convert('RGB'); out = []
    for r in range(len(ys) - 1):
        for c in range(len(xs) - 1):
            b = im.crop((xs[c] + inset, ys[r] + inset, xs[c + 1] - inset, ys[r + 1] - inset)).copy()
            w, h = b.size; d = ImageDraw.Draw(b); cw, ch = posledniWH if posledniWH and r == len(ys) - 2 else cisloWH
            if cisloRoh == 'pd':
                px = b.load()
                for x in range(w - cw, w):
                    for y in range(h - ch, h):
                        p = px[x, y]
                        if max(p) - min(p) < 40 and min(p) < 248: px[x, y] = (255, 255, 255)
            else: d.rectangle((0, 0, cw, ch), fill='white')
            out.append(b)
    return out
# značky 1–40 (str. 18, číslo vpravo dole)
for i, b in enumerate(bunky(18, [213, 485, 757, 1030, 1302, 1574], [277, 512, 768, 1022, 1276, 1533, 1787, 2044, 2318], 'pd', (62, 40), posledniWH=(62, 64)), 1): ulozit(b, 'znacka-%02d.png' % i)
# příroda 1–24 (str. 20–22, číslo vlevo nahoře)
X3 = [127, 608, 1119, 1635]
pr = bunky(20, X3, [1554, 1955], 'ln', (80, 62)) + bunky(21, X3, [186, 587, 988, 1426, 1827, 2228], 'ln', (80, 62)) + bunky(22, X3, [186, 587, 988], 'ln', (80, 62))
for i, b in enumerate(pr, 1): ulozit(b, 'priroda-%02d.png' % i)
# PO 1–20 (str. 32, číslo vlevo nahoře)
for i, b in enumerate(bunky(32, [343, 569, 798, 1025, 1253, 1480], [962, 1172, 1380, 1590, 1799], 'ln', (60, 50)), 1): ulozit(b, 'po-%02d.png' % i)
# uzly (str. 24, bez mřížky – výřez a popisek v pixelech strany 3×; popisek se zabělí)
im = Image.open('str24.png').convert('RGB')
UZ = [((285, 615, 600, 1000), (262, 872, 402, 982)), ((690, 690, 1130, 880), None), ((1200, 615, 1510, 960), (1372, 872, 1462, 982)),
      ((360, 1080, 960, 1258), None), ((1170, 1080, 1348, 1405), None)]
for i, (box, pop) in enumerate(UZ, 1):
    b = im.copy()
    if pop: ImageDraw.Draw(b).rectangle(pop, fill='white')
    ulozit(b.crop(box), 'uzel-%d.png' % i)
# zmenšení: fotky přírody 320 px a 256 barev, ostatní 256 barev (celkem kolem 1 MB)
import subprocess, glob
for f in glob.glob(os.path.join(OUT, '*.png')):
    subprocess.run(['magick', f] + (['-resize', '320x320', '-dither', 'FloydSteinberg'] if 'priroda-' in f else []) + ['-colors', '256', 'PNG8:' + f], check=True)
