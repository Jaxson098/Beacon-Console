
import { Beacon } from './lib/Beacon.js'
import { useState, useEffect, use } from 'react';
import Panel from './components/beaconPanel.js'
import CaptureFlag from "./components/CaptureFlag.js"
import WackMole from './components/WackMole.js';

// if (gamemode === "CF") {
//   beacon.sendCmd("GM_Capture_Flag")
// } else if (gamemode === "WM") {
//   beacon.sendCmd("GM_Wack_A_Mole")
// } else if (gamemode === "M") {
//   beacon.sendCmd("GM_Memory")
// } else if (gamemode === "A") {
//   beacon.sendCmd("GM_Altitude")
// }

function App() {

  const [beacons, set_beacons] = useState([])
  const [beacon_ids, set_beacon_ids] = useState([null]) //must always end with a null
  const [gamemode, set_gamemode] = useState("CF")
  const [global_buffer, set_global_buffer] = useState([])
  const [beacon_panels, set_beacon_panels] = useState([])
  const [running, set_running] = useState(false)
  const [connecting, set_connecting] = useState(false)
  const [connect_msg, set_connect_msg] = useState("Connect Beacon")

  useEffect(()=>{
    const beaconPanels = []
    for (const beacon of beacons) {
      beaconPanels.push(<Panel key={beacon.id} beacon={beacon} gamemode={gamemode}/>)
    }
    set_beacon_panels(beaconPanels)
  },[beacons, gamemode])

  async function closeAll() {
    set_beacon_panels([])
    set_beacon_ids([null])
    for (const beacon of beacons) {
      await beacon.sendCmd("Disconnect")
      beacon.port.close()
    }
    set_beacons([])
  }

  async function handleConnect() {
    set_connecting(true)
    set_connect_msg("Connecting...")
    const port = await navigator.serial.requestPort({filters: [{ usbProductId: 29987, usbVendorId: 6790 }]}); // browser popup to pick the Arduino

    if (!port.readable && !port.writable) {
      //if not open
      await port.open({ baudRate: 57600 })
      setTimeout(() => {

        //if dissconected during timeout
        if (port.readable && port.writable) {

          //set the first null to an id
          let modified_beacon_ids = beacon_ids;
          const first_null_index = modified_beacon_ids.indexOf(null)
          modified_beacon_ids[first_null_index] = first_null_index + 1;

          //if no null at the end then add one
          if (modified_beacon_ids[modified_beacon_ids.length-1] != null) {
            modified_beacon_ids.push(null)
          }

          set_beacon_ids(modified_beacon_ids)

          const beacon = new Beacon(port, first_null_index + 1, set_beacon_ids, set_beacons)

          beacon.startReading(set_global_buffer)

          beacon.update("v0.1.1",set_connect_msg).then(()=>{
            if (beacon.readingFlag == false) {beacon.startReading(set_global_buffer)}
            beacon.sendCmd("Stopped")
            if (gamemode == "CF") {beacon.sendCmd("Capture_Flag_Start_Blue")}
            else {beacon.sendCmd("Idle")}
            set_beacons([...beacons, beacon])
            set_connect_msg("Connect Beacon")
            set_connecting(false)
          })

        }

      },1750) //1.5 second boot + a little overhead
    } else {
      set_connect_msg("Connect Beacon")
      set_connecting(false)
    }
  }

  return (
    <div className='w-screen h-screen'>
      <div className='flex items-center justify-between'>
        <button className={`bg-gray-200 w-1/4 border border-black transition-all ${gamemode === "CF" ? "bg-gray-400" : running ? "" : "hover:bg-gray-300" }`} disabled={gamemode === "CF" || running} onClick={()=>{
          set_gamemode("CF");
          for (const beacon of beacons) {
            if (beacon.CF_Start_Blue) {beacon.sendCmd("Capture_Flag_Start_Blue")}
            else {beacon.sendCmd("Capture_Flag_Start_Red")}
          }
        }}>Capture The Flag</button>
        <button className={`bg-gray-200 w-1/4 border border-black transition-all ${gamemode === "WM" ? "bg-gray-400" : running ? "" : "hover:bg-gray-300" }`} disabled={gamemode === "WM" || running} onClick={()=>{
          set_gamemode("WM");
          for (const beacon of beacons) {
            beacon.sendCmd("Idle")
          }
        }}>Wack-A-Mole</button>
        <button className={`bg-gray-200 w-1/4 border border-black transition-all ${gamemode === "M" ? "bg-gray-400" : running ? "" : "hover:bg-gray-300" }`} disabled={gamemode === "M" || running} onClick={()=>{
          set_gamemode("M");
          for (const beacon of beacons) {
            beacon.sendCmd("Idle")
          }
        }}>Memory</button>
        <button className={`bg-gray-200 w-1/4 border border-black transition-all ${gamemode === "A" ? "bg-gray-400" : running ? "" : "hover:bg-gray-300" }`} disabled={gamemode === "A" || running} onClick={()=>{
          set_gamemode("A");
          for (const beacon of beacons) {
            beacon.sendCmd("Idle")
          }
        }}>Altitude</button>
      </div>

      <div className='flex flex-col h-2/3 items-center justify-center border border-black mx-4 mt-5 mb-2'>
        {gamemode == "CF" ? (<CaptureFlag beacons={beacons} global_buffer={global_buffer} set_global_buffer={set_global_buffer} running={running} set_running={set_running}/>) :
        gamemode == "WM" ? (<WackMole beacons={beacons} global_buffer={global_buffer} set_global_buffer={set_global_buffer} running={running} set_running={set_running}/>) : (<p>Coming Soon</p>)}
      </div>

      <div className='px-4 flex flex-col'>

        <div className='grid grid-cols-3 mb-2'>
          <h2 className='text-lg font-bold justify-self-center'>{beacon_panels.length} Connected Beacons</h2>
          <button className={`border border-black px-2 rounded-md bg-gray-200 ${running ? "" : "hover:bg-gray-300"} transition-all justify-self-center`} onClick={handleConnect} disabled={connecting || running}>{connect_msg}</button>
          <button className={`border border-black px-2 rounded-md bg-gray-200 ${running ? "" : "hover:bg-gray-300"} transition-all justify-self-center`} onClick={closeAll} disabled={running}>Disconnect All</button>
        </div>

        <div className='flex flex-wrap gap-4'>
          {beacon_panels}
        </div>

      </div>

    </div>
  );
}

export default App;
