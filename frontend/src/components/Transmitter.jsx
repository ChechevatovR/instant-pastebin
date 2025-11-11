import React, { useRef, useState } from 'react'
import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { BACKEND_BASE, STUN_SERVERS, CHUNK_SIZE } from '../config'
import { waitForIceGatheringComplete, sleep } from '../utils/webrtc'

export default function Transmitter() {
    const [id, setId] = useState('')
    const pcRef = useRef(null)
    const dcRef = useRef(null)
    const [state, setState] = useState('idle')
    const [file, setFile] = useState(null)
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
        const offer = JSON.parse(j.peer.webRTC.offer)

        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })
        pcRef.current = pc
        pc.oniceconnectionstatechange = () => setState(pc.iceConnectionState)

        pc.ondatachannel = (ev) => {
            const dc = ev.channel
            dc.binaryType = 'arraybuffer'
            dc.onopen = () => setState('connected')
            dc.onmessage = (e) => console.log('msg', e.data)
            dcRef.current = dc
        }

        await pc.setRemoteDescription(offer)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await waitForIceGatheringComplete(pc)

        // TODO: implement publicKey exchange
        await fetch(`${BACKEND_BASE}/api/peer/${id}/client`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client: { publicKey: 'TODO', webRTC: { answer: JSON.stringify(pc.localDescription) } } })
        })

        setState('answer_posted')
    }

    async function sendFile() {
        if (!dcRef.current || dcRef.current.readyState !== 'open') {
            alert('Data channel not open')
            return
        }
        if (!file) return
        setProgress({ sent: 0, total: file.size })

        dcRef.current.send(JSON.stringify({ fileName: file.name, fileSize: file.size }))

        let offset = 0
        while (offset < file.size) {
            const slice = file.slice(offset, offset + CHUNK_SIZE)
            const buffer = await slice.arrayBuffer()
            dcRef.current.send(buffer)
            offset += buffer.byteLength
            setProgress({ sent: offset, total: file.size })
            await sleep(10)
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

                <Form.Group className="mb-3">
                    <Form.Label>Choose file to send</Form.Label>
                    <Form.Control type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </Form.Group>

                <div className="d-flex gap-2 mb-3">
                    <Button onClick={sendFile} disabled={!file} variant="primary">Send file</Button>
                    <div className="align-self-center">Progress: {progress.sent}/{progress.total}</div>
                </div>

                <ProgressBar now={progress.total ? (progress.sent / progress.total) * 100 : 0} />
            </Card.Body>
        </Card>
    )
}