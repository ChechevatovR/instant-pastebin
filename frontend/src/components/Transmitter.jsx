import React, { useRef, useState } from 'react'
import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { BACKEND_BASE, STUN_SERVERS, CHUNK_SIZE } from '../config'
import { waitForIceGatheringComplete } from '../utils/webrtc'

export default function Transmitter() {
    const [id, setId] = useState('')
    const pcRef = useRef(null)
    const dcRef = useRef(null)
    const incoming = useRef({})
    const [state, setState] = useState('idle')
    const [progress, setProgress] = useState({ sent: 0, total: 0 })

    async function connect() {
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

    function handleIncoming(data) {
        if (typeof data === 'string') {
            try {
                const meta = JSON.parse(data)
                if (meta.type == "begin") {
                    incoming.current = { name: meta.fileInfo.fileName, size: meta.fileInfo.fileSize, chunks: [], received: 0 }
                    setProgress({ received: 0, total: meta.fileSize, name: meta.fileName })
                } else if (meta.type == "end") {
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
            } catch {
                console.warn('string message', data)
            }
        } else {
            const arr = new Uint8Array(data)
            incoming.current.chunks.push(arr)
            incoming.current.received += arr.byteLength
            setProgress({ received: incoming.current.received, total: incoming.current.size, name: incoming.current.name })
        }
    }


    return (
        <Card>
            <Card.Body>
                <Card.Title>Connect (Enter ID)</Card.Title>
                <Card.Text className="text-muted">Enter the remote identifier and connect. Once connected, use the controls below to send files.</Card.Text>

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
                    <ProgressBar now={progress.total ? (progress.received / progress.total) * 100 : 0} label={`${progress.received}/${progress.total}`} />
                </div>
            </Card.Body>
        </Card>
    )
}
