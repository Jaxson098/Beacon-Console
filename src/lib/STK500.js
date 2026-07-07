// ============================================================
// STK500 (v1) programmer for Arduino Uno/Nano, using WebSerial
// ============================================================
// This talks to the Arduino's BOOTLOADER (small program built into
// the chip's flash). The bootloader listens for a few seconds after
// reset, waiting for these exact byte sequences. If it hears them,
// it lets us read/write the flash memory instead of running the
// normal sketch.
//
// THE BASIC PATTERN FOR EVERY COMMAND:
//   1. We send: [commandByte, ...extraBytes, 0x20]
//      (0x20 = "end of packet" marker, always last byte)
//   2. Bootloader replies: [0x14, ...responseBytes, 0x10]
//      (0x14 = "I understood you" / 0x10 = "done, OK")
// If we don't get 0x14 then 0x10, something went wrong.

// These are just names for the raw command bytes, so the code
// below is readable instead of full of magic numbers.
const OK       = 0x10; // STK_OK        -> "command finished successfully"
const INSYNC   = 0x14; // STK_INSYNC    -> "I received your command"
const EOP      = 0x20; // CRC_EOP       -> "end of packet" marker we must send
const GET_SYNC = 0x30; // STK_GET_SYNC  -> "are you there?" (used to reset comms)
const ENTER_PM = 0x50; // STK_ENTER_PROGMODE -> "let me program you"
const LEAVE_PM = 0x51; // STK_LEAVE_PROGMODE -> "done, run my sketch now"
const LOAD_ADDR= 0x55; // STK_LOAD_ADDRESS   -> "next read/write goes here"
const PROG_PAGE= 0x64; // STK_PROG_PAGE      -> "write this chunk of flash"
const READ_SIGN= 0x75; // STK_READ_SIGN      -> "tell me what chip you are"

export class STK500 {
  constructor(port, writer, reader, uploading_buffer) {
    this.port = port; // the SerialPort object from navigator.serial.requestPort()
    this.leftover = new Uint8Array(0); // bytes we read but didn't use yet
    this.writer = writer
    this.reader = reader
    this.uploading_buffer = uploading_buffer
  }

  // Toggling DTR/RTS is how a USB-serial chip physically resets the
  // Arduino's reset pin. This is the same thing the Arduino IDE does
  // right before uploading — no button press needed.
  async resetArduino() {
    await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await new Promise(r => setTimeout(r, 100)); // hold reset briefly
    await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });
    await new Promise(r => setTimeout(r, 100)); // let bootloader boot up
  }

  // Low-level: read exactly `n` bytes back from the Arduino.
  // Serial data can arrive in small unpredictable chunks, so we
  // keep reading until we have as many bytes as we asked for.
  async readBytes(n) {
    const result = new Uint8Array(n);
    let received = 0;

    // use any leftover bytes from a previous read first
    if (this.leftover.length > 0) {
      const take = Math.min(this.leftover.length, n);
      result.set(this.leftover.slice(0, take), 0);
      this.leftover = this.leftover.slice(take);
      received += take;
    }

    while (received < n) {

      const { value } = await this.reader.read();

      if (!value || value == null) continue;

      const need = n - received;
      if (value.length > need) {
        // got more than we needed - use what fits, save the rest
        result.set(value.slice(0, need), received);
        this.leftover = value.slice(need);
        received += need;
      } else {
        result.set(value, received);
        received += value.length;
      }
    }

    return result;
  }

  // Sends one command and checks the standard OK/INSYNC reply pattern.
  // `payload`   = the command byte + any extra data bytes (as an array)
  // `replyLen`  = how many extra data bytes we expect back (0 if none)
  async sendCommand(payload, replyLen = 0) {
    // 1. Send our command, always ending in EOP (0x20)
    await this.writer.write(new Uint8Array([...payload, EOP]));

    // 2. First byte back must be INSYNC, or something's desynced
    const sync = await this.readBytes(1);
    if (sync[0] !== INSYNC) throw new Error("Bootloader didn't sync");

    // 3. Read any actual data the coreadBytesmmand returns (e.g. signature bytes)
    const data = replyLen > 0 ? await this.readBytes(replyLen) : new Uint8Array(0);

    // 4. Last byte must be OK, confirming the command finished
    const ok = await this.readBytes(1);
    if (ok[0] !== OK) throw new Error("Bootloader didn't confirm OK");

    return data;
  }

  // Ping the bootloader until it responds. Needed right after reset,
  // since there's a small window where it's not listening yet.
  async sync(tries = 10) {
    for (let i = 0; i < tries; i++) {
      try {
        console.log('synced on try', i);
        await this.sendCommand([GET_SYNC]);
        return; // success!
      } catch (err) {
        console.log('sync attempt', i, 'failed:', err.message);
        // ignore and try again
      }
    }
    throw new Error("Could not sync with bootloader");
  }

  async enterProgrammingMode() {
    await this.sendCommand([ENTER_PM]);
  }

  async leaveProgrammingMode() {
    await this.sendCommand([LEAVE_PM]); // bootloader will now boot the sketch
  }

  // Returns 3 bytes identifying the chip, e.g. [0x1E, 0x95, 0x0F] = ATmega328P
  async readSignature() {
    return await this.sendCommand([READ_SIGN], 3);
  }

  // Tell the bootloader where in flash the next page read/write happens.
  // Note: this is a WORD address (byte address divided by 2), sent as
  // two bytes, low byte first.
  async setAddress(byteAddress) {
    const wordAddr = byteAddress / 2;
    const lowByte  = wordAddr & 0xff;
    const highByte = (wordAddr >> 8) & 0xff;
    await this.sendCommand([LOAD_ADDR, lowByte, highByte]);
  }

  // Writes one page of flash (must match the chip's page size,
  // e.g. 128 bytes for an ATmega328P). Call setAddress() first.
  async writePage(bytes) {
    const lengthHigh = (bytes.length >> 8) & 0xff;
    const lengthLow  = bytes.length & 0xff;
    const FLASH = 'F'.charCodeAt(0); // 'F' = flash memory, 'E' = eeprom
    await this.sendCommand([PROG_PAGE, lengthHigh, lengthLow, FLASH, ...bytes]);
  }
}

