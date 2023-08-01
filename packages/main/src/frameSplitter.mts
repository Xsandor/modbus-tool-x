import { crc16modbus } from 'crc';

// function formatByteArray(byteArray: Buffer) {
//   const string = byteArray.reduce((string, byte) => {
//     string += byte.toString(16).padStart(2, '0')  
//     string += " "
//     return string
//   }, '')

//   return string
// }

export function splitFrame(buffer: Buffer) {
  // console.log('Will look for frames in this buffer')
  // console.log(formatByteArray(buffer))
  const frames: Buffer[] = [];
  let offset = 0;

  while (offset < buffer.length - 1) {
    // console.log('Looking for a frame')
    // console.log('Offset', offset)
    // console.log('Total Buffer size', buffer.length)
    let foundFrame = false;
    const remainingFrameSize = buffer.length - offset;
    // console.log('Remaining buffer size', remainingFrameSize)
    for (let frameSize = remainingFrameSize; frameSize >= 3; frameSize--) {
      // console.log('Checking frame size', frameSize)
      const frame = buffer.slice(offset, offset + frameSize);
      // console.log(formatByteArray(frame))
      const crcIn = frame.readUInt16LE(frame.length - 2);
      // console.log(crcIn)
      const crcCalc = crc16modbus(frame.slice(0, - 2));
      // console.log(crcCalc)
      const crcOK = crcIn === crcCalc;
      if (crcOK) {
        // console.log('Found a working frame!')
        // console.log(formatByteArray(frame))
        frames.push(frame);
        offset += frameSize;
        foundFrame = true;
        break;
      }
    }
    if (!foundFrame) {
      // console.log('Did not find any working frame, aborting')
      break;
    }
  }

  // console.log('Found these frames:')
  // console.log(frames)
  return frames;
}

// const testFrame = Buffer.from([0x04,0x41,0x04,0x00,0x00,0x00,0x01,0x61,0xd1,0x04,0x03,0x13,0x89,0x00,0x01,0x51,0x31])

// splitFrame(testFrame)