import React from 'react'
import Button from 'react-bootstrap/Button'

export default function Game({ visible = true, onAction }) {
  if (!visible) return null
  return (
    <Button onClick={onAction} disabled={false} variant="warning">
      Click to earn/send a block
    </Button>
  )
}