import { useEffect, useState } from "react"

export default function Panel(params) {
    
    const [ blinking, set_blinking ] = useState(false)
    const [ blink_bg, set_blink_bg] = useState("bg-gray-200 hover:bg-gray-300")
    const [ last_blinked, set_last_blinked] = useState(0)


    useEffect(() => {
        if (!blinking) {set_blink_bg("bg-gray-200 hover:bg-gray-300"); return}

        const interval = setInterval(() => {
            set_blink_bg(prev =>
                prev === "bg-purple-300 hover:bg-purple-400"
                ? "bg-gray-200 hover:bg-gray-300"
                : "bg-purple-300 hover:bg-purple-400"
            )
        }, 500)

        return () => clearInterval(interval)
    }, [blinking])

    return (
        <div className="flex flex-col items-start px-2 py-1 rounded-lg w-fit bg-gray-100 border border-black">
            <h3 className="text-base lg:text-xl">Beacon {params.beacon.id}</h3>
            <div className="flex gap-2">
                <button className={`text-sm lg:text-base border border-black px-2 rounded-md ${blink_bg} transition-all`} onClick={()=>{
                    if (blinking == false) {params.beacon.sendCmd("Start_Blink"); set_blinking(true)}
                    else if (blinking == true) {params.beacon.sendCmd("Stop_Blink"); set_blinking(false)}
                }}>{blinking ? "Blinking" : "Blink"}</button>

                <select disabled={params.running} className={`text-sm lg:text-base border border-black px-2 rounded-md bg-gray-200 ${params.running ? "" : "hover:bg-gray-300"} transition-all ${params.gamemode == "CF" ? "" : "hidden"}`} onChange={(event)=>{
                    if (event.target.value == "blue") {
                        params.beacon.sendCmd("Capture_Flag_Start_Blue")
                        params.beacon.CF_Start_Blue = true;
                        params.beacon.CF_Is_Blue = true;
                        params.set_global_buffer(prev => {
                            return [...prev, 'changed_starting_color'];
                        });
                    } else if (event.target.value == "red") {
                        params.beacon.sendCmd("Capture_Flag_Start_Red")
                        params.beacon.CF_Start_Blue = false;
                        params.beacon.CF_Is_Blue = false;
                        params.set_global_buffer(prev => {
                            return [...prev, 'changed_starting_color'];
                        });
                    }
                }}>
                    <option value="blue">Start Blue</option>
                    <option value="red">Start Red</option>
                </select>
            </div>
        </div>
    )
}