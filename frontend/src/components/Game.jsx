import React from 'react'
import Button from 'react-bootstrap/Button'
import Doom, { WIDTH, HEIGHT } from './Doom';
import GameShell from './GameShell';

export const GameTypes = {
  NONE: 'none',
  DOOM: 'doom',
};

export default function Game({ visible = true, onAction, type = GameTypes.NONE }) {
  if (!visible) return null
  switch (type) {
    case GameTypes.NONE:
      return (
        <Button onClick={onAction} disabled={false} variant="warning">
          Click to earn/send a block
        </Button>
      )
    case GameTypes.DOOM:
      return (
        <GameShell defaultWidth={WIDTH} defaultHeight={HEIGHT}>
          <Doom onAction={onAction} />
        </GameShell>
      )
  }
}