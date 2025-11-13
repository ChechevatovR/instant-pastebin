import React from 'react'
import Button from 'react-bootstrap/Button'
import Doom, { WIDTH as DOOM_WIDTH, HEIGHT as DOOM_HEIGHT } from './Doom';
import Flappy, { WIDTH as FLAPPY_WIDTH, HEIGHT as FLAPPY_HEIGHT } from './Flappy';
import GameShell from './GameShell';

export const GameTypes = {
  // NONE: 'none',
  DOOM: 'doom',
  FLAPPY: 'flappy',
};

export const getRandomGameType = () => {
  const types = Object.values(GameTypes);
  return types[Math.floor(Math.random() * types.length)];
}

export function getGameActionDescription(gameType) {
    switch (gameType) {
        case GameTypes.DOOM:
            return "shoot enemies";
        case GameTypes.FLAPPY:
            return "keep jumping"
        default:
            return "click the button";
    }
}

export default function Game({ visible = true, onAction, type = GameTypes.NONE }) {
  function getGame(gameType, onAction) {
    switch (gameType) {
      case GameTypes.DOOM:
        return <Doom onAction={onAction} />;
      case GameTypes.FLAPPY:
        return <Flappy onAction={onAction} />;
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
        return { defaultWidth: DOOM_WIDTH + 100, defaultHeight: DOOM_HEIGHT + 100 };
      case GameTypes.FLAPPY:
        return { defaultWidth: FLAPPY_WIDTH + 100, defaultHeight: FLAPPY_HEIGHT + 100 };
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
