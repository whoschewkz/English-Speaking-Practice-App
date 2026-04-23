/**
 * Audio Processing Utility for High-Quality Voice Capture
 * Features:
 * - Web Audio API with noise gate & gain normalization
 * - WAV encoding for better Groq Whisper compatibility
 * - Echo cancellation & auto gain control
 * - Proper audio constraints for microphone
 */

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  noiseGateThreshold: number; // 0-1, default 0.01
  targetGain: number; // normalized to 0-1
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 16000, // Groq Whisper optimized for 16kHz
  channels: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  noiseGateThreshold: 0.01,
  targetGain: 0.8,
};

/**
 * Get optimal audio constraints for the browser
 */
export function getAudioConstraints(config: AudioConfig) {
  return {
    audio: {
      sampleRate: { ideal: config.sampleRate },
      echoCancellation: config.echoCancellation,
      noiseSuppression: config.noiseSuppression,
      autoGainControl: config.autoGainControl,
      // Try to get mono for better processing
      channelCount: { ideal: config.channels },
    },
    video: false,
  };
}

/**
 * AudioProcessor: Records audio with preprocessing & WAV encoding
 */
export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private audioChunks: Float32Array[] = [];
  private recordingStartTime: number = 0;
  private isRecording: boolean = false;
  private config: AudioConfig;

  constructor(config: Partial<AudioConfig> = {}) {
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  /**
   * Start recording with audio processing
   */
  async startRecording(
    stream: MediaStream,
    onAudioData?: (data: Float32Array) => void
  ): Promise<void> {
    this.mediaStream = stream;
    this.audioChunks = [];
    this.recordingStartTime = Date.now();

    // Create audio context with optimized sample rate
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: this.config.sampleRate,
    });
    this.audioContext = audioContext;

    // Create nodes
    this.sourceNode = audioContext.createMediaStreamSource(stream);
    this.gainNode = audioContext.createGain();
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;

    // Script processor for real-time processing
    this.scriptNode = audioContext.createScriptProcessor(4096, 1, 1);

    // Connect nodes: source → gain → analyser → script → destination
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.scriptNode);
    this.scriptNode.connect(audioContext.destination);

    // Setup processing
    this.scriptNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      
      // Create a copy for processing
      const processedData = new Float32Array(inputData.length);
      
      // 1. Noise gate - remove very quiet sounds
      const maxVolume = Math.max(...Array.from(inputData).map(Math.abs));
      const threshold = this.config.noiseGateThreshold;
      
      for (let i = 0; i < inputData.length; i++) {
        if (Math.abs(inputData[i]) > threshold) {
          processedData[i] = inputData[i];
        } else {
          processedData[i] = 0;
        }
      }

      // 2. Gain normalization - boost quiet audio
      if (maxVolume > 0) {
        const normalizedGain = (this.config.targetGain / maxVolume);
        const limitedGain = Math.min(normalizedGain, 2.0); // Cap at 2x to prevent distortion
        
        for (let i = 0; i < processedData.length; i++) {
          processedData[i] = processedData[i] * limitedGain;
          // Soft clipping to prevent distortion
          processedData[i] = Math.max(-1, Math.min(1, processedData[i]));
        }
      }

      // Store processed audio
      this.audioChunks.push(processedData);

      // Callback for real-time visualization (optional)
      if (onAudioData) {
        onAudioData(processedData);
      }
    };

    this.isRecording = true;
  }

  /**
   * Stop recording and return WAV blob
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (this.scriptNode) {
        this.scriptNode.onaudioprocess = null;
      }

      // Cleanup streams
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }

      this.isRecording = false;

      // Merge all audio chunks
      const totalLength = this.audioChunks.reduce((sum, arr) => sum + arr.length, 0);
      const mergedAudio = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of this.audioChunks) {
        mergedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert to WAV
      const wavBlob = this.encodeWAV(mergedAudio);
      resolve(wavBlob);
    });
  }

  /**
   * Convert Float32Array to WAV blob
   * Reference: https://stackoverflow.com/questions/2353550/how-do-i-save-canvas-as-an-image
   */
  private encodeWAV(audioData: Float32Array): Blob {
    const sampleRate = this.config.sampleRate;
    const channels = [audioData]; // Mono
    const length = audioData.length * channels.length * 2; // 16-bit audio
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 1, true); // NumChannels (Mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(36, "data");
    view.setUint32(40, length, true);

    // Write PCM data
    let index = 44;
    for (let i = 0; i < audioData.length; i++) {
      // Convert float32 to int16
      const s = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      index += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  /**
   * Get RMS (volume) of current recording for visualization
   */
  getRMS(): number {
    if (!this.analyserNode) return 0;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += (dataArray[i] / 255) ** 2;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      this.scriptNode.disconnect();
    }
    if (this.gainNode) this.gainNode.disconnect();
    if (this.analyserNode) this.analyserNode.disconnect();
    if (this.sourceNode) this.sourceNode.disconnect();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    this.audioChunks = [];
    this.isRecording = false;
  }
}

/**
 * Helper to request microphone with optimal constraints
 */
export async function requestMicrophone(
  config: Partial<AudioConfig> = {}
): Promise<MediaStream> {
  const fullConfig = { ...DEFAULT_AUDIO_CONFIG, ...config };
  const constraints = getAudioConstraints(fullConfig);

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    // Fallback to basic audio
    console.warn("Optimal constraints failed, using fallback:", error);
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (fallbackError) {
      throw new Error(`Microphone access denied: ${fallbackError}`);
    }
  }
}

/**
 * Format duration in mm:ss
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
