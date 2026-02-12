/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import '../../styles/gradient.css';

export const GradientDiv = ({ className, children, ...others }) => {
    return (
        <div className={`p-px rounded-full bg-gradient-blue-to-purple ${className}`}>
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center" {...others}>
                {children}
            </div>
        </div>
    )
}

export const Switch = ({ className, children, checked = false, onSwitch }) => {
    const [toggle, setToggle] = useState(checked);
    useEffect(() => {
        onSwitch && onSwitch(toggle)
    }, [toggle])
    return (
        <div
            className={`relative cursor-pointer ${className}`}
            onClick={() => setToggle(!toggle)}
        >
            <img className='-p-[6%]' src='/assets/img/slider-bar.png' alt='bar' />
            <div className='absolute top-0 left-0 w-full h-full'>
                <div className='relative w-full h-full p-[8%]'>
                    <img className={`absolute translate-x- transition-transform ${toggle && "translate-x-[100%]"}`} src='/assets/img/thumbnail.png' width={'w-[40%]'} alt='moving' />
                </div>
            </div>
        </div>
    )
}
