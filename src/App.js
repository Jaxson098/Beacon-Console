
import { Beacon } from './lib/Beacon.js'
import { useState, useEffect, useRef } from 'react';
import Panel from './components/beaconPanel.js'
import CaptureFlag from "./components/CaptureFlag.js"
import WackMole from './components/WackMole.js';
import Altitude from './components/Altitude.js';

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
  const beacon_ids = useRef([null]) //must always end with a null
  const [gamemode, set_gamemode] = useState("CF")
  const [global_buffer, set_global_buffer] = useState([])
  const [beacon_panels, set_beacon_panels] = useState([])
  const [running, set_running] = useState(false)
  const [connecting, set_connecting] = useState(false)
  const [connect_msg, set_connect_msg] = useState("Connect Beacon")
  const [connecting_stack, set_connecting_stack] = useState([])

  useEffect(()=>{
    const beaconPanels = []
    for (const beacon of beacons) {
      beaconPanels.push(<Panel key={beacon.id} beacon={beacon} gamemode={gamemode} running={running}/>)
    }
    set_beacon_panels(beaconPanels)
  },[beacons, gamemode])

  async function closeAll() {
    set_beacon_panels([])
    beacon_ids.current=[null]
    for (const beacon of beacons) {
      await beacon.sendCmd("Disconnect")
      beacon.port.close()
    }
    set_beacons([])
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function handleConnect() {
    set_connecting(true)
    set_connect_msg("Select a Beacon")
    const port = await navigator.serial.requestPort({filters: [{ usbProductId: 29987, usbVendorId: 6790 }]}); // browser popup to pick the Arduino
    set_connect_msg("Connecting...")
    set_connecting(false)
    set_connect_msg("Connect Beacon")

    //if not open
    if (!port.readable && !port.writable) {

      set_connecting_stack(prev => [...prev, (<p className='text-xl text-gray-600 mt-3.5'>Connecting...</p>)])

      await port.open({ baudRate: 57600 })

      // Wait for Arduino bootloader
      await sleep(1750);

      //if not dissconected during timeout
      if (port.readable && port.writable) {

        const index = beacon_ids.current.indexOf(null);

        const beaconId = index + 1;
        beacon_ids.current[index] = beaconId;

        if (beacon_ids.current[beacon_ids.current.length - 1] !== null) {
          beacon_ids.current.push(null);
        }

        console.log("beaconId",beaconId)

        const beacon = new Beacon(port, beaconId, beacon_ids, set_beacons)

        beacon.startReading(set_global_buffer)

        beacon.update("v0.1.3",set_connect_msg).then(()=>{

          if (beacon.readingFlag == false) {beacon.startReading(set_global_buffer)}

          beacon.sendCmd("Stopped")

          if (gamemode == "CF") {beacon.sendCmd("Capture_Flag_Start_Blue")}
          else {beacon.sendCmd("Idle")}

          set_beacons(prev => [...prev, beacon]);
        })

      }
      set_connecting_stack(prev => {
        const copy = [...prev]
        copy.pop()
        return copy
      })

    }
  }

  return (
    <div className='w-screen h-screen'>
      <div className='flex items-center justify-between'>
        <button className={`bg-gray-200 w-1/3 border border-black transition-all ${gamemode === "CF" ? "bg-gray-400" : running ? "" : "hover:bg-gray-300" }`} disabled={gamemode === "CF" || running} onClick={()=>{
          set_gamemode("CF");
          for (const beacon of beacons) {
            if (beacon.CF_Start_Blue) {beacon.sendCmd("Capture_Flag_Start_Blue")}
            else {beacon.sendCmd("Capture_Flag_Start_Red")}
          }
        }}>Capture The Flag</button>
        <button className={`bg-gray-200 w-1/3 border border-black transition-all ${gamemode === "WM" ? "bg-gray-400" : running ? "" : "hover:bg-gray-300" }`} disabled={gamemode === "WM" || running} onClick={()=>{
          set_gamemode("WM");
          for (const beacon of beacons) {
            beacon.sendCmd("Idle")
          }
        }}>Wack-A-Mole</button>
        <button className={`bg-gray-200 w-1/3 border border-black transition-all ${gamemode === "A" ? "bg-gray-400" : running ? "" : "hover:bg-gray-300" }`} disabled={gamemode === "A" || running} onClick={()=>{
          set_gamemode("A");
          for (const beacon of beacons) {
            beacon.sendCmd("Idle")
          }
        }}>Altitude</button>
      </div>

      <div className='flex flex-col h-2/3 items-center justify-center border border-black mx-4 mt-5 mb-2'>
        {gamemode == "CF" ? (<CaptureFlag beacons={beacons} global_buffer={global_buffer} set_global_buffer={set_global_buffer} running={running} set_running={set_running}/>) :
        gamemode == "WM" ? (<WackMole beacons={beacons} global_buffer={global_buffer} set_global_buffer={set_global_buffer} running={running} set_running={set_running}/>) : 
        (<Altitude beacons={beacons} global_buffer={global_buffer} set_global_buffer={set_global_buffer} running={running} set_running={set_running}/>)}
      </div>

      <div className='px-4 flex flex-col'>

        <div className='grid grid-cols-3 mb-2'>
          <h2 className='text-lg font-bold justify-self-center'>{beacon_panels.length} Connected Beacons</h2>
          <button className={`border border-black px-2 rounded-md bg-gray-200 ${running ? "" : "hover:bg-gray-300"} transition-all justify-self-center`} onClick={handleConnect} disabled={connecting || running}>{connect_msg}</button>
          <button className={`border border-black px-2 rounded-md bg-gray-200 ${running ? "" : "hover:bg-gray-300"} transition-all justify-self-center`} onClick={closeAll} disabled={running}>Disconnect All</button>
        </div>

        <div className='flex flex-wrap gap-4'>
          {beacon_panels}
          {connecting_stack}
        </div>

      </div>

    </div>
  );
}

export default App;
