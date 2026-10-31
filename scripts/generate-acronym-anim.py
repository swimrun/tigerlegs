#!/usr/bin/env python3
"""Generate animated TigerLegs acronym SVGs (light + dark variants).

TIGERLEGS -> Terrain Informed Gpx ExtractoR: LEts Go Swimrun!
Capitals slide apart while filler letters slide out from behind them.

Acronym capitals use Bebas Neue (caps-only brand font); lowercase fillers
use an Oswald subset scaled so its ascenders match the Bebas cap height.
Honors prefers-reduced-motion by showing the static compact logo.
"""
import base64

from fontTools.ttLib import TTFont

from pathlib import Path

REPO = str(Path(__file__).resolve().parent.parent)
CAP_FONT_PATH = f"{REPO}/public/fonts/bebas-neue.woff2"
FIL_FONT_PATH = f"{REPO}/public/fonts/oswald-lowercase-subset.woff2"

FS = 72  # capital font size px
ORANGE = "#fe7d0b"

# (name suffix, TIGER color, LEGS color)
VARIANTS = [
    ("", "#111318", "#1c7733"),        # light backgrounds (brand colors)
    ("-dark", "#fbbf24", "#4ade80"),   # dark backgrounds (amber-400, green-400)
]

cap_font = TTFont(CAP_FONT_PATH)
fil_font = TTFont(FIL_FONT_PATH)

# scale Oswald so its cap height matches the Bebas cap height
FIL_FS = FS * cap_font["OS/2"].sCapHeight / fil_font["OS/2"].sCapHeight


def _adv(font, ch: str, size: float) -> float:
    cmap = font.getBestCmap()
    return font["hmtx"][cmap[ord(ch)]][0] * size / font["head"].unitsPerEm


def adv(ch: str) -> float:  # capital (Bebas) advance
    return _adv(cap_font, ch, FS)


def width(s: str) -> float:  # filler (Oswald) width
    return sum(_adv(fil_font, c, FIL_FS) for c in s)