// ============================================================
// Turn a .hex file into 128-byte pages, as simply as possible
// ============================================================

// STEP 1: Read the .hex text and pull out just the raw data bytes.
// We're ignoring addresses/checksums entirely — for a normal small
// sketch on a Nano, the data just comes in order, one line after
// another, so we can just concatenate it all together.
export function hexToBytes(hexText) {
  const bytes = [];

  const lines = hexText.split('\n');

  for (const line of lines) {
    if (!line.startsWith(':')) continue;      // skip blank/bad lines
    const byteCount = parseInt(line.substr(1, 2), 16); // how many data bytes on this line
    const type = parseInt(line.substr(7, 2), 16);      // 00 = data line, anything else = skip

    if (type !== 0x00) continue; // only care about actual data lines

    // Data bytes start at character 9, two hex chars each
    for (let i = 0; i < byteCount; i++) {
      const byteHex = line.substr(9 + i * 2, 2);
      bytes.push(parseInt(byteHex, 16));
    }
  }

  return bytes; // plain array of numbers, e.g. [12, 148, 52, 0, ...]
}

// STEP 2: Chop that array into 128-byte chunks (the page size
// for the ATmega328P used in a Nano).
export function splitIntoPages(bytes, pageSize = 128) {
  const pages = [];

  for (let i = 0; i < bytes.length; i += pageSize) {
    let page = bytes.slice(i, i + pageSize);

    // pad the last page with 0xFF if it's short
    while (page.length < pageSize) page.push(0xFF);

    pages.push(page);
  }

  return pages;
}

// ------------------------------------------------------------
// USE IT
// ------------------------------------------------------------
// const bytes = hexToBytes(hexFileText);
// const pages = splitIntoPages(bytes);
//
// for (let i = 0; i < pages.length; i++) {
//   const address = i * 128;
//   await stk.setAddress(address);
//   await stk.writePage(new Uint8Array(pages[i]));
// }

// ------------------------------------------------------------
// EXAMPLE: full upload flow for a small block of flash data
// ------------------------------------------------------------
// async function main() {
//   const port = await navigator.serial.requestPort(); // browser popup to pick the Arduino
//   const stk = new STK500(port);
//
//   await stk.open(115200);
//   await stk.resetArduino();          // force it into the bootloader
//   await stk.sync();                  // make sure it's listening
//   await stk.enterProgrammingMode();  // start a programming session
//
//   const sig = await stk.readSignature();
//   console.log("Chip signature:", [...sig].map(b => b.toString(16)));
//
//   // Write one 128-byte page starting at flash address 0
//   const pageSize = 128;
//   const someData = new Uint8Array(pageSize).fill(0xFF); // replace with real firmware bytes
//   await stk.setAddress(0);
//   await stk.writePage(someData);
//   // repeat setAddress()+writePage() for each page, advancing by pageSize each time
//
//   await stk.leaveProgrammingMode(); // Arduino will now run the new sketch
//   await stk.close();
// }