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
                defaultActiveKey="Receiver"
                id="main-tabs"
                className="mb-3"
                fill
                justify
            >
                <Tab eventKey="Receiver" title="Receiver">
                    <Receiver />
                </Tab>

                <Tab eventKey="connect" title="Transmitter">
                    <Transmitter />
                </Tab>
            </Tabs>
        </Layout>
    )
}