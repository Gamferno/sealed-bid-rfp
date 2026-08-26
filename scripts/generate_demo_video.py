import asyncio
import base64
import json
import os
import shutil
import subprocess
import time
import urllib.request
import websockets
from PIL import Image, ImageDraw, ImageFont
import edge_tts

TEMP_DIR = "docs/video_temp"
FRAME_DIR = "docs/video_temp/frames"
OUTPUT_VIDEO = "docs/demo-video.mp4"

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(FRAME_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────
# 1. Voiceover Definitions & Neural English Male Generation
# ─────────────────────────────────────────────────────────────────
VOICEOVERS = [
    ("s1_intro", "Create RFP Round", "Welcome to Sealed-Bid RFP, a privacy-preserving procurement platform built on the Midnight Network. A buyer deploys an RFP round with budget constraints and commit deadlines."),
    ("s2_bids", "Sealed Vendor Bids", "Three competing vendors submit their sealed bids. Each bid amount and randomness salt stay strictly client-side. Only a zero-knowledge commitment hash is recorded on-chain."),
    ("s3_ledger", "On-Chain Ledger Inspection", "Inspecting the on-chain ledger shows pure cryptographic commitments with zero leakage of numerical bids. No competitor can see another vendor's offer."),
    ("s4_reveal", "Zero-Knowledge Reveal", "Once the commit window closes, vendors reveal. Midnight's ZK circuits mathematically prove each bid is authentic and within budget without disclosing the actual numbers."),
    ("s5_settle", "Settlement & Fairness Audit", "We finalize the auction. The ZK circuit computes the lowest bid in zero knowledge and declares Vendor 1 the winner. Anyone can audit the outcome with on-chain fairness verification."),
    ("s6_tests", "Integration Test Suite", "Backed by 9 comprehensive integration tests and strict witness isolation, Sealed-Bid RFP brings true commercial privacy to decentralized procurement on Midnight.")
]

print("1. Generating high-quality English male neural voiceover (en-US-ChristopherNeural)...")
audio_info = {}

async def generate_voiceovers():
    for key, title, text in VOICEOVERS:
        mp3_path = f"{TEMP_DIR}/{key}.mp3"
        wav_path = f"{TEMP_DIR}/{key}.wav"
        tts = edge_tts.Communicate(text=text, voice="en-US-ChristopherNeural", rate="+3%")
        await tts.save(mp3_path)
        subprocess.run(["ffmpeg", "-y", "-i", mp3_path, "-ar", "44100", "-ac", "2", wav_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wav_path], stdout=subprocess.PIPE, text=True)
        dur = float(probe.stdout.strip())
        pad_dur = dur + 0.6
        audio_info[key] = {
            "title": title,
            "text": text,
            "wav": wav_path,
            "duration": pad_dur
        }
        print(f"   - {key}: {pad_dur:.2f}s")

asyncio.run(generate_voiceovers())

# ─────────────────────────────────────────────────────────────────
# 2. 1080p Browser Automation & Fullscreen Capture
# ─────────────────────────────────────────────────────────────────
print("2. Starting Chromium in full 1920x1080 fullscreen mode...")
proc = subprocess.Popen([
    "/usr/bin/chromium",
    "--headless=new",
    "--remote-debugging-port=9222",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1920,1080",
    "--force-device-scale-factor=1"
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)

screenshots = {}

async def capture_ui():
    req = urllib.request.Request("http://127.0.0.1:9222/json/new", method="PUT")
    with urllib.request.urlopen(req) as resp:
        page_info = json.loads(resp.read().decode())
        ws_url = page_info["webSocketDebuggerUrl"]

    async with websockets.connect(ws_url) as ws:
        msg_id = 1
        async def send_cmd(method, params={}):
            nonlocal msg_id
            cur_id = msg_id
            msg_id += 1
            await ws.send(json.dumps({"id": cur_id, "method": method, "params": params}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == cur_id:
                    return r.get("result", {})

        async def eval_js(expr):
            r = await send_cmd("Runtime.evaluate", {"expression": expr, "awaitPromise": True})
            return r.get("result", {}).get("value")

        async def snap(name):
            res = await send_cmd("Page.captureScreenshot", {
                "format": "png",
                "clip": {"x": 0, "y": 0, "width": 1920, "height": 1080, "scale": 1}
            })
            img_bytes = base64.b64decode(res["data"])
            path = f"{TEMP_DIR}/{name}.png"
            with open(path, "wb") as f:
                f.write(img_bytes)
            screenshots[name] = path
            print(f"   Captured {name}.png (1920x1080)")

        await send_cmd("Emulation.setDeviceMetricsOverride", {
            "width": 1920,
            "height": 1080,
            "deviceScaleFactor": 1,
            "mobile": False
        })

        await send_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
            window.midnight = {
              'io.lace.midnight': {
                apiVersion: '1.0.0',
                name: 'Lace (Preprod)',
                icon: '',
                connect: async () => ({
                  getUnshieldedAddress: async () => ({
                    unshieldedAddress: 'mn_addr_preprod_8f3a9e2d1c7b'
                  })
                })
              }
            };
            """
        })

        await send_cmd("Page.enable")
        await send_cmd("Page.navigate", {"url": "http://127.0.0.1:5173"})
        await asyncio.sleep(2.0)

        # Connect wallet
        await eval_js("""
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Connect Wallet'));
          if (btn) btn.click();
        })()
        """)
        await asyncio.sleep(0.5)
        await eval_js("""
        (() => {
          const laceBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Lace'));
          if (laceBtn) laceBtn.click();
        })()
        """)
        await asyncio.sleep(0.8)

        # Switch to Create RFP tab
        await eval_js("""
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create RFP') || b.textContent.includes('Create New RFP'));
          if (btn) btn.click();
        })()
        """)
        await asyncio.sleep(0.5)
        await snap("s1_create_form")

        # Deploy RFP
        await eval_js("""
        (() => {
          const form = document.querySelector('form');
          if (form) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.click();
          }
        })()
        """)
        await asyncio.sleep(1.5)
        await snap("s1_deployed")

        # Seal Bid - Submit 3 vendor bids directly into ContractService
        await eval_js("""
        (async () => {
          const addr = localStorage.getItem('midnight_last_active_rfp_address');
          const { ContractService } = await import('/src/contractService.ts');
          
          // Vendor 0 (Alpha) - 250 tDUST
          const salt0 = new Uint8Array(32);
          crypto.getRandomValues(salt0);
          await ContractService.submitCommitment({
            contractAddress: addr,
            walletAddress: 'mn_addr_preprod_8f3a9e2d1c7b',
            bid: 250n,
            salt: salt0
          });

          // Vendor 1 (Beta) - 120 tDUST (Lowest Bidder)
          const salt1 = new Uint8Array(32);
          crypto.getRandomValues(salt1);
          await ContractService.submitCommitment({
            contractAddress: addr,
            walletAddress: 'mn_addr_preprod_vendor1_beta',
            bid: 120n,
            salt: salt1
          });

          // Vendor 2 (Gamma) - 310 tDUST
          const salt2 = new Uint8Array(32);
          crypto.getRandomValues(salt2);
          await ContractService.submitCommitment({
            contractAddress: addr,
            walletAddress: 'mn_addr_preprod_vendor2_gamma',
            bid: 310n,
            salt: salt2
          });
        })()
        """)
        await asyncio.sleep(1.0)

        # Switch to Bid Tab to show sealed slots
        await eval_js("""
        (() => {
          const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Seal Bid'));
          if (tab) tab.click();
        })()
        """)
        await asyncio.sleep(1.0)
        await snap("s2_sealed_bids")

        # Open Inspector Modal
        await eval_js("""
        (() => {
          const inspectBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Inspect'));
          if (inspectBtn) inspectBtn.click();
        })()
        """)
        await asyncio.sleep(0.8)
        await snap("s3_inspector_modal")

        # Close Modal & Advance phase early
        await eval_js("""
        (() => {
          const closeBtn = document.querySelector('.modal-close-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Close') || b.textContent.includes('Done'));
          if (closeBtn) closeBtn.click();
        })()
        """)
        await asyncio.sleep(0.5)

        await eval_js("""
        (async () => {
          const addr = localStorage.getItem('midnight_last_active_rfp_address');
          const { ContractService } = await import('/src/contractService.ts');
          await ContractService.finalizeCommitPhaseEarly({
            contractAddress: addr,
            callerAddress: 'mn_addr_preprod_8f3a9e2d1c7b'
          });
        })()
        """)
        await asyncio.sleep(1.0)

        # Switch to ZK Reveal Tab and Reveal all 3 vendors
        await eval_js("""
        (() => {
          const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ZK Reveal'));
          if (tab) tab.click();
        })()
        """)
        await asyncio.sleep(0.8)

        await eval_js("""
        (async () => {
          const addr = localStorage.getItem('midnight_last_active_rfp_address');
          const { ContractService } = await import('/src/contractService.ts');
          
          await ContractService.revealBid({
            contractAddress: addr,
            walletAddress: 'mn_addr_preprod_8f3a9e2d1c7b'
          });
          await ContractService.revealBid({
            contractAddress: addr,
            walletAddress: 'mn_addr_preprod_vendor1_beta'
          });
          await ContractService.revealBid({
            contractAddress: addr,
            walletAddress: 'mn_addr_preprod_vendor2_gamma'
          });
        })()
        """)
        await asyncio.sleep(1.0)
        await snap("s4_revealed_cards")

        # Switch to Results Tab
        await eval_js("""
        (() => {
          const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Settle & Audit'));
          if (tab) tab.click();
        })()
        """)
        await asyncio.sleep(0.8)

        # Determine Winner & Run Verify Fairness
        await eval_js("""
        (async () => {
          const addr = localStorage.getItem('midnight_last_active_rfp_address');
          const { ContractService } = await import('/src/contractService.ts');
          await ContractService.determineWinner({ contractAddress: addr });
          await ContractService.verifyFairness({ contractAddress: addr });
        })()
        """)
        await asyncio.sleep(1.0)
        await snap("s5_winner_settled")

asyncio.run(capture_ui())
proc.terminate()

screenshots["s6_test_suite"] = "docs/screenshots/test-output.png"

# ─────────────────────────────────────────────────────────────────
# 3. 1080p Frame Composition & Subtle Floating Subtitle Bar
# ─────────────────────────────────────────────────────────────────
print("3. Composing 1080p FHD video frames with floating subtitle overlays...")

bold_font_path = "/usr/share/fonts/TTF/JetBrainsMono-Bold.ttf"
reg_font_path = "/usr/share/fonts/TTF/JetBrainsMono-Regular.ttf"
if not os.path.exists(bold_font_path):
    bold_font_path = "/usr/share/fonts/TTF/DejaVuSansMono-Bold.ttf"
    reg_font_path = "/usr/share/fonts/TTF/DejaVuSansMono.ttf"

title_font = ImageFont.truetype(bold_font_path, 20)
sub_font = ImageFont.truetype(reg_font_path, 17)
badge_font = ImageFont.truetype(bold_font_path, 13)

def render_overlay_frame(base_img_path, scene_title, scene_text):
    base = Image.open(base_img_path).convert("RGBA")
    base = base.resize((1920, 1080), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(base)

    # Sleek floating subtitle pill at bottom (height 100px, width 1560px centered)
    bx0, by0, bx1, by1 = 180, 940, 1740, 1045
    draw.rounded_rectangle([bx0, by0, bx1, by1], radius=14, fill=(10, 15, 26, 230), outline=(99, 102, 241, 160), width=2)

    # Midnight ZK Chip
    draw.rounded_rectangle([bx0 + 20, by0 + 14, bx0 + 160, by0 + 38], radius=6, fill=(49, 46, 129, 255))
    draw.text((bx0 + 30, by0 + 18), "MIDNIGHT ZK", fill=(199, 210, 254), font=badge_font)

    # Scene Title
    draw.text((bx0 + 180, by0 + 15), scene_title.upper(), fill=(255, 255, 255), font=title_font)

    # Voiceover text (wrapped across 2 lines max)
    max_w = 1500
    words = scene_text.split()
    lines = []
    cur_line = ""
    for w in words:
        test_line = f"{cur_line} {w}".strip()
        bbox = sub_font.getbbox(test_line)
        if bbox[2] - bbox[0] < max_w:
            cur_line = test_line
        else:
            lines.append(cur_line)
            cur_line = w
    if cur_line:
        lines.append(cur_line)

    ty = by0 + 48
    for l in lines[:2]:
        draw.text((bx0 + 22, ty), l, fill=(226, 232, 240), font=sub_font)
        ty += 24

    return base.convert("RGB")

SCENE_CONFIG = [
    ("s1_intro", [("s1_create_form", 0.5), ("s1_deployed", 0.5)]),
    ("s2_bids", [("s2_sealed_bids", 1.0)]),
    ("s3_ledger", [("s3_inspector_modal", 1.0)]),
    ("s4_reveal", [("s4_revealed_cards", 1.0)]),
    ("s5_settle", [("s5_winner_settled", 1.0)]),
    ("s6_tests", [("s6_test_suite", 1.0)])
]

segment_videos = []
fps = 30

for scene_key, shots in SCENE_CONFIG:
    info = audio_info[scene_key]
    dur = info["duration"]
    seg_video_path = f"{TEMP_DIR}/{scene_key}_seg.mp4"
    seg_frames_dir = f"{TEMP_DIR}/frames_{scene_key}"
    os.makedirs(seg_frames_dir, exist_ok=True)

    total_frames = int(dur * fps)
    
    frame_idx = 0
    shot_idx = 0
    shots_count = len(shots)
    frames_per_shot = total_frames // shots_count

    for shot_name, _ in shots:
        shot_img_path = screenshots[shot_name]
        frame_img = render_overlay_frame(shot_img_path, info["title"], info["text"])
        
        target_count = frames_per_shot if shot_idx < shots_count - 1 else (total_frames - frame_idx)
        for _ in range(target_count):
            frame_img.save(f"{seg_frames_dir}/frame_{frame_idx:05d}.png")
            frame_idx += 1
        shot_idx += 1

    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", f"{seg_frames_dir}/frame_%05d.png",
        "-i", info["wav"],
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        seg_video_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    segment_videos.append(seg_video_path)
    print(f"   Created 1080p segment {seg_video_path} ({dur:.2f}s)")

# ─────────────────────────────────────────────────────────────────
# 4. Final 1080p Master Concatenation
# ─────────────────────────────────────────────────────────────────
print("4. Concatenating all 1080p segments into final MP4 video...")
concat_list_path = f"{TEMP_DIR}/concat_list.txt"
with open(concat_list_path, "w") as f:
    for seg in segment_videos:
        f.write(f"file '{os.path.abspath(seg)}'\n")

cmd_final = [
    "ffmpeg", "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concat_list_path,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-movflags", "+faststart",
    OUTPUT_VIDEO
]
subprocess.run(cmd_final, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "default=noprint_wrappers=1", OUTPUT_VIDEO], stdout=subprocess.PIPE, text=True)
print(probe.stdout)
file_size_mb = os.path.getsize(OUTPUT_VIDEO) / (1024 * 1024)

print(f"\n=======================================================")
print(f" SUCCESS! 1080p FHD Video Generated:")
print(f" File:       {OUTPUT_VIDEO}")
print(f" Resolution: 1920x1080 (FHD)")
print(f" Voice:      English Male (Neural AI)")
print(f" Size:       {file_size_mb:.2f} MB")
print(f"=======================================================\n")
