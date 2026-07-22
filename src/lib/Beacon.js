import { hexToBytes, splitIntoPages, STK500 } from './STK500.js'

const decoder = new TextDecoder()
const encoder = new TextEncoder()

export class Beacon {
    /**
     * A utility class for interacting with a Beacon
     * 
     * @param {object} port a SerialPort object (https://developer.mozilla.org/en-US/docs/Web/API/SerialPort)
     * @param {int} id an id which will be displayed as `Beacon ${id}`, no other purpose
     * @param {Function} set_beacon_ids function to set beacon_ids (useState)
     * @param {object} beacon_ids a useRef with a array of beacon ids (useRef)
     */
    constructor(port, id, beacon_ids, set_beacons) {

        this.port = port;
        this.readingFlag = false;
        this.writer = port.writable.getWriter();
        this.reader = port.readable.getReader();

        this.internal_buffer = [];

        this.uploading = false;
        this.uploading_buffer = { value: null };

        this.CF_Start_Blue = true;
        this.Blinking = false;
        this.id = id;

        this.port.addEventListener("disconnect", (event) => {
            console.log("dissconnect")
            //remove from beacons
            set_beacons(prev => prev.filter(b => b.id !== this.id))

            //set this id in beacon ids to null - will be reused
            beacon_ids.current[this.id-1] = null

        });
    }

    /**
    * Returns true if the Beacon is on the specified firmware version
    * 
    * @param {string} version the version of the Beacon (i.e "0.1.0")
    */
    async checkVersion(version) {
        await this.sendCmd("Get_Version")
        const startTime = performance.now()
        while (performance.now() - startTime < 500) {
            for (const i of this.internal_buffer) {
                if (i.trim() === version) {
                    //remove it
                    this.internal_buffer = this.internal_buffer.filter(item => item !== i)
                    return true
                }
            }
            //yield to main loop
            await new Promise(resolve => setTimeout(resolve, 10))
        }
        return false
    }

    /**
     * Sends the "Blink" command to the beacon, which will cause it to blink
     */
    async blink() {
        await this.sendCmd("Blink")
    }

    /**
    * Checks the current version of the Beacon and updates it to the newest firmware version
    * 
    * @param {string} version The newest firmware version (i.e "0.1.0")
    * @param {Function} set_connecting_stack A useState function to show the update progress
    */
    async update(version, set_connecting_stack) {
        // set_connect_msg("Checking Firmware Version...")
        if (await this.checkVersion(version)) {
            return
        } else {

            set_connecting_stack(prev => {
                const copy = [...prev]
                copy.pop()
                copy.push((<p className='text-xl text-gray-600 mt-3.5'>Uploading Firmware {version}</p>))
                return copy
            })

            // set_connect_msg("Uploading Firmware " + version + "...")
            this.readingFlag = false
            await this.writer.close()
            await this.reader.cancel()
            this.writer = this.port.writable.getWriter();
            this.reader = this.port.readable.getReader();
            try {

                const stk = new STK500(this.port, this.writer, this.reader, this.uploading_buffer);
                    
                await stk.resetArduino();          // force it into the bootloader
                await stk.sync();                  // make sure it's listening
                await stk.enterProgrammingMode();  // start a programming session
            
                const response = await fetch('https://jaxson098.github.io/Beacon-Console/Beacon.hex');
                const hexFileText = await response.text();
                const bytes = hexToBytes(hexFileText);
                const pages = splitIntoPages(bytes);
                    
                for (let i = 0; i < pages.length; i++) {
                    const address = i * 128;
                    await stk.setAddress(address);
                    await stk.writePage(new Uint8Array(pages[i]));
                }
            
                await stk.leaveProgrammingMode(); // Arduino will now run the new sketch
                await new Promise(resolve => setTimeout(resolve, 1500)); //wait to boot again
                return
            } catch (err) {
                console.log("uploading err:")
                console.log(err)
            }
        }
    }

    /**
    * Begins a reading loop that will update the supplied buffer and an internal buffer as new lines are read
    * 
    * To stop the loop use stopReading()
    * 
    * @param {Function} set_global_buffer A method to set the global buffer
    */
    async startReading(set_global_buffer) {
        this.readingFlag = true
        let buffer = ""
        while (this.readingFlag) {
            const value = await this.read()

            if (value === undefined) {
                console.log("reading cancled")
                return
            }

            buffer += decoder.decode(value)
            if (buffer[buffer.length - 1] === "\n") {
                const line = buffer
                this.internal_buffer.push(line)
                if (line[0] !== "v") {
                    // console.log(line)
                    set_global_buffer(prev => {
                        return [...prev, line];
                    });
                }
                buffer = ""
            }

        }
    }

    /**
     * Stops the reading loop started by startReading()
     */
    stopReading() {
        this.readingFlag = false;
    }

    /**
     * Reads via this.reader.read() with error handling
     * 
     * @returns the value recieved from this.reader.read
     */
    async read() {
        try {
            const { value } = await this.reader.read()
            return value
        } catch(err) {
            console.log("reading err:")
            console.log(err)
        }
    }

    /**
     * Sends the supplied command to the Beacon
     * 
     * @param {string} command The command to send to the Beacon, do not include a newline
     */
    async sendCmd(command) {
        try {
            await this.writer.write(encoder.encode(command + "\n"))
        } catch(err) {
            console.log("writing err:")
            console.log(err)
        }
    }
}