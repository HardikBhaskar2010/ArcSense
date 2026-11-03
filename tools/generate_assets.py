"""
ArcSense Android Assets Generator
Generates high-fidelity icons (adaptive, legacy, round) and splash screens
for all Android screen densities and orientations.
Uses 4x supersampling with Lanczos filtering for vector-like sharpness.
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT_RES = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
ROOT_RES = os.path.abspath(ROOT_RES)

DARK_BG = (9, 13, 22)        # #090D16
DARK_SURFACE = (16, 23, 38)  # #101726
CYAN_GLOW = (0, 229, 255)    # #00E5FF
CYAN_CORE = (180, 250, 255)  # Light cyan
AMBER_ACCENT = (245, 158, 11)# #F59E0B
WHITE = (255, 255, 255)

def get_font(size, bold=True, mono=False):
    paths = []
    if mono:
        paths = ["C:/Windows/Fonts/consola.ttf", "C:/Windows/Fonts/consolab.ttf"]
    elif bold:
        paths = ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"]
    else:
        paths = ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"]
    
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_shield_path(draw, cx, cy, width, height, fill=None, outline=None, outline_width=1):
    """Draws a sleek high-tech shield shape."""
    w2 = width / 2.0
    top = cy - height / 2.0
    bot = cy + height / 2.0
    mid_y = cy + height * 0.1
    
    points = [
        (cx, top - height * 0.05),              # Top crest point
        (cx + w2 * 0.85, top),                  # Top right shoulder
        (cx + w2, top + height * 0.22),         # Upper right curve
        (cx + w2 * 0.85, mid_y),                # Mid right
        (cx, bot),                              # Bottom tip
        (cx - w2 * 0.85, mid_y),                # Mid left
        (cx - w2, top + height * 0.22),         # Upper left curve
        (cx - w2 * 0.85, top),                  # Top left shoulder
    ]
    draw.polygon(points, fill=fill, outline=outline, width=outline_width)

def draw_lightning_bolt(draw, cx, cy, size, fill=WHITE, outline=CYAN_GLOW, outline_width=2):
    """Draws a sharp electrical arc / lightning bolt."""
    s = size / 100.0
    # Coordinates relative to center
    pts = [
        (cx + 6 * s,  cy - 48 * s),
        (cx - 24 * s, cy - 2 * s),
        (cx - 4 * s,  cy - 2 * s),
        (cx - 16 * s, cy + 48 * s),
        (cx + 26 * s, cy + 2 * s),
        (cx + 6 * s,  cy + 2 * s),
    ]
    draw.polygon(pts, fill=fill, outline=outline, width=outline_width)

def draw_waveform(draw, cx, cy, width, amplitude, color=CYAN_GLOW, width_px=3):
    """Draws an AC current waveform trace across the shield."""
    pts = []
    steps = 60
    for i in range(steps + 1):
        x = cx - width / 2.0 + (width * i / steps)
        # 1.5 cycles of sine wave
        phase = (i / steps) * 3 * math.pi
        y = cy + math.sin(phase) * amplitude
        pts.append((x, y))
    
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i+1]], fill=color, width=width_px)

def render_master_icon(size=1024, is_round=False, transparent_bg=False):
    """Renders a super-sampled master icon."""
    scale = 2
    W = size * scale
    H = size * scale
    
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = W // 2, H // 2
    
    if not transparent_bg:
        if is_round:
            # Circle with glowing border
            r = W // 2 - 16 * scale
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DARK_BG, outline=CYAN_GLOW, width=8 * scale)
        else:
            # Rounded squircle
            pad = 24 * scale
            corner = 160 * scale
            draw.rounded_rectangle([pad, pad, W - pad, H - pad], radius=corner, fill=DARK_BG, outline=CYAN_GLOW, width=8 * scale)
        
        # Subtle cyber grid background
        grid_step = 64 * scale
        grid_color = (20, 35, 55, 120)
        for gx in range(0, W, grid_step):
            draw.line([(gx, 0), (gx, H)], fill=grid_color, width=1 * scale)
        for gy in range(0, H, grid_step):
            draw.line([(gx, gy), (W, gy)], fill=grid_color, width=1 * scale)

    # Outer Shield Glow (drawn with multiple translucent layers)
    shield_w = int(W * 0.54)
    shield_h = int(H * 0.62)
    
    # Outer Shield boundary
    draw_shield_path(draw, cx, cy, shield_w, shield_h, fill=(12, 22, 38, 220), outline=CYAN_GLOW, outline_width=6 * scale)
    
    # Inner Shield border
    inner_w = int(shield_w * 0.82)
    inner_h = int(shield_h * 0.82)
    draw_shield_path(draw, cx, cy, inner_w, inner_h, fill=(7, 14, 25, 240), outline=(0, 229, 255, 130), outline_width=3 * scale)
    
    # Waveform trace in background of shield
    draw_waveform(draw, cx, cy + int(shield_h * 0.05), int(inner_w * 0.85), int(28 * scale), color=(0, 229, 255, 90), width_px=3 * scale)
    
    # Glow layer for lightning bolt
    draw_lightning_bolt(draw, cx, cy, int(shield_h * 0.72), fill=(0, 229, 255, 180), outline=CYAN_GLOW, outline_width=8 * scale)
    # Core lightning bolt
    draw_lightning_bolt(draw, cx, cy, int(shield_h * 0.68), fill=WHITE, outline=CYAN_CORE, outline_width=3 * scale)
    
    # Spark accents
    spark_font = get_font(int(24 * scale), bold=True, mono=True)
    draw.text((cx - int(shield_w * 0.4), cy - int(shield_h * 0.3)), "+", fill=CYAN_GLOW, font=spark_font)
    draw.text((cx + int(shield_w * 0.35), cy + int(shield_h * 0.1)), "+", fill=AMBER_ACCENT, font=spark_font)
    
    # Downsample with Lanczos
    return img.resize((size, size), Image.Resampling.LANCZOS)

def render_foreground_icon(size=432):
    """
    Renders the foreground for adaptive icons.
    Android adaptive icon foreground has a safe zone in the center 66%.
    Everything outside the center 66% may be masked by the OS.
    """
    scale = 2
    W = size * scale
    H = size * scale
    
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = W // 2, H // 2
    
    # Fit comfortably inside the 66% circle (safe zone: diameter ~ 0.66 * W)
    shield_w = int(W * 0.44)
    shield_h = int(H * 0.52)
    
    # Outer Shield boundary
    draw_shield_path(draw, cx, cy, shield_w, shield_h, fill=(16, 26, 46, 255), outline=CYAN_GLOW, outline_width=5 * scale)
    
    # Inner Shield
    inner_w = int(shield_w * 0.82)
    inner_h = int(shield_h * 0.82)
    draw_shield_path(draw, cx, cy, inner_w, inner_h, fill=(8, 15, 27, 255), outline=(0, 229, 255, 150), outline_width=3 * scale)
    
    # Waveform trace
    draw_waveform(draw, cx, cy + int(shield_h * 0.05), int(inner_w * 0.85), int(22 * scale), color=(0, 229, 255, 120), width_px=3 * scale)
    
    # Glowing lightning bolt
    draw_lightning_bolt(draw, cx, cy, int(shield_h * 0.68), fill=(0, 229, 255, 200), outline=CYAN_GLOW, outline_width=6 * scale)
    draw_lightning_bolt(draw, cx, cy, int(shield_h * 0.64), fill=WHITE, outline=CYAN_CORE, outline_width=2 * scale)

    return img.resize((size, size), Image.Resampling.LANCZOS)

def render_splash_screen(width, height):
    """
    Renders high-tech industrial dark splash screen tailored to (width, height).
    """
    scale = 2 if max(width, height) <= 1280 else 1
    W = width * scale
    H = height * scale
    
    img = Image.new("RGB", (W, H), DARK_BG)
    draw = ImageDraw.Draw(img)
    
    cx, cy = W // 2, H // 2
    
    # Technical grid lines
    grid_step = max(30, int(min(W, H) * 0.08))
    grid_color = (15, 22, 34)
    for x in range(0, W, grid_step):
        draw.line([(x, 0), (x, H)], fill=grid_color, width=1)
    for y in range(0, H, grid_step):
        draw.line([(0, y), (W, y)], fill=grid_color, width=1)
    
    # Radial glow at center
    glow_radius = int(min(W, H) * 0.45)
    # Simulated radial glow with concentric circles
    for r in range(glow_radius, 0, -max(2, glow_radius // 25)):
        alpha = int(22 * (1.0 - (r / glow_radius)))
        glow_col = (9 + alpha // 2, 13 + alpha, 22 + alpha * 2)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=glow_col)
    
    # Calculate scale factor based on screen orientation
    is_portrait = H >= W
    logo_size = int(min(W, H) * (0.38 if is_portrait else 0.42))
    
    # Shift center slightly up to make room for text
    logo_cy = cy - int(min(W, H) * (0.10 if is_portrait else 0.06))
    
    # Draw Shield
    shield_w = int(logo_size * 0.85)
    shield_h = int(logo_size * 1.05)
    
    draw_shield_path(draw, cx, logo_cy, shield_w, shield_h, fill=(14, 22, 36), outline=CYAN_GLOW, outline_width=max(2, int(3 * scale)))
    
    inner_w = int(shield_w * 0.84)
    inner_h = int(shield_h * 0.84)
    draw_shield_path(draw, cx, logo_cy, inner_w, inner_h, fill=(7, 12, 22), outline=(0, 200, 230), outline_width=max(1, int(2 * scale)))
    
    # Waveform trace inside shield
    draw_waveform(draw, cx, logo_cy + int(shield_h * 0.05), int(inner_w * 0.85), int(shield_h * 0.08), color=(0, 229, 255), width_px=max(1, int(2 * scale)))
    
    # Lightning Bolt
    draw_lightning_bolt(draw, cx, logo_cy, int(shield_h * 0.65), fill=WHITE, outline=CYAN_GLOW, outline_width=max(2, int(3 * scale)))
    
    # Text Rendering
    title_size = max(18, int(min(W, H) * (0.055 if is_portrait else 0.065)))
    title_font = get_font(title_size, bold=True)
    
    title_text = "ARCSENSE"
    bbox = draw.textbbox((0, 0), title_text, font=title_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    
    text_y = logo_cy + shield_h // 2 + int(min(W, H) * 0.06)
    draw.text((cx - tw // 2, text_y), title_text, fill=WHITE, font=title_font)
    
    # Subtitle: PRE-FIRE ELECTRICAL FAULT PREDICTOR
    sub_size = max(10, int(title_size * 0.38))
    sub_font = get_font(sub_size, bold=False, mono=True)
    sub_text = "PRE-FIRE ELECTRICAL FAULT PREDICTOR"
    s_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    s_tw = s_bbox[2] - s_bbox[0]
    draw.text((cx - s_tw // 2, text_y + th + int(10 * scale)), sub_text, fill=(0, 229, 255), font=sub_font)
    
    # Category / Exhibition Badge
    tag_size = max(9, int(title_size * 0.32))
    tag_font = get_font(tag_size, bold=True, mono=True)
    tag_text = "CAT C2 · DISASTER MGT · ATAL TINKERING LAB"
    t_bbox = draw.textbbox((0, 0), tag_text, font=tag_font)
    t_tw = t_bbox[2] - t_bbox[0]
    
    tag_y = text_y + th + int(36 * scale)
    pad_x = 12 * scale
    pad_y = 5 * scale
    draw.rounded_rectangle([cx - t_tw // 2 - pad_x, tag_y - pad_y, cx + t_tw // 2 + pad_x, tag_y + t_bbox[3] - t_bbox[1] + pad_y],
                           radius=4 * scale, fill=(16, 25, 42), outline=(40, 60, 90), width=1)
    draw.text((cx - t_tw // 2, tag_y), tag_text, fill=(180, 200, 220), font=tag_font)
    
    # Status bar / Hardware bridge ready indicator at bottom
    bar_w = int(min(W, H) * 0.5)
    bar_h = max(3, int(3 * scale))
    bar_y = H - int(min(W, H) * 0.08)
    draw.rectangle([cx - bar_w // 2, bar_y, cx + bar_w // 2, bar_y + bar_h], fill=(25, 40, 60))
    # Active cyan pulse indicator
    pulse_w = int(bar_w * 0.35)
    draw.rectangle([cx - pulse_w // 2, bar_y, cx + pulse_w // 2, bar_y + bar_h], fill=CYAN_GLOW)
    
    foot_size = max(8, int(title_size * 0.28))
    foot_font = get_font(foot_size, bold=False, mono=True)
    foot_text = "INITIALIZING HARDWARE BRIDGE (192.168.4.1)..."
    f_bbox = draw.textbbox((0, 0), foot_text, font=foot_font)
    draw.text((cx - (f_bbox[2] - f_bbox[0]) // 2, bar_y - int(16 * scale)), foot_text, fill=(100, 130, 160), font=foot_font)

    if scale > 1:
        return img.resize((width, height), Image.Resampling.LANCZOS)
    return img

def main():
    print(f"Generating ArcSense Assets to: {ROOT_RES}")
    
    # 1. Icons Configurations: (folder, icon_size, fg_size)
    icon_configs = [
        ('mipmap-mdpi', 48, 108),
        ('mipmap-hdpi', 72, 162),
        ('mipmap-xhdpi', 96, 216),
        ('mipmap-xxhdpi', 144, 324),
        ('mipmap-xxxhdpi', 192, 432),
    ]
    
    for folder, icon_size, fg_size in icon_configs:
        dir_path = os.path.join(ROOT_RES, folder)
        os.makedirs(dir_path, exist_ok=True)
        
        # Standard icon
        im_std = render_master_icon(size=icon_size, is_round=False)
        im_std.save(os.path.join(dir_path, 'ic_launcher.png'), 'PNG')
        
        # Round icon
        im_round = render_master_icon(size=icon_size, is_round=True)
        im_round.save(os.path.join(dir_path, 'ic_launcher_round.png'), 'PNG')
        
        # Adaptive foreground
        im_fg = render_foreground_icon(size=fg_size)
        im_fg.save(os.path.join(dir_path, 'ic_launcher_foreground.png'), 'PNG')
        
        print(f"Generated {folder}: ic_launcher ({icon_size}x{icon_size}), round, fg ({fg_size}x{fg_size})")

    # High-res playstore master icon (512x512)
    master_512 = render_master_icon(size=512, is_round=False)
    master_512.save(os.path.join(ROOT_RES, 'ic_launcher-512.png'), 'PNG')
    # Also save to public/ if needed
    os.makedirs(os.path.join(ROOT_RES, '..', '..', '..', '..', 'public'), exist_ok=True)
    master_512.save(os.path.join(ROOT_RES, '..', '..', '..', '..', 'public', 'favicon.png'), 'PNG')
    print("Generated 512x512 master icon.")

    # 2. Splash Screens
    splash_configs = [
        ('drawable', 480, 320),
        ('drawable-land-mdpi', 480, 320),
        ('drawable-land-hdpi', 800, 480),
        ('drawable-land-xhdpi', 1280, 720),
        ('drawable-land-xxhdpi', 1600, 960),
        ('drawable-land-xxxhdpi', 1920, 1280),
        ('drawable-port-mdpi', 320, 480),
        ('drawable-port-hdpi', 480, 800),
        ('drawable-port-xhdpi', 720, 1280),
        ('drawable-port-xxhdpi', 960, 1600),
        ('drawable-port-xxxhdpi', 1280, 1920),
    ]

    for folder, w, h in splash_configs:
        dir_path = os.path.join(ROOT_RES, folder)
        os.makedirs(dir_path, exist_ok=True)
        splash_img = render_splash_screen(w, h)
        out_file = os.path.join(dir_path, 'splash.png')
        splash_img.save(out_file, 'PNG')
        print(f"Generated {folder}/splash.png ({w}x{h})")

    print("All ArcSense assets generated successfully!")

if __name__ == '__main__':
    main()

