import sys, json, os, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
scn = sys.argv[1]; draws = sys.argv[2].split(','); times = [float(x) for x in sys.argv[3].split(',')]
tune = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
out = sys.argv[5] if len(sys.argv) > 5 else f'{scn}.png'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 720, 'height': 1280})
    pg.goto('file://' + os.path.join(HERE, 'test.html'))
    rows = []
    for d in draws:
        info = pg.evaluate(f"setup('{scn}','{d}', {{tune: {json.dumps(tune)}}})")
        frames = []; last = 0.0; log = []
        for t in times:
            pg.evaluate(f"run({int(round((t-last)*60))})"); last = t
            pg.evaluate("draw()")
            png = pg.locator('#c').screenshot()
            frames.append(Image.open(io.BytesIO(png)).convert('RGB').resize((216, 384)))
            log.append(pg.evaluate("stats()"))
        print(d, info, log[-1])
        rows.append(frames)
    b.close()
W, H = 216, 384
sheet = Image.new('RGB', (W * len(times), H * len(rows)), 'white')
for r, fr in enumerate(rows):
    for c, im in enumerate(fr): sheet.paste(im, (c * W, r * H))
sheet.save(os.path.join(HERE, out))
