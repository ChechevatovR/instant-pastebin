import React from 'react'
import Layout from './Layout'
import Tabs from 'react-bootstrap/Tabs'
import Tab from 'react-bootstrap/Tab'
import Receiver from './Receiver'
import Transmitter from './Transmitter'

export default function App() {
    return (
        <Layout>
            <Tabs
                defaultActiveKey="Transmitter"
                id="main-tabs"
                className="mb-3"
                fill
                justify
            >
                <Tab eventKey="Transmitter" title="Transmitter">
                    <Transmitter />
                </Tab>

                <Tab eventKey="Receiver" title="Receiver">
                    <Receiver />
                </Tab>
            </Tabs>
        </Layout>
    )
}