let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

function tone(
  frequency: number,
  duration: number,
  volume: number,
  delay = 0,
  type: OscillatorType = 'sine',
): void {
  const context = getAudioContext();
  if (!context || volume <= 0) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playMove(merged: boolean, volume: number): void {
  if (merged) {
    tone(392, 0.09, volume * 0.32, 0, 'triangle');
    tone(523.25, 0.11, volume * 0.24, 0.035, 'sine');
  } else {
    tone(220, 0.045, volume * 0.12, 0, 'sine');
  }
}

export function playWin(volume: number): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    tone(frequency, 0.3, volume * 0.25, index * 0.09, 'triangle');
  });
}

export function playGameOver(volume: number): void {
  [392, 329.63, 261.63].forEach((frequency, index) => {
    tone(frequency, 0.22, volume * 0.22, index * 0.1, 'sine');
  });
}
