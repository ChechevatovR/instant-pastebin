import React, { useRef, useState, useEffect } from 'react'
import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { BACKEND_BASE, STUN_SERVERS, CHUNK_SIZE } from '../config'
import { waitForIceGatheringComplete, sleep } from '../utils/webrtc'

export default function Receiver() {
    const pcRef = useRef(null)
    const dcRef = useRef(null)
    const pollRef = useRef(null)
    const [file, setFile] = useState(null)

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
        dc.onmessage = (e) => console.log('msg', e.data)
        dcRef.current = dc

        pc.oniceconnectionstatechange = () => setState(pc.iceConnectionState)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGatheringComplete(pc)

        // TODO: implement publicKey exchange
        const body = { peer: { publicKey: 'TODO', webRTC: { offer: pc.localDescription } } }
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
                    const answer = p.client.webRTC.answer
                    await pc.setRemoteDescription(answer)
                    setState('connected')
                }
            } catch (err) {
                console.error(err)
            }
        }, 2000)
    }

    async function sendFile() {
        if (!dcRef.current || dcRef.current.readyState !== 'open') {
            alert('Data channel not open')
            return
        }
        if (!file) return
        setProgress({ sent: 0, total: file.size })

        dcRef.current.send(JSON.stringify({ 
            type: "begin",
            fileInfo: {fileName: file.name, fileSize: file.size}
        }))

        let offset = 0
        while (offset < file.size) {
            const slice = file.slice(offset, offset + CHUNK_SIZE)
            const buffer = await slice.arrayBuffer()
            dcRef.current.send(buffer)
            offset += buffer.byteLength
            setProgress({ sent: offset, total: file.size })
            await sleep(10)
        }

        dcRef.current.send(JSON.stringify({ 
            type: "end",
        }))
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
