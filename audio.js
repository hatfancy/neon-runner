// ==========================================
// NEON RUNNER - AUDIO SYNTHESIZER ENGINE
// Web Audio API Procedural Synthwave & SFX
// ==========================================

class NeonAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.enabled = true;
        this.isPlayingMusic = false;
        
        // Synthwave music sequencing
        this.tempo = 124; // BPM
        this.step = 0;
        this.timer = null;
        
        // Bassline notes (Synthwave D-minor vibe: D, F, G, Bb, A, C)
        this.bassNotes = [
            73.42, 73.42, 73.42, 73.42,  // D2
            87.31, 87.31, 87.31, 87.31,  // F2
            98.00, 98.00, 98.00, 98.00,  // G2
            110.00, 110.00, 103.83, 98.00 // A2, Bb2, G2
        ];

        // Lead / Arp melody frequencies (Hz)
        this.leadNotes = [
            293.66, 349.23, 440.00, 523.25, // D4, F4, A4, C5
            392.00, 440.00, 523.25, 587.33, // G4, A4, C5, D5
            440.00, 523.25, 659.25, 698.46, // A4, C5, E5, F5
            587.33, 523.25, 440.00, 392.00  // D5, C5, A4, G4
        ];
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        this.musicGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.55, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
            }
        } else {
            this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
            }
            if (!this.isPlayingMusic) {
                this.startMusic();
            }
        }
        return this.enabled;
    }

    startMusic() {
        if (!this.enabled) return;
        this.init();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (this.isPlayingMusic) return;
        this.isPlayingMusic = true;

        const intervalMs = (60 / this.tempo / 4) * 1000; // 16th note interval
        this.step = 0;
        this.timer = setInterval(() => {
            if (!this.isPlayingMusic || !this.enabled) return;
            this.playMusicStep(this.step);
            this.step = (this.step + 1) % 32;
        }, intervalMs);
    }

    stopMusic() {
        this.isPlayingMusic = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    playMusicStep(step) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;

        // 1. Kick on beats 0, 4, 8, 12, 16, 20, 24, 28 (Four-on-the-floor synthwave pulse)
        if (step % 4 === 0) {
            this.triggerKick(t);
        }

        // 2. Snare / Clapped Noise on beats 4, 12, 20, 28
        if (step % 8 === 4) {
            this.triggerSnare(t);
        }

        // 3. Hi-hat on offbeat 16ths
        if (step % 2 === 1) {
            this.triggerHiHat(t, step % 4 === 2 ? 0.05 : 0.025);
        }

        // 4. Rolling Cyber Bass (plays every 16th note with groovy cutoff filter)
        const noteIdx = Math.floor(step / 2) % this.bassNotes.length;
        const freq = this.bassNotes[noteIdx];
        this.triggerBass(t, freq, step % 2 === 0 ? 1 : 0.6);

        // 5. Arpeggio / Synth Lead hook
        if (step % 2 === 0) {
            const leadFreq = this.leadNotes[(step / 2) % this.leadNotes.length];
            this.triggerLead(t, leadFreq);
        }
    }

    triggerKick(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(32, t + 0.12);

        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(t);
        osc.stop(t + 0.14);
    }

    triggerSnare(t) {
        // Noise buffer
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(t);
        noise.stop(t + 0.15);
    }

    triggerHiHat(t, volume) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(8000, t);

        gain.gain.setValueAtTime(volume * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(t);
        osc.stop(t + 0.045);
    }

    triggerBass(t, freq, velocity) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450 * velocity, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.1);

        gain.gain.setValueAtTime(0.35 * velocity, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(t);
        osc.stop(t + 0.13);
    }

    triggerLead(t, freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(t);
        osc.stop(t + 0.13);
    }

    // --- SOUND EFFECTS (SFX) ---
    playJump() {
        if (!this.enabled) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(620, t + 0.12);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.13);
    }

    playDoubleJump() {
        if (!this.enabled) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(950, t + 0.16);

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.17);
    }

    playShard() {
        if (!this.enabled) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(1760, t + 0.08);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.1);
    }

    playPowerup() {
        if (!this.enabled) return;
        this.init();
        const t = this.ctx.currentTime;
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startT = t + idx * 0.06;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startT);

            gain.gain.setValueAtTime(0.25, startT);
            gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.15);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(startT);
            osc.stop(startT + 0.16);
        });
    }

    playShieldBreak() {
        if (!this.enabled) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.26);
    }

    playHit() {
        if (!this.enabled) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);

        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.36);
    }

    playNearMiss() {
        if (!this.enabled) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.08);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.1);
    }
}

window.neonAudio = new NeonAudioEngine();
