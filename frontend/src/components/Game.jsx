import React from 'react'
import Button from 'react-bootstrap/Button'
import Doom, { WIDTH, HEIGHT } from './Doom';
import GameShell from './GameShell';

export const GameTypes = {
  NONE: 'none',
  DOOM: 'doom',
};

export const getRandomGameType = () => {
  const types = Object.values(GameTypes);
  return types[Math.floor(Math.random() * types.length)];
}

export default function Game({ visible = true, onAction, type = GameTypes.NONE }) {
  function getGame(gameType, onAction) {
    switch (gameType) {
      case GameTypes.DOOM:
        return <Doom onAction={onAction} />;
      default:
        return (
          <Button onClick={onAction} disabled={false} variant="warning">
            Click to earn/send a block
          </Button>
        );
    }
  }

  function getGameShellParams(gameType) {
    switch (gameType) {
      case GameTypes.DOOM:
        return { defaultWidth: WIDTH, defaultHeight: HEIGHT };
      default:
        return {};
    }
  }

  if (!visible) return null
  const defaultParams = getGameShellParams(type);
  return (
    <GameShell
      {...defaultParams}
    >
      {getGame(type, onAction)}
    </GameShell>
  )
}