import React, { useRef, useState, useEffect } from 'react'
import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { BACKEND_BASE, STUN_SERVERS, CHUNK_SIZE } from '../config'
import { waitForIceGatheringComplete, sleep } from '../utils/webrtc'
import Game, { getRandomGameType, getGameActionDescription } from './Game'

const BUFFER_SIZE_LOW = CHUNK_SIZE * 4
const BUFFER_SIZE_HIGH = CHUNK_SIZE * 8

export default function Transmitter() {
    const pcRef = useRef(null)
    const dcRef = useRef(null)
    const pollRef = useRef(null)
    const chunksRef = useRef(null)
    const [file, setFile] = useState(null)

    const [state, setState] = useState('idle')
    const [identifier, setIdentifier] = useState('')
    const [progress, setProgress] = useState({ received: 0, total: 0, name: '' })
    const gameType = useRef(getRandomGameType())

    useEffect(() => () => clearInterval(pollRef.current), [])

    async function createTransmitter() {
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

        const total = file.size
        const chunks = []
        let offset = 0
        while (offset < total) {
            const slice = file.slice(offset, offset + CHUNK_SIZE)
            const buffer = new Uint8Array(await slice.arrayBuffer())
            chunks.push(buffer)
            offset += buffer.byteLength
        }

        chunksRef.current = {
            chunks,
            totalSize: total,
            prepared: true,
            sentBytes: 0,
            sentChunks: 0,
            allowedToSend: 0,
        }

        setProgress({ sent: 0, total: total })
        gameType.current = getRandomGameType()

        dcRef.current.send(JSON.stringify({
            type: "begin",
            fileInfo: { fileName: file.name, fileSize: total }
        }))

        setState('ready')

        dcRef.current.bufferedAmountLowThreshold = BUFFER_SIZE_LOW;
        dcRef.current.onbufferedamountlow = async (ev) => {
            await sendWhileBufferedUnderThreshold()
        };
        await sendWhileBufferedUnderThreshold()
    }

    async function sendWhileBufferedUnderThreshold() {
        while (chunksRef.current.sentChunks < chunksRef.current.allowedToSend
                && dcRef.current.bufferedAmount <= BUFFER_SIZE_HIGH) {
            await sendNextChunk()

            const { chunks, sentChunks } = chunksRef.current
            if (sentChunks >= chunks.length) {
                break
            }
        }
    }

    async function allowMoreChunks() {
        chunksRef.current.allowedToSend += Math.max(chunksRef.current.chunks.length / 22, 1)
        await sendWhileBufferedUnderThreshold()
    }

    async function sendNextChunk() {
        if (!dcRef.current || dcRef.current.readyState !== 'open') return
        if (!chunksRef.current || !chunksRef.current.prepared) return

        const { chunks, sentChunks } = chunksRef.current
        if (sentChunks >= chunks.length) {
            return
        }

        const buf = chunks[sentChunks].buffer ? chunks[sentChunks].buffer : chunks[sentChunks]
        try {
            dcRef.current.send(buf)
        } catch (err) {
            console.error('send failed', err)
            return
        }

        chunksRef.current.sentChunks += 1
        chunksRef.current.sentBytes += (chunks[sentChunks].byteLength ?? chunks[sentChunks].length ?? 0)

        setProgress(prev => ({ ...prev, sent: chunksRef.current.sentBytes }))

        if (chunksRef.current.sentChunks >= chunks.length) {
            dcRef.current.send(JSON.stringify({ type: "end" }))
            setState('done')
        }
    }

    const kb = (n) => (n == null ? '0.0' : (n / 1024).toFixed(1))
    const showGame = !!(chunksRef.current && chunksRef.current.prepared)
    const showProgress = progress.total > 0

    return (
        <Card>
            <Card.Body>
                <Card.Title>Transmitter (Create ID)</Card.Title>
                <Card.Text className="text-muted">Create an identifier and wait for a peer to connect. The same data channel is bidirectional — once connected, both sides can send files.</Card.Text>

                <div className="d-flex gap-2 mb-3">
                    <Button onClick={createTransmitter} disabled={!!identifier} variant="primary">Create ID</Button>
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
                    {showProgress && <div className="align-self-center">Progress: {`${kb(progress.sent)} KB / ${kb(progress.total)} KB`}</div>}
                </div>

                <div>
                    {showProgress ? (
                        progress.total ? (
                            <ProgressBar now={(progress.sent / progress.total) * 100}
                                label={`${kb(progress.sent)} KB / ${kb(progress.total)} KB`} />
                        ) : (
                            <ProgressBar now={100} label={`${kb(progress.sent)} KB`} />
                        )
                    ) : (
                        <div className="text-muted">No progress information</div>
                    )}
                </div>

                <div>
                    {showProgress && (
                        progress.total ? (<>
                            <strong>Amount allowed to be sent, {getGameActionDescription(gameType.current)} to earn more</strong>
                            <ProgressBar now={(chunksRef.current.allowedToSend * CHUNK_SIZE / progress.total) * 100} />
                        </>) : (
                            <ProgressBar now={100} />
                        )
                    )}
                </div>

                <div className="mt-3">
                    <Game visible={showGame} onAction={allowMoreChunks} type={gameType.current} />
                </div>
            </Card.Body>
        </Card>
    )
}
