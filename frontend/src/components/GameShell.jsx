import React, { useRef, useState, useEffect } from 'react'
import Button from 'react-bootstrap/Button'

export default function GameShell({
    children,
    visible = true,
    defaultWidth = 480,
    defaultHeight = 320,
    minWidth = 240,
    minHeight = 160,
    className = '',
    style = {},
}) {
    const shellRef = useRef(null)
    const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight })
    const [isResizing, setIsResizing] = useState(false)
    const resizingRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 })
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        function onMouseMove(e) {
            if (!isResizing) return
            const dx = e.clientX - resizingRef.current.startX
            const dy = e.clientY - resizingRef.current.startY
            const parent = shellRef.current?.parentElement
            const maxW = parent ? parent.clientWidth : Number.POSITIVE_INFINITY

            let newW = Math.max(minWidth, Math.min(maxW, Math.round(resizingRef.current.startW + dx)))
            let newH = Math.max(minHeight, Math.round(resizingRef.current.startH + dy))
            setSize({ w: newW, h: newH })
        }
        function onMouseUp() {
            setIsResizing(false)
        }
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [isResizing, minWidth, minHeight])

    useEffect(() => {
        function onFsChange() {
            const fsElem = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement
            setIsFullscreen(!!fsElem)
        }
        document.addEventListener('fullscreenchange', onFsChange)
        document.addEventListener('webkitfullscreenchange', onFsChange)
        document.addEventListener('mozfullscreenchange', onFsChange)
        document.addEventListener('MSFullscreenChange', onFsChange)
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange)
            document.removeEventListener('webkitfullscreenchange', onFsChange)
            document.removeEventListener('mozfullscreenchange', onFsChange)
            document.removeEventListener('MSFullscreenChange', onFsChange)
        }
    }, [])

    useEffect(() => {
        const el = shellRef.current
        if (!el || !el.parentElement) return
        const parent = el.parentElement
        const ro = new ResizeObserver(() => {
            const pw = parent.clientWidth
            const ph = parent.clientHeight
            setSize(s => {
                const w = Math.min(s.w, pw)
                const h = Math.min(s.h, ph)
                if (w === s.w && h === s.h) return s
                return { w: Math.max(minWidth, w), h: Math.max(minHeight, h) }
            })
        })
        ro.observe(parent)
        return () => ro.disconnect()
    }, [minWidth, minHeight])

    function startResize(e) {
        e.preventDefault()
        setIsResizing(true)
        resizingRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startW: size.w,
            startH: size.h,
        }
    }

    async function enterFullscreen() {
        const el = shellRef.current
        if (!el) return
        try {
            if (el.requestFullscreen) await el.requestFullscreen()
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
            else if (el.mozRequestFullScreen) await el.mozRequestFullScreen()
            else if (el.msRequestFullscreen) await el.msRequestFullscreen()
        } catch (err) {
            console.warn('Fullscreen error', err)
        }
    }

    async function exitFullscreen() {
        try {
            if (document.exitFullscreen) await document.exitFullscreen()
            else if (document.webkitExitFullscreen) await document.webkitExitFullscreen()
            else if (document.mozCancelFullScreen) await document.mozCancelFullScreen()
            else if (document.msExitFullscreen) await document.msExitFullscreen()
        } catch (err) {
            console.warn('Exit fullscreen error', err)
        }
    }

    function resetSize() {
        const parent = shellRef.current?.parentElement
        setSize({
            w: parent ? Math.min(defaultWidth, parent.clientWidth) : defaultWidth,
            h: defaultHeight
        })
    }

    if (!visible) return null

    const wrapperStyle = {
        width: isFullscreen ? '100%' : `${size.w}px`,
        height: isFullscreen ? '100%' : `${size.h}px`,
        maxWidth: '100%',
        boxSizing: 'border-box',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8,
        padding: 8,
        position: 'relative',
        background: '#fff',
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
    }

    const toolbarStyle = {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        marginBottom: 8,
    }

    const contentStyle = {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
    }

    const resizerStyle = {
        width: 14,
        height: 14,
        position: 'absolute',
        right: 6,
        bottom: 6,
        cursor: 'nwse-resize',
        borderRadius: 2,
        background: 'rgba(0,0,0,0.08)',
        display: isFullscreen ? 'none' : 'block',
    }

    return (
        <div ref={shellRef} className={`game-shell ${className}`} style={wrapperStyle}>
            <div style={toolbarStyle}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Game</div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant="outline-secondary" onClick={resetSize} title="Reset size">Reset</Button>
                    {isFullscreen ? (
                        <Button size="sm" variant="outline-secondary" onClick={exitFullscreen} title="Exit fullscreen">Exit</Button>
                    ) : (
                        <Button size="sm" variant="outline-secondary" onClick={enterFullscreen} title="Fullscreen">Fullscreen</Button>
                    )}
                </div>
            </div>

            <div style={contentStyle}>
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {children}
                </div>
            </div>

            <div
                role="button"
                aria-label="Resize"
                onMouseDown={startResize}
                style={resizerStyle}
            />
        </div>
    )
}
