"""Generate the 1280x640 social preview card.

This is a development-only helper; stargap itself has no runtime dependencies.
Requires Pillow: python -m pip install Pillow
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "social-card.png"
WIDTH, HEIGHT = 1280, 640

FONT_REGULAR = r"C:\Windows\Fonts\segoeui.ttf"
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"
FONT_MONO_BOLD = r"C:\Windows\Fonts\consolab.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def star_points(cx: float, cy: float, outer: float, inner: float) -> list[tuple[float, float]]:
    points = []
    for i in range(10):
        radius = outer if i % 2 == 0 else inner
        angle = -math.pi / 2 + i * math.pi / 5
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return points


def gradient() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT))
    pixels = image.load()
    top = (8, 11, 20)
    bottom = (29, 23, 72)
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        # Ease the gradient so the upper area stays deep and the lower area glows.
        t = t * t * (3 - 2 * t)
        for x in range(WIDTH):
            # Add a soft diagonal tint without a per-pixel blur pass.
            mix = max(0.0, 1.0 - ((WIDTH - x) / WIDTH) * 0.7 - (1 - t) * 0.2)
            r = int(top[0] + (bottom[0] - top[0]) * t + 4 * mix)
            g = int(top[1] + (bottom[1] - top[1]) * t + 1 * mix)
            b = int(top[2] + (bottom[2] - top[2]) * t + 18 * mix)
            pixels[x, y] = (r, g, b)
    return image


def glow() -> Image.Image:
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse((760, -300, 1450, 390), fill=(34, 211, 238, 90))
    draw.ellipse((-260, 180, 560, 900), fill=(129, 140, 248, 80))
    return overlay.filter(ImageFilter.GaussianBlur(85))


def draw_grid(image: Image.Image) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(0, WIDTH, 48):
        draw.line((x, 0, x, HEIGHT), fill=(148, 163, 184, 12), width=1)
    for y in range(0, HEIGHT, 48):
        draw.line((0, y, WIDTH, y), fill=(148, 163, 184, 12), width=1)
    image.alpha_composite(overlay)


def draw_brand(draw: ImageDraw.ImageDraw) -> None:
    draw.regular_polygon((82, 72, 22), n_sides=10, rotation=0, fill=(251, 191, 36, 255))
    draw.polygon(star_points(82, 72, 17, 7), fill=(8, 11, 20, 255))
    draw.text((122, 49), "stargap", font=font(FONT_BOLD, 34), fill=(231, 237, 248, 255))
    draw.text(
        (324, 62),
        "DISCOVERABILITY AUDIT FOR OPEN SOURCE",
        font=font(FONT_BOLD, 14),
        fill=(143, 160, 187, 255),
    )


def rounded_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 18) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=(10, 16, 29, 220), outline=(54, 72, 104, 230), width=2)


def main() -> None:
    image = gradient().convert("RGBA")
    image.alpha_composite(glow())
    draw_grid(image)
    draw = ImageDraw.Draw(image)

    draw_brand(draw)
    draw.text((64, 132), "Your repo isn't bad.", font=font(FONT_BOLD, 52), fill=(231, 237, 248, 255))
    draw.text((64, 196), "It's invisible.", font=font(FONT_BOLD, 52), fill=(103, 232, 249, 255))
    draw.text((430, 196), "Score it.", font=font(FONT_BOLD, 52), fill=(231, 237, 248, 255))

    rounded_panel(draw, (64, 292, 1216, 390), radius=18)
    draw.text((92, 322), "$", font=font(FONT_MONO_BOLD, 24), fill=(167, 139, 250, 255))
    draw.text(
        (126, 320),
        "node bin/stargap.mjs audit astral-sh/ruff",
        font=font(FONT_MONO, 25),
        fill=(203, 213, 225, 255),
    )
    draw.text((1060, 326), "Node 18+", font=font(FONT_MONO, 16), fill=(143, 160, 187, 255))

    rounded_panel(draw, (64, 418, 1216, 552), radius=18)
    draw.text((94, 446), "84.2", font=font(FONT_BOLD, 26), fill=(251, 191, 36, 255))
    draw.text((190, 446), "/100", font=font(FONT_BOLD, 26), fill=(143, 160, 187, 255))
    draw.text((286, 446), "A", font=font(FONT_BOLD, 26), fill=(52, 211, 153, 255))
    draw.text((338, 446), "discoverability", font=font(FONT_BOLD, 26), fill=(231, 237, 248, 255))
    draw.text(
        (94, 495),
        "19 explainable checks  ·  ranked fixes  ·  verified list gaps",
        font=font(FONT_REGULAR, 20),
        fill=(143, 160, 187, 255),
    )

    draw.text((64, 590), "github.com/jsxxwhai/stargap", font=font(FONT_BOLD, 18), fill=(167, 139, 250, 255))
    draw.text((782, 590), "Star it if it saves you a README crawl", font=font(FONT_REGULAR, 18), fill=(203, 213, 225, 255))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
