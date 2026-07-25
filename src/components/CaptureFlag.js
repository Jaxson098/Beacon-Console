import { useEffect, useState, useRef } from "react";

export default function CaptureFlag(params) {

    const [blue, set_blue] = useState(0)
    const [red, set_red] = useState(0)

    const [start_minutes, set_start_minutes] = useState()
    const [start_seconds, set_start_seconds] = useState()

    const tone = useRef(new Audio("https://jaxson098.github.io/Beacon-Console/tone.wav"))
    const horn = useRef(new Audio("https://jaxson098.github.io/Beacon-Console/horn.wav"))
    const speech = useRef(new Audio("https://jaxson098.github.io/Beacon-Console/speech.mp3"))

    const minutes = useRef(1)
    const seconds = useRef(30)

    function updateScore() {
        let b = 0;
        let r = 0;
        for (const beacon of params.beacons) {
            if (beacon.CF_Is_Blue) {
                b++
            } else {
                r++
            }
        }
        set_blue(b)
        set_red(r)
    }

    useEffect(()=>{
        if (params.running) {
            updateScore()
        }
    },[params.global_buffer])

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
                beacon.sendCmd("Stopped")
            }
            minutes.current.value = start_minutes;
            seconds.current.value = start_seconds;
        }
    }, [params.running])

    return(
        <div className="w-full h-full flex-col flex px-4 py-5 items-center">
            <div className="flex justify-evenly w-full h-2/3">
                <div className="rounded-xl flex bg-blue-700 w-2/5 border border-black items-center justify-center">
                    <p className="text-5xl lg:text-9xl">{blue}</p>
                </div>
                <div className="rounded-xl flex bg-red-700 w-2/5 border border-black items-center justify-center">
                    <p className="text-5xl lg:text-9xl">{red}</p>
                </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center justify-center mt-8 w-full">

                <button className={`ml-auto flex flex-col items-center justify-center text-base lg:text-5xl border border-black px-3 py-1 rounded-lg transition-all ${params.running ? "bg-red-700 hover:bg-red-600" : "bg-green-700 hover:bg-green-600"}`} onClick={()=>{
                    if (params.running) {
                        for (const beacon of params.beacons) {
                            beacon.sendCmd("Stopped")
                        }
                        params.set_running(false)
                    }
                    else {
                        for (const beacon of params.beacons) {
                            if (beacon.CF_Start_Blue) {beacon.sendCmd("Capture_Flag_Start_Blue")}
                            else {beacon.sendCmd("Capture_Flag_Start_Red")}
                            beacon.sendCmd("GM_Capture_Flag")
                        }
                        updateScore()
                        if (minutes.current.value == "") {minutes.current.value = 1}
                        if (seconds.current.value == "") {seconds.current.value = 30}
                        set_start_minutes(minutes.current.value)
                        set_start_seconds(seconds.current.value)
                        params.set_running(true)
                        tone.current.play()
                    }
                }}>{params.running ? "Stop" : "Start"}</button>

                <div className="mx-10 justify-self-center flex items-center">

                    <input ref={minutes} id="minutes" disabled={params.running} defaultValue="1" className={`rounded text-center flex w-8 lg:w-16 border ${params.running ? "border-white" : "border-black"} text-base lg:text-5xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} type="number" pattern="\d{1,2}" maxLength={60} onChange={(event)=>{
                        if (event.target.value > 60) {event.target.value=60}
                    }}/>
                    <p className="text-base lg:text-5xl mx-1">:</p>
                    <input ref={seconds} id="seconds" disabled={params.running} defaultValue="00" className={`rounded text-center flex w-8 lg:w-16 border ${params.running ? "border-white" : "border-black"} text-base lg:text-5xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} type="number" pattern="\d{1,2}" max={60} onChange={(event)=>{
                        if (event.target.value > 59) {event.target.value = 59;}
                    }}/>

                </div>

                <button hidden={params.running} disabled={params.running} className={`mr-auto flex flex-col items-center justify-center text-base lg:text-5xl border border-black bg-gray-200 ${params.running ? "" : "hover:bg-gray-300"} px-3 py-1 rounded-lg transition-all`} onClick={()=>{
                    for (const beacon of params.beacons) {
                        if (beacon.CF_Start_Blue) {beacon.sendCmd("Capture_Flag_Start_Blue"); beacon.CF_Is_Blue = true}
                        else {beacon.sendCmd("Capture_Flag_Start_Red"); beacon.CF_Is_Blue = false}
                    }
                    set_blue(0)
                    set_red(0)
                }}>Reset Field</button>

            </div>

            <img className='w-1/6 mt-auto mr-auto mb-1 ml-1' src='https://jaxson098.github.io/Beacon-Console/logo-rectangle.png'></img>
    
        </div>
    )
}