
onmessage = async ({data}) => postMessage(await play(data[0], data[1]));

const play = async (buf: Int16Array, sampleRate: number) => {
    const newBuf = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

    // specify your file and its audio properties
    const numChannels = 1 // mono or stereo
    const isFloat = false  // integer or floating point


    // create WAV header
    const [type, format] = isFloat ? [Float32Array, 3] : [Uint8Array, 1] 
    const wavHeader = new Uint8Array(buildWaveHeader({
      numFrames: newBuf.byteLength / type.BYTES_PER_ELEMENT,
      bytesPerSample: type.BYTES_PER_ELEMENT * 2,
      sampleRate: sampleRate,
      numChannels,
      format
    }))

    // create WAV file with header and downloaded PCM audio
    const wavBytes = new Uint8Array(wavHeader.length + newBuf.byteLength)
    wavBytes.set(wavHeader, 0)
    wavBytes.set(new Uint8Array(newBuf), wavHeader.length)

    return wavBytes
}

// adapted from https://gist.github.com/also/900023
function buildWaveHeader(opts: any) {
    const numFrames =      opts.numFrames;
    const numChannels =    opts.numChannels || 2;
    const sampleRate =     opts.sampleRate || 44100;
    const bytesPerSample = opts.bytesPerSample || 2;
    const format =         opts.format
  
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numFrames * blockAlign;
  
    const buffer = new ArrayBuffer(44);
    const dv = new DataView(buffer);
  
    let p = 0;
  
    function writeString(s: any) {
      for (let i = 0; i < s.length; i++) {
        dv.setUint8(p + i, s.charCodeAt(i));
      }
      p += s.length;
  }
  
    function writeUint32(d: any) {
      dv.setUint32(p, d, true);
      p += 4;
    }
  
    function writeUint16(d: any) {
      dv.setUint16(p, d, true);
      p += 2;
    }
  
    writeString('RIFF');              // ChunkID
    writeUint32(dataSize + 36);       // ChunkSize
    writeString('WAVE');              // Format
    writeString('fmt ');              // Subchunk1ID
    writeUint32(16);                  // Subchunk1Size
    writeUint16(format);              // AudioFormat
    writeUint16(numChannels);         // NumChannels
    writeUint32(sampleRate);          // SampleRate
    writeUint32(byteRate);            // ByteRate
    writeUint16(blockAlign);          // BlockAlign
    writeUint16(bytesPerSample * 8);  // BitsPerSample
    writeString('data');              // Subchunk2ID
    writeUint32(dataSize);            // Subchunk2Size
  
    return buffer;
  }


export default {
    play
}