export function waitForIceGatheringComplete(pc, timeout = 5000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    function check() {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', check)
    setTimeout(resolve, timeout)
  })
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}