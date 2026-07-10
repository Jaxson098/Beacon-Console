import { useEffect, useState, useRef } from "react";

export default function Altitude(params) {

    const [points, set_points] = useState(0)

    const [start_minutes, set_start_minutes] = useState()
    const [start_seconds, set_start_seconds] = useState()

    const minutes = useRef(1)
    const seconds = useRef(30)

    const [round_points, set_round_points] = useState(0)

    function newRound() {
        console.log("NEW ROUND!!!")
        if (params.beacons.length > 0) {
            let to_change_ids = []

            for (const beacon of params.beacons) {
                to_change_ids.push(beacon.id)
            }

            console.log("to_change_ids ", to_change_ids)

            let writing = true

            const cmds = ["GM_Altitude_Low", "GM_Altitude_Medium", "GM_Altitude_High"]
            let cmdIndex = 0;

            while (writing) {
                const index = Math.floor(Math.random() * to_change_ids.length)

                const beacon_id = to_change_ids[index]

                console.log("beacon_id ",beacon_id)

                let selected_beacon;

                for (const beacon of params.beacons) {
                    if (beacon.id == beacon_id) {selected_beacon = beacon}
                }

                console.log("selected_beacon ", selected_beacon)

                selected_beacon.sendCmd(cmds[cmdIndex])

                console.log("cmds[cmdIndex] ",cmds[cmdIndex])

                to_change_ids = to_change_ids.filter(id => id != selected_beacon.id)

                console.log("NEW to_change_ids ", to_change_ids)

                if (cmdIndex < 2) {cmdIndex++} 
                else {cmdIndex=0}

                if (to_change_ids.length == 0) {
                    writing = false
                } 
            }
        }
    }

    useEffect(()=>{

        //if everything has been done and still running
        if (round_points >= params.beacons.length && params.running) {

            setTimeout(()=>{
                set_round_points(0)
                newRound()
            },500)
        }

        if (params.running && params.global_buffer.length > 0) {

            const count = params.global_buffer.length
            for (const point of params.global_buffer) {
                if (point.trim() === "A_Point") {set_points(prev => prev + 1); set_round_points(prev => prev + 1)}
            }
            params.set_global_buffer(prev => prev.slice(count))
        }
    },[params.global_buffer, params.beacons])

    useEffect(()=>{
        if (!params.running) {return}

        const id = setInterval(() => {
            if (seconds.current.value > 0) {
                seconds.current.value = seconds.current.value - 1;
            } else if (minutes.current.value > 0) {
                minutes.current.value = minutes.current.value - 1;
                seconds.current.value = 59;
            }

            if (seconds.current.value == 0 && minutes.current.value == 0) {
                params.set_running(false)
            }

        },1000)

        return () => {
            clearInterval(id);
            for (const beacon of params.beacons) {
                beacon.sendCmd("Idle")
            }
            minutes.current.value = start_minutes;
            seconds.current.value = start_seconds;
            set_round_points(0)
        }
    }, [params.running])

    return(
        <div className="w-full h-full flex-col flex px-4 py-5 items-center overflow-scroll">
            <div className="flex justify-evenly w-full h-2/3">
                <div className="rounded-xl flex bg-orange-400 w-2/5 border border-black items-center justify-center">
                    <p className="text-9xl">{points}</p>
                </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center justify-center mt-8 w-full">

                <button className={`ml-auto w-32 flex flex-col items-center justify-center text-5xl border border-black px-3 py-1 rounded-lg transition-all ${params.running ? "bg-red-700 hover:bg-red-600" : "bg-green-700 hover:bg-green-600"}`} onClick={()=>{
                    if (params.running) {
                        for (const beacon of params.beacons) {
                            beacon.sendCmd("Idle")
                        }
                        params.set_running(false)
                    }
                    else {
                        set_points(0)
                        if (minutes.current.value == "") {minutes.current.value = 1}
                        if (seconds.current.value == "") {seconds.current.value = 30}
                        set_start_minutes(minutes.current.value)
                        set_start_seconds(seconds.current.value)
                        params.set_running(true)
                        newRound()
                    }
                }}>{params.running ? "Stop" : "Start"}</button>

                <div className="mx-10 justify-self-center flex items-center">

                    <input ref={minutes} id="minutes" disabled={params.running} defaultValue={1} className={`rounded text-center flex w-16 border ${params.running ? "border-white" : "border-black"} text-5xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} type="number" pattern="\d{1,2}" maxLength={60} onChange={(event)=>{
                        if (event.target.value > 60) {event.target.value=60}
                    }}/>
                    <p className="text-5xl mx-1">:</p>
                    <input ref={seconds} id="seconds" disabled={params.running} defaultValue={30} className={`rounded text-center flex w-16 border ${params.running ? "border-white" : "border-black"} text-5xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} type="number" pattern="\d{1,2}" max={60} onChange={(event)=>{
                        if (event.target.value > 59) {event.target.value = 59;}
                    }}/>

                </div>

                <button hidden={params.running} disabled={params.running} className={`mr-auto flex flex-col items-center justify-center text-5xl border border-black bg-gray-200 ${params.running ? "" : "hover:bg-gray-300"} px-3 py-1 rounded-lg transition-all`} onClick={()=>{
                    for (const beacon of params.beacons) {
                        beacon.sendCmd("Idle")
                    }
                    set_points(0)
                    set_round_points(0)
                }}>Reset Points</button>

            </div>
    
        </div>
    )
}