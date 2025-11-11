import React, { useRef, useState, useEffect } from 'react'
import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { BACKEND_BASE, STUN_SERVERS } from '../config'
import { waitForIceGatheringComplete } from '../utils/webrtc'

export default function Receiver() {
    const pcRef = useRef(null)
    const dcRef = useRef(null)
    const pollRef = useRef(null)
    const incoming = useRef({})

    const [state, setState] = useState('idle')
    const [identifier, setIdentifier] = useState('')
    const [progress, setProgress] = useState({ received: 0, total: 0, name: '' })

    useEffect(() => () => clearInterval(pollRef.current), [])

    async function createReceiver() {
        setState('creating')
        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })
        pcRef.current = pc

        const dc = pc.createDataChannel('file')
        dc.binaryType = 'arraybuffer'
        dc.onopen = () => setState('connected')
        dc.onmessage = (e) => handleIncoming(e.data)
        dcRef.current = dc

        pc.oniceconnectionstatechange = () => setState(pc.iceConnectionState)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGatheringComplete(pc)

        // TODO: implement publicKey exchange
        const body = { peer: { publicKey: 'TODO', webRTC: { offer: JSON.stringify(pc.localDescription) } } }
        const resp = await fetch(`${BACKEND_BASE}/api/peer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        })
        const j = await resp.json()
        setIdentifier(j.identifier)
        setState('waiting')

        pollRef.current = setInterval(async () => {
            try {
                const r = await fetch(`${BACKEND_BASE}/api/peer/${j.identifier}/client`)
                const p = await r.json()
                if (p.client && p.client.webRTC && p.client.webRTC.answer) {
                    clearInterval(pollRef.current)
                    const answer = JSON.parse(p.client.webRTC.answer)
                    await pc.setRemoteDescription(answer)
                    setState('connected')
                }
            } catch (err) {
                console.error(err)
            }
        }, 2000)
    }

    function handleIncoming(data) {
        if (typeof data === 'string') {
            try {
                const meta = JSON.parse(data)
                incoming.current = { name: meta.fileName, size: meta.fileSize, chunks: [], received: 0 }
                setProgress({ received: 0, total: meta.fileSize, name: meta.fileName })
            } catch {
                console.warn('string message', data)
            }
        } else {
            const arr = new Uint8Array(data)
            incoming.current.chunks.push(arr)
            incoming.current.received += arr.byteLength
            setProgress({ received: incoming.current.received, total: incoming.current.size, name: incoming.current.name })
            if (incoming.current.received >= incoming.current.size) {
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
        }
    }

    return (
        <Card>
            <Card.Body>
                <Card.Title>Receiver (Create ID)</Card.Title>
                <Card.Text className="text-muted">Create an identifier and wait for a peer to connect. The same data channel is bidirectional — once connected, both sides can send files.</Card.Text>

                <div className="d-flex gap-2 mb-3">
                    <Button onClick={createReceiver} disabled={!!identifier} variant="primary">Create ID</Button>
                    <div className="align-self-center">
                        <strong>{state}</strong>
                    </div>
                </div>

                {identifier && (
                    <Form.Group className="mb-3">
                        <Form.Label>Share this ID</Form.Label>
                        <Form.Control readOnly value={identifier} />
                    </Form.Group>
                )}

                <div>
                    <div className="mb-1">Incoming: {progress.name || '-'}</div>
                    <ProgressBar now={progress.total ? (progress.received / progress.total) * 100 : 0} label={`${progress.received}/${progress.total}`} />
                </div>
            </Card.Body>
        </Card>
    )
}