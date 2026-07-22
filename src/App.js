
import { Beacon } from './lib/Beacon.js'
import { useState, useEffect, useRef } from 'react';
import Panel from './components/beaconPanel.js'
import CaptureFlag from "./components/CaptureFlag.js"
import WackMole from './components/WackMole.js';
import Altitude from './components/Altitude.js';

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
  const [help_open, set_help_open] = useState(true)

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

        beacon.update("v0.1.3",set_connecting_stack).then(async ()=>{

          if (beacon.readingFlag == false) {beacon.startReading(set_global_buffer)}

          beacon.sendCmd("Stopped")

          if (gamemode == "CF") {beacon.sendCmd("Capture_Flag_Start_Blue")}
          else {beacon.sendCmd("Idle")}

          set_beacons(prev => [...prev, beacon]);

          set_connecting_stack(prev => {
            const copy = [...prev]
            copy.pop()
            return copy
          })

        })

      } else {
        set_connecting_stack(prev => {
          const copy = [...prev]
          copy.pop()
          return copy
        })
      }
    }
  }

  return (
    <div className='flex flex-col w-screen h-screen'>
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

      <button onClick={()=>{set_help_open(!help_open)}} className='mt-1 ml-auto mr-5 underline'>{help_open ? ">" : "<"} Help</button>

      <div className='flex h-2/3 w-full'>
        <div className={`flex flex-1 items-center justify-center border border-black ${help_open ? "ml-5 mr-2.5" : "mx-5"} mt-1 mb-2.5 overflow-scroll`}>
          {gamemode == "CF" ? (<CaptureFlag beacons={beacons} global_buffer={global_buffer} set_global_buffer={set_global_buffer} running={running} set_running={set_running}/>) :
          gamemode == "WM" ? (<WackMole beacons={beacons} global_buffer={global_buffer} set_global_buffer={set_global_buffer} running={running} set_running={set_running}/>) : 
          (<Altitude beacons={beacons} global_buffer={global_buffer} set_global_buffer={set_global_buffer} running={running} set_running={set_running}/>)}
        </div>

          {help_open && (
            <div className='flex w-[calc(33.333333%-30px)] ml-2.5 mr-5 mt-1 mb-2.5 border border-black px-5 py-2.5 overflow-scroll'>
              {gamemode == "CF" ? (CF_help_html) :
              gamemode == "WM" ? (WM_help_html) : 
              (A_help_html)}
            </div>
          )}

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

const CF_help_html = (
  <div className='flex flex-col gap-1'>
    <h2 className='font-bold'>General Usage</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Use the topbar to select the gamemode you wish to play</li>
      <li>Click "<span className='font-bold'>Connect Beacon</span>" and select a serial port from the popup menu - the newest firmware will automatically be uploaded</li>
      <li>ensure the <a href='https://www.dronesinschool.com/product/Capture-the-Flag-Beacon' className='underline'>Beacon</a> is connected via a <a href='https://www.amazon.com/Amazon-Basics-Charging-Transfer-Gold-Plated/dp/B00NH11N5A?th=1' className='underline'>data and power Mini USB cable</a> - the one it came with will not work. You will probably need to use a <a href='https://www.amazon.com/AmazonBasics-USB-10-Port-Adapter-Black/dp/B07V6MXF3C?th=1&psc=1' className='underline'>powered USB hub</a></li>
      <li>Once connected, "<span className='font-bold'>Blink</span>" the Beacon to identify it - it will blink <span className='bg-purple-500 px-1'>Purple</span> - and change settings if applicable</li>
      <li>Set the game length in a [minutes] : [seconds] format</li>
      <li>When finished click "<span className='font-bold'>Disconnect All</span>" to return all Beacons to default behavior (Capture Flag). Otherwise they will have powered on and off</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Capture The Flag</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Use <span className='font-bold'>Blink</span> to identify Beacons, and set half of them to <span className='font-bold'>Start Blue</span> and the other half to <span className='font-bold'>Start Red</span></li>
      <li>Once started, two teams try and set all Beacons to their color, either <span className='bg-red-500 px-1'>Red</span> or <span className='bg-blue-500 px-1'>Blue</span></li>
      <li>changing the Color of a beacon by flying over it at an altitude of 8 inches or less scores 1 point. This continues until the time is up.</li>
      <li>After the game is over, Beacons will remain the same color unless <span className='font-bold'>Reset Field</span> or <span className='font-bold'>Start</span> is clicked</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Wack-A-Mole</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Once started, 1 or more drones try to trigger the Beacon with the color <span className='bg-lime-500 px-1'>Green</span> as fast as possible by flying over it.</li>
      <li>Doing so will score 1 point and cause a different Beacon to turn green</li>
      <li>The drone(s) will now have to trigger this new Beacon. This continues until the time is up.</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Altitude</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Once started, 1 or more drones try to trigger all Beacons as fast as possible by flying over them at the correct altitude as designated by the Beacons color.</li>
      <li><span className='bg-yellow-300 px-1'>Yellow</span> indicates an altitude of 6 inches or less, <span className='bg-orange-400 px-1'>Orange</span> indicates an altitude of 6-12 inches, and <span className='bg-red-500 px-1'>Red</span> indicates an altitude of 18 inches or more.</li>
      <li>Successfully triggering a Beacon results in 1 point, once all Beacons are triggered they are assigned a new random height and must be triggered again. This continues until the time is up.</li>
    </ul>
  </div>
)

const WM_help_html = (
  <div className='flex flex-col gap-1'>
    <h2 className='font-bold'>General Usage</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Use the topbar to select the gamemode you wish to play</li>
      <li>Click "<span className='font-bold'>Connect Beacon</span>" and select a serial port from the popup menu - the newest firmware will automatically be uploaded</li>
      <li>ensure the <a href='https://www.dronesinschool.com/product/Capture-the-Flag-Beacon' className='underline'>Beacon</a> is connected via a <a href='https://www.amazon.com/Amazon-Basics-Charging-Transfer-Gold-Plated/dp/B00NH11N5A?th=1' className='underline'>data and power Mini USB cable</a> - the one it came with will not work. You will probably need to use a <a href='https://www.amazon.com/AmazonBasics-USB-10-Port-Adapter-Black/dp/B07V6MXF3C?th=1&psc=1' className='underline'>powered USB hub</a></li>
      <li>Once connected, "<span className='font-bold'>Blink</span>" the Beacon to identify it - it will blink <span className='bg-purple-500 px-1'>Purple</span> - and change settings if applicable</li>
      <li>Set the game length in a [minutes] : [seconds] format</li>
      <li>When finished click "<span className='font-bold'>Disconnect All</span>" to return all Beacons to default behavior (Capture Flag). Otherwise they will have powered on and off</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Wack-A-Mole</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Once started, 1 or more drones try to trigger the Beacon with the color <span className='bg-lime-500 px-1'>Green</span> as fast as possible by flying over it.</li>
      <li>Doing so will score 1 point and cause a different Beacon to turn green</li>
      <li>The drone(s) will now have to trigger this new Beacon. This continues until the time is up.</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Capture The Flag</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Use <span className='font-bold'>Blink</span> to identify Beacons, and set half of them to <span className='font-bold'>Start Blue</span> and the other half to <span className='font-bold'>Start Red</span></li>
      <li>Once started, two teams try and set all Beacons to their color, either <span className='bg-red-500 px-1'>Red</span> or <span className='bg-blue-500 px-1'>Blue</span></li>
      <li>changing the Color of a beacon by flying over it at an altitude of 8 inches or less scores 1 point. This continues until the time is up.</li>
      <li>After the game is over, Beacons will remain the same color unless <span className='font-bold'>Reset Field</span> or <span className='font-bold'>Start</span> is clicked</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Altitude</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Once started, 1 or more drones try to trigger all Beacons as fast as possible by flying over them at the correct altitude as designated by the Beacons color.</li>
      <li><span className='bg-yellow-300 px-1'>Yellow</span> indicates an altitude of 6 inches or less, <span className='bg-orange-400 px-1'>Orange</span> indicates an altitude of 6-12 inches, and <span className='bg-red-500 px-1'>Red</span> indicates an altitude of 18 inches or more.</li>
      <li>Successfully triggering a Beacon results in 1 point, once all Beacons are triggered they are assigned a new random height and must be triggered again. This continues until the time is up.</li>
    </ul>
  </div>
)

const A_help_html = (
  <div className='flex flex-col gap-1'>
    <h2 className='font-bold'>General Usage</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Use the topbar to select the gamemode you wish to play</li>
      <li>Click "<span className='font-bold'>Connect Beacon</span>" and select a serial port from the popup menu - the newest firmware will automatically be uploaded</li>
      <li>ensure the <a href='https://www.dronesinschool.com/product/Capture-the-Flag-Beacon' className='underline'>Beacon</a> is connected via a <a href='https://www.amazon.com/Amazon-Basics-Charging-Transfer-Gold-Plated/dp/B00NH11N5A?th=1' className='underline'>data and power Mini USB cable</a> - the one it came with will not work. You will probably need to use a <a href='https://www.amazon.com/AmazonBasics-USB-10-Port-Adapter-Black/dp/B07V6MXF3C?th=1&psc=1' className='underline'>powered USB hub</a></li>
      <li>Once connected, "<span className='font-bold'>Blink</span>" the Beacon to identify it - it will blink <span className='bg-purple-500 px-1'>Purple</span> - and change settings if applicable</li>
      <li>Set the game length in a [minutes] : [seconds] format</li>
      <li>When finished click "<span className='font-bold'>Disconnect All</span>" to return all Beacons to default behavior (Capture Flag). Otherwise they will have powered on and off</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Altitude</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Once started, 1 or more drones try to trigger all Beacons as fast as possible by flying over them at the correct altitude as designated by the Beacons color.</li>
      <li><span className='bg-yellow-300 px-1'>Yellow</span> indicates an altitude of 6 inches or less, <span className='bg-orange-400 px-1'>Orange</span> indicates an altitude of 6-12 inches, and <span className='bg-red-500 px-1'>Red</span> indicates an altitude of 18 inches or more.</li>
      <li>Successfully triggering a Beacon results in 1 point, once all Beacons are triggered they are assigned a new random height and must be triggered again. This continues until the time is up.</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Capture The Flag</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Use <span className='font-bold'>Blink</span> to identify Beacons, and set half of them to <span className='font-bold'>Start Blue</span> and the other half to <span className='font-bold'>Start Red</span></li>
      <li>Once started, two teams try and set all Beacons to their color, either <span className='bg-red-500 px-1'>Red</span> or <span className='bg-blue-500 px-1'>Blue</span></li>
      <li>changing the Color of a beacon by flying over it at an altitude of 8 inches or less scores 1 point. This continues until the time is up.</li>
      <li>After the game is over, Beacons will remain the same color unless <span className='font-bold'>Reset Field</span> or <span className='font-bold'>Start</span> is clicked</li>
    </ul>

    <h2 className='font-bold mt-4'>Gamemode: Wack-A-Mole</h2>
    <ul className='text-xs 2xl:text-sm flex flex-col gap-1 list-disc ml-5'>
      <li>Once started, 1 or more drones try to trigger the Beacon with the color <span className='bg-lime-500 px-1'>Green</span> as fast as possible by flying over it.</li>
      <li>Doing so will score 1 point and cause a different Beacon to turn green</li>
      <li>The drone(s) will now have to trigger this new Beacon. This continues until the time is up.</li>
    </ul>
  </div>
)