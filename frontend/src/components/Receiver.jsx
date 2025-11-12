import React, { useRef, useState } from 'react'
import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { BACKEND_BASE, STUN_SERVERS } from '../config'
import { waitForIceGatheringComplete } from '../utils/webrtc'
import Game, { getRandomGameType } from './Game'

export default function Receiver() {
    const [id, setId] = useState('')
    const pcRef = useRef(null)
    const dcRef = useRef(null)
    const incoming = useRef(null)
    const [state, setState] = useState('idle')
    const [progress, setProgress] = useState({ received: 0, total: null })
    const [downloadProgress, setDownloadProgress] = useState({ download: 0, total: 0 })

    const downloadedChunks = useRef({ chunks: 0, chunksSize: 0 })
    const gameType = useRef(getRandomGameType())

    function closeConnection() {
        try {
            if (dcRef.current) {
                try { dcRef.current.close() } catch (e) { }
            }
            if (pcRef.current) {
                try { pcRef.current.close() } catch (e) { }
            }
        } finally {
            dcRef.current = null
            pcRef.current = null
        }
    }

    function resetIncoming() {
        incoming.current = null
        setProgress({ received: 0, total: null, name: '' })
        setDownloadProgress({ download: 0, total: null })
        downloadedChunks.current = { chunks: 0, chunksSize: 0 }
    }

    async function connect() {
        closeConnection()
        resetIncoming()

        setState('connecting')
        const r = await fetch(`${BACKEND_BASE}/api/peer/${id}`)
        const j = await r.json()
        if (!j.peer || !j.peer.webRTC || !j.peer.webRTC.offer) {
            alert('No offer for this ID')
            setState('idle')
            return
        }
        const offer = j.peer.webRTC.offer

        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })
        pcRef.current = pc
        pc.oniceconnectionstatechange = () => setState(pc.iceConnectionState)

        pc.ondatachannel = (ev) => {
            const dc = ev.channel
            dc.binaryType = 'arraybuffer'
            dc.onopen = () => setState('connected')
            dc.onmessage = (e) => handleIncoming(e.data)
            dcRef.current = dc
        }

        await pc.setRemoteDescription(offer)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await waitForIceGatheringComplete(pc)

        // TODO: implement publicKey exchange
        await fetch(`${BACKEND_BASE}/api/peer/${id}/client`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client: { publicKey: 'TODO', webRTC: { answer: pc.localDescription } } })
        })

        setState('answer_posted')
    }

    function initIncoming(name, size) {
        incoming.current = { name: name ?? null, size: size ?? null, chunks: [], received: 0, endReceived: false }
        setProgress({ received: 0, total: size ?? null, name: name ?? '' })
        setDownloadProgress({ download: 0, total: size ?? null })
        downloadedChunks.current = { chunks: 0, chunksSize: 0 }
        gameType.current = getRandomGameType()
    }

    function handleIncoming(data) {
        if (typeof data === 'string') {
            try {
                const meta = JSON.parse(data)
                if (meta.type == "begin") {
                    initIncoming(meta.fileInfo?.fileName ?? null, meta.fileInfo?.fileSize ?? null)
                } else if (meta.type == "end") {
                    if (!incoming.current) initIncoming(null, null)
                    incoming.current.endReceived = true
                    if (incoming.current.size == null) {
                        incoming.current.size = incoming.current.received
                        setProgress({ received: incoming.current.received, total: incoming.current.size, name: incoming.current.name })
                        setDownloadProgress({ download: downloadedChunks.current.chunksSize, total: incoming.current.size })
                    }
                    setState('downloading')
                    closeConnection()
                    downloadFile()
                }
            } catch {
                console.warn('string message', data)
            }
        } else {
            const arr = new Uint8Array(data)
            incoming.current.chunks.push(arr)
            incoming.current.received += arr.byteLength
            setProgress({ received: incoming.current.received, total: incoming.current.size ?? null, name: incoming.current.name ?? '' })
        }
    }

    function downloadFile() {
        const blob = new Blob(incoming.current.chunks)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = incoming.current.name || 'file.bin'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        setState('done')
    }

    function downloadNextChunk() {
        if (!incoming.current) return

        if (downloadedChunks.current.chunks >= incoming.current.chunks.length)
            return;

        downloadedChunks.current.chunksSize += incoming.current.chunks[downloadedChunks.current.chunks].byteLength
        downloadedChunks.current.chunks += 1
        setDownloadProgress({ download: downloadedChunks.current.chunksSize, total: incoming.current.size })

        if (downloadedChunks.current.chunks >= incoming.current.chunks.length && incoming.current.endReceived) {
            downloadFile()
        }
    }

    const kb = (n) => (n == null ? '0.0' : (n / 1024).toFixed(1))
    // const showGame = !!incoming.current
    const showGame = false
    const showProgress = (progress.total != null) || (incoming.current && incoming.current.endReceived)

    return (
        <Card>
            <Card.Body>
                <Card.Title>Receive (Enter ID)</Card.Title>
                <Card.Text className="text-muted">Enter the remote identifier and connect. Once connected, use the controls below to earn files.</Card.Text>

                <Form.Group className="mb-3">
                    <Form.Label>Remote ID</Form.Label>
                    <Form.Control value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. 807" />
                </Form.Group>

                <div className="d-flex gap-2 mb-3">
                    <Button onClick={connect} variant="success">Connect</Button>
                    <div className="align-self-center"><strong>{state}</strong></div>
                </div>

                <div>
                    <div className="mb-1">Incoming: {progress.name || '-'}</div>
                    {showProgress ? (
                        <>
                            {progress.total ? (
                                <ProgressBar now={(progress.received / progress.total) * 100}
                                    label={`${kb(progress.received)} KB / ${kb(progress.total)} KB`} />
                            ) : (
                                <ProgressBar now={100} label={`${kb(progress.received)} KB`} />
                            )}

                            <div style={{ marginTop: 8 }}>
                                {downloadProgress.total ? (
                                    <ProgressBar now={(downloadProgress.download / downloadProgress.total) * 100}
                                        label={`Unlocked ${kb(downloadProgress.download)} KB / ${kb(downloadProgress.total)} KB`} />
                                ) : (
                                    <ProgressBar now={(downloadProgress.download > 0 ? 100 : 0)} label={`Unlocked ${kb(downloadProgress.download)} KB`} />
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-muted">No progress information</div>
                    )}
                </div>

                <div className="mt-3">
                    <Game visible={showGame} onAction={downloadNextChunk} type={gameType.current} />
                </div>
            </Card.Body>
        </Card>
    )
}
