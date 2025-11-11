export const BACKEND_BASE = 'http://64.188.74.63' 
export const STUN_SERVERS = [
    { "urls": ['stun:stun.l.google.com:19302'] },
    {"urls":"stun:stun.relay.metered.ca:80"},
    {"urls":"turn:global.relay.metered.ca:80","username":"6fb0f47d8cb4265a38814e9d","credential":"fgSXLhtt0s2cUy9C"},
    {"urls":"turn:global.relay.metered.ca:80?transport=tcp","username":"6fb0f47d8cb4265a38814e9d","credential":"fgSXLhtt0s2cUy9C"},
    {"urls":"turn:global.relay.metered.ca:443","username":"6fb0f47d8cb4265a38814e9d","credential":"fgSXLhtt0s2cUy9C"},
    {"urls":"turns:global.relay.metered.ca:443?transport=tcp","username":"6fb0f47d8cb4265a38814e9d","credential":"fgSXLhtt0s2cUy9C"}
]
export const CHUNK_SIZE = 64 * 1024 // 64KB