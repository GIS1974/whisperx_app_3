To achieve the highest transcription quality with WhisperX, you want to extract audio from video files in a way that preserves as much speech information as possible, avoids unnecessary compression, and matches the model’s optimal input format. Here are the best practices and recommended FFmpeg settings:

### **1. Audio Codec and Format**
- **Codec:** Use `pcm_s16le` (uncompressed 16-bit PCM, little-endian) for lossless extraction, or `flac` for lossless compression.
- **Container:** Use `.wav` for PCM or `.flac` for FLAC.

### **2. Sample Rate**
- **Recommended:** 16 kHz (`16000`) or 24 kHz (`24000`). WhisperX works well with 16 kHz, but 24 kHz is also safe.
- **Why:** Most speech models, including WhisperX, are trained on 16 kHz audio.

### **3. Channels**
- **Recommended:** Mono (`-ac 1`).
- **Why:** Speech models expect mono input; stereo can cause issues or reduce accuracy.

### **4. Bit Depth**
- **Recommended:** 16-bit (`pcm_s16le`).
- **Why:** 16-bit is standard for speech recognition and is sufficient for quality.

### **5. Volume Normalization (Optional but Recommended)**
- **Why:** Ensures consistent loudness, which can help transcription accuracy.
- **How:** Use FFmpeg’s `loudnorm` filter.

---

### **Optimal FFmpeg Command**

#### **A. For WAV (Uncompressed, Best for WhisperX)**

ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 output.wav
```
- `-i input.mp4`: Input video file.
- `-vn`: No video.
- `-acodec pcm_s16le`: 16-bit PCM audio.
- `-ar 16000`: 16 kHz sample rate.
- `-ac 1`: Mono channel.

#### **B. For FLAC (Lossless Compression, Smaller Files)**

ffmpeg -i input.mp4 -vn -acodec flac -ar 16000 -ac 1 output.flac
```

#### **C. With Volume Normalization**

ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 -af loudnorm output.wav
```
- `-af loudnorm`: Applies EBU R128 loudness normalization.

---

### **Summary Table**

| Parameter      | Value         | FFmpeg Option         |
|----------------|--------------|----------------------|
| Codec          | pcm_s16le    | `-acodec pcm_s16le`  |
| Sample Rate    | 16000 Hz     | `-ar 16000`          |
| Channels       | Mono         | `-ac 1`              |
| Container      | WAV/FLAC     | `.wav`/`.flac`       |
| Normalization  | Optional     | `-af loudnorm`       |

---

### **Additional Tips**
- Avoid MP3 or AAC for extraction, as they are lossy and may degrade speech quality.
- If the source audio is higher quality (e.g., 48 kHz), downsampling to 16 kHz is fine for WhisperX.
- If you want to batch process, you can use FFmpeg in a script to process multiple files.

---

**References:**
- [WhisperX GitHub](https://github.com/m-bain/whisperX#usage)
- [OpenAI Whisper Model Card](https://github.com/openai/whisper#usage)
- [FFmpeg Documentation](https://ffmpeg.org/ffmpeg.html)