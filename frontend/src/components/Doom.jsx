import React, { useEffect, useRef } from "react";

import Module from '../doom/wasm-doom.js';

export const WIDTH = 950;
export const HEIGHT = 600;

const sharewhare = `${import.meta.env.BASE_URL}doom/shareware.wad`
console.log(sharewhare);

export default function Doom({ onAction }) {
    const canvasRef = useRef(null);

    async function LoadDoom(buffer) {
        const canvas = canvasRef.current;
        if (!canvas) {
            console.log('Canvas is not initialized');
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = WIDTH * dpr;
        canvas.height = HEIGHT * dpr;

        let module_args = {
            canvas: canvas,
            locateFile: (remote_package_base, _) => {
                return `${import.meta.env.BASE_URL}doom/${remote_package_base}`;
            }
        }
        const doom = await Module(module_args);

        doom.FS.writeFile('/doom-data.wad', buffer);
        doom.callMain(['-iwad', 'doom-data.wad', '-episode', '1', '-skill', '1']);
    }

    async function RunDoom() {
        let response = await fetch(sharewhare);
        let arrBuffer = await response.arrayBuffer();
        let buffer = new Uint8Array(arrBuffer);
        await LoadDoom(buffer);
    }

    useEffect(() => {
        document.addEventListener('doomEnemyDamage', (e) => {
            onAction({ damage: e.detail.damage })
        });

        RunDoom();

        return () => {
            console.log('Doom removed')
        }
    }, []);

    return (
        <canvas id="canvas" ref={canvasRef} />
    );
}
