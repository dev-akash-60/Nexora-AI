class NexoraAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.buffer = [];
        this.targetSamples = 2048;
        this.sampleCount = 0;
    }

    process(inputs) {
        const input = inputs[0]?.[0];

        if (!input) {
            return true;
        }

        for (let i = 0; i < input.length; i++) {
            this.buffer.push(input[i]);
            this.sampleCount++;
        }

        while (this.sampleCount >= this.targetSamples) {
            const samples = this.buffer.splice(0, this.targetSamples);
            const pcm = new Int16Array(samples.length);

            for (let i = 0; i < samples.length; i++) {
                const value = Math.max(-1, Math.min(1, samples[i]));

                pcm[i] =
                    value < 0
                        ? Math.round(value * 32768)
                        : Math.round(value * 32767);
            }

            this.port.postMessage(pcm.buffer, [pcm.buffer]);
            this.sampleCount -= samples.length;
        }

        return true;
    }
}

registerProcessor("nexora-audio-processor", NexoraAudioProcessor);