def build(suffix: str, dark: str, green: str) -> None:
    # (capital, filler-after-capital, trailing-space?, color)
    segments = [
        ("T", "errain", True, dark),
        ("I", "nformed", True, dark),
        ("G", "px", True, dark),
        ("E", "xtracto", False, dark),  # R follows immediately
        ("R", ":", True, dark),
        ("L", "", False, green),  # E follows immediately
        ("E", "ts", True, green),
        ("G", "o", True, green),
        ("S", "wimrun!", False, green),
    ]

    track = 2.0  # letter tracking in compact state (px)
    space = adv(" ")

    # compact x positions (capitals only, adjacent)
    compact_x = []
    x = 0.0
    for cap, _f, _s, _c in segments:
        compact_x.append(x)
        x += adv(cap) + track
    compact_w = x - track

    # expanded x positions (full phrase)
    expanded_x = []
    x = 0.0
    for cap, filler, sp, _c in segments:
        expanded_x.append(x)
        x += adv(cap) + width(filler) + (space if sp else 0)
    expanded_w = x - (space if segments[-1][2] else 0)

    pad = 28
    vb_w = expanded_w + 2 * pad
    vb_h = 132
    baseline = 92

    # center both states
    c_off = pad + (expanded_w - compact_w) / 2
    e_off = pad

    cap_b64 = base64.b64encode(open(CAP_FONT_PATH, "rb").read()).decode()
    fil_b64 = base64.b64encode(open(FIL_FONT_PATH, "rb").read()).decode()

    # animation timeline (% of one loop): hold compact, expand, hold, collapse
    k_hold1, k_open, k_hold2 = 10, 40, 85
    scale_compact = compact_w / expanded_w

    css = [f"""
    @font-face {{
      font-family: 'Bebas Neue';
      src: url(data:font/woff2;base64,{cap_b64}) format('woff2');
    }}
    @font-face {{
      font-family: 'Oswald Subset';
      font-weight: 500;
      src: url(data:font/woff2;base64,{fil_b64}) format('woff2');
    }}
    text {{
      font-family: 'Bebas Neue', 'Arial Narrow', sans-serif;
      font-size: {FS}px;
    }}
    g.seg {{ animation: 9s infinite both; }}
    .filler {{
      font-family: 'Oswald Subset', 'Arial Narrow', sans-serif;
      font-size: {FIL_FS:.1f}px;
      font-weight: 500;
      animation: 9s infinite both;
      opacity: 0;
    }}
    #underline {{
      animation: underline 9s infinite both;
      transform: scaleX({scale_compact:.4f});
      transform-origin: {pad + expanded_w / 2:.1f}px 0;
    }}
    @keyframes underline {{
      0%, {k_hold1}% {{ transform: scaleX({scale_compact:.4f}); animation-timing-function: cubic-bezier(.65,0,.35,1); }}
      {k_open}%, {k_hold2}% {{ transform: scaleX(1); animation-timing-function: cubic-bezier(.65,0,.35,1); }}
      100% {{ transform: scaleX({scale_compact:.4f}); }}
    }}
    @media (prefers-reduced-motion: reduce) {{
      g.seg, .filler, #underline {{ animation: none; }}
    }}"""]

    body = []
    for i, (cap, filler, _sp, color) in enumerate(segments):
        cx = c_off + compact_x[i]
        ex = e_off + expanded_x[i]
        cap_adv = adv(cap)
        css.append(f"""
    #seg{i} {{ animation-name: slide{i}; transform: translateX({cx:.1f}px); }}
    @keyframes slide{i} {{
      0%, {k_hold1}% {{ transform: translateX({cx:.1f}px); animation-timing-function: cubic-bezier(.65,0,.35,1); }}
      {k_open}%, {k_hold2}% {{ transform: translateX({ex:.1f}px); animation-timing-function: cubic-bezier(.65,0,.35,1); }}
      100% {{ transform: translateX({cx:.1f}px); }}
    }}""")
        filler_el = ""
        if filler:
            css.append(f"""
    #fil{i} {{ animation-name: out{i}; }}
    @keyframes out{i} {{
      0%, {k_hold1 + 2}% {{ transform: translateX({-cap_adv:.1f}px); opacity: 0; animation-timing-function: cubic-bezier(.65,0,.35,1); }}
      {k_open}%, {k_hold2}% {{ transform: translateX(0); opacity: 0.8; animation-timing-function: cubic-bezier(.65,0,.35,1); }}
      98%, 100% {{ transform: translateX({-cap_adv:.1f}px); opacity: 0; }}
    }}""")
            filler_el = (
                f'\n    <text id="fil{i}" class="filler" x="{cap_adv:.1f}" y="0" '
                f'fill="{color}">{filler}</text>'
            )
        body.append(f"""  <g id="seg{i}" class="seg">
    <text x="0" y="0" fill="{color}" font-weight="700">{cap}</text>{filler_el}
  </g>""")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w:.0f} {vb_h}" width="{vb_w:.0f}" height="{vb_h}" role="img"
     aria-label="TIGERLEGS stands for: Terrain Informed Gpx ExtractoR: LEts Go Swimrun!">
  <title>TIGERLEGS — Terrain Informed Gpx ExtractoR: LEts Go Swimrun!</title>
  <style>{''.join(css)}
  </style>
  <g transform="translate(0 {baseline})">
{chr(10).join(body)}
  </g>
  <!-- tiger-orange accent underline -->
  <rect id="underline" x="{pad}" y="{baseline + 16}" width="{expanded_w:.0f}" height="5" rx="2.5" fill="{ORANGE}"/>
</svg>
"""

    out = f"{REPO}/public/img/tigerlegs-acronym-anim{suffix}.svg"
    with open(out, "w") as fh:
        fh.write(svg)
    print(f"wrote {out} (compact {compact_w:.0f}px, expanded {expanded_w:.0f}px)")


for sfx, dark, green in VARIANTS:
    build(sfx, dark, green)
