import React, { useEffect, useRef } from 'react'

export const WIDTH = 400;
export const HEIGHT = 600;

export default function Flappy({ onAction }) {
  const canvasRef = useRef(null)

  // Флаг, чтобы игра запускалась ТОЛЬКО ОДИН РАЗ за всю жизнь страницы
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return        // 👈 предотвращает перезапуск
    started.current = true

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    let bird = { x: 60, y: 200, w: 30, h: 30, vel: 0 }
    const gravity = 0.2
    const jump = -5

    let pipes = [{ x: 400, gapY: 200, passed: false }]
    const pipeWidth = 60
    const gapHeight = 150
    const pipeSpeed = 2

    let score = 0
    let gameOver = false

    function drawBird() {
      ctx.fillStyle = "yellow"
      ctx.fillRect(bird.x, bird.y, bird.w, bird.h)
    }

    function drawPipes() {
      ctx.fillStyle = "green"
      pipes.forEach(p => {
        ctx.fillRect(p.x, 0, pipeWidth, p.gapY - gapHeight / 2)
        ctx.fillRect(
          p.x,
          p.gapY + gapHeight / 2,
          pipeWidth,
          canvas.height - p.gapY - gapHeight / 2
        )
      })
    }

    function drawScore() {
      ctx.fillStyle = "black"
      ctx.font = "20px sans-serif"
      ctx.fillText(`Score: ${score}`, 10, 25)
    }

    function update() {
      if (gameOver) return

      bird.vel += gravity
      bird.y += bird.vel

      pipes.forEach(p => (p.x -= pipeSpeed))

      if (pipes[pipes.length - 1].x < 220) {
        pipes.push({
          x: 400,
          gapY: Math.random() * 200 + 150,
          passed: false
        })
      }

      if (pipes[0].x < -pipeWidth) pipes.shift()

      // Passing a pipe
      pipes.forEach(p => {
        if (!p.passed && p.x + pipeWidth < bird.x) {
          p.passed = true
          score++
          onAction()    // <-- работает без перезапуска игры
        }
      })

      // Collision detection
      pipes.forEach(p => {
        const hit =
          bird.x < p.x + pipeWidth &&
          bird.x + bird.w > p.x &&
          (bird.y < p.gapY - gapHeight / 2 ||
            bird.y + bird.h > p.gapY + gapHeight / 2)

        if (hit) gameOver = true
      })

      if (bird.y + bird.h > canvas.height || bird.y < 0) {
        gameOver = true
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawPipes()
      drawBird()
      drawScore()
    }

    function loop() {
      draw()
      update()

      if (!gameOver) {
        requestAnimationFrame(loop)
      } else {
        ctx.fillStyle = "red"
        ctx.font = "28px sans-serif"
        ctx.fillText("Game Over — Press Space", 40, 300)
      }
    }

    function handleKey(e) {
      if (e.code === "Space") {
        if (gameOver) {
          bird = { x: 60, y: 200, w: 30, h: 30, vel: 0 }
          pipes = [{ x: 400, gapY: 200, passed: false }]
          score = 0
          gameOver = false
          loop()
        } else {
          bird.vel = jump
        }
      }
    }

    document.addEventListener("keydown", handleKey)
    loop()

    // 👇 ВАЖНО — НЕ удаляем обработчик! Он должен жить вечно
    // return () => document.removeEventListener("keydown", handleKey)

  }, [])   // 👈 пустой массив — эффект запускается один раз

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{
        border: "2px solid black",
        background: "#aee",
        display: "block",
        margin: "0 auto",
      }}
    />
  )
}
