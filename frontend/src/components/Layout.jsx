import React from 'react'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

export default function Layout({ children }) {
    return (
        <Container className="py-4">
            <Row>
                <Col>
                    <div className="mb-4 text-center">
                        <h1 className="h3">INSTANT PASTEBIN</h1>
                    </div>
                </Col>
            </Row>
            {children}
        </Container>
    )
}