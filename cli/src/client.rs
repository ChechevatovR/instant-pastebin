use anyhow::Result;
use captures::capture;
use std::io;
use std::io::Write;
use std::sync::Arc;
use log::{error, info};
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::api::media_engine::MediaEngine;
use webrtc::api::APIBuilder;
use webrtc::data_channel::data_channel_message::DataChannelMessage;
use webrtc::data_channel::RTCDataChannel;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::interceptor::registry::Registry;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;

pub(crate) async fn main(session_id: &str) -> Result<()> {
    let mut m = MediaEngine::default();
    m.register_default_codecs()?;
    let mut registry = Registry::new();
    registry = register_default_interceptors(registry, &mut m)?;

    // Create the API object with the MediaEngine
    let api = APIBuilder::new()
        .with_media_engine(m)
        .with_interceptor_registry(registry)
        .build();

    // Prepare the configuration
    let config = RTCConfiguration {
        ice_servers: vec![RTCIceServer {
            urls: vec![
                "stun:stun.l.google.com:19302".to_owned(),
                "stun:stun1.l.google.com:19302".to_owned(),
                "stun:stun2.l.google.com:19302".to_owned(),
                "stun:stun3.l.google.com:19302".to_owned(),
                "stun:stun4.l.google.com:19302".to_owned(),
                "stun:stun.relay.metered.ca:80".to_owned(),
                "turn:global.relay.metered.ca:80".to_owned(),
                "turn:global.relay.metered.ca:80?transport=tcp".to_owned(),
                "turn:global.relay.metered.ca:443".to_owned(),
                "turns:global.relay.metered.ca:443?transport=tcp".to_owned(),
            ],
            username: "6fb0f47d8cb4265a38814e9d".to_owned(),
            credential: "fgSXLhtt0s2cUy9C".to_owned(),
            ..Default::default()
        }],
        ..Default::default()
    };

    // Create a new RTCPeerConnection
    let peer_connection = Arc::new(api.new_peer_connection(config).await?);

    let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<()>(1);

    // Set the handler for Peer connection state
    // This will notify you when the peer has connected/disconnected
    peer_connection.on_peer_connection_state_change(Box::new(capture!(with done_tx = done_tx.clone(), |s: RTCPeerConnectionState| {
        info!("Peer Connection State has changed: {s}");

        if s == RTCPeerConnectionState::Failed {
            // Wait until PeerConnection has had no network activity for 30 seconds or another failure. It may be reconnected using an ICE Restart.
            // Use webrtc.PeerConnectionStateDisconnected if you are interested in detecting faster timeout.
            // Note that the PeerConnection may come back from PeerConnectionStateDisconnected.
            error!("Peer Connection has gone to failed exiting");
            let _ = done_tx.try_send(());
        }

        Box::pin(async {})
    })));

    // Register data channel creation handling
    peer_connection
        .on_data_channel(Box::new(capture!(with done_tx = done_tx.clone(), move |d: Arc<RTCDataChannel>| {
            let d_label = d.label().to_owned();
            let d_id = d.id();
            info!("New DataChannel {d_label} {d_id}");

            // Register channel opening handling
            let d_label2 = d_label.clone();
            let d_id2 = d_id;
            d.on_close(Box::new(capture!(clone done_tx, move || {
                info!("Data channel closed");
                // let _ = done_tx.try_send(());
                Box::pin(async {})
            })));

            d.on_open(Box::new(move || {
                info!("Data channel '{d_label2}'-'{d_id2}' open");
                Box::pin(async {})
            }));

            // Register text message handling
            d.on_message(Box::new(move |msg: DataChannelMessage| {
                let sz = msg.data.len();
                info!("Message from DataChannel '{d_label}': '{sz}'");
                io::stdout().write_all(&msg.data).unwrap();
                io::stdout().flush().unwrap();
                Box::pin(async {})
            }));
            Box::pin(async {})
        })));

    // Wait for the offer to be pasted

    let signalling = crate::signalling::SignallingClient::new("http://64.188.74.63".to_owned());
    let offer_to = signalling.get_offer(session_id).await?;
    let offer = offer_to.peer.web_rtc.offer;

    // Set the remote SessionDescription
    peer_connection.set_remote_description(offer).await?;

    // Create an answer
    let answer = peer_connection.create_answer(None).await?;

    // Create channel that is blocked until ICE Gathering is complete
    let mut gather_complete = peer_connection.gathering_complete_promise().await;

    // Sets the LocalDescription, and starts our UDP listeners
    peer_connection.set_local_description(answer).await?;

    // Block until ICE Gathering is complete, disabling trickle ICE
    // we do this because we only can exchange one signaling message
    // in a production application you should exchange ICE Candidates via OnICECandidate
    let _ = gather_complete.recv().await;

    // Output the answer in base64 so we can paste it in browser
    if let Some(local_desc) = peer_connection.local_description().await {
        signalling.post_answer(session_id.to_owned(), local_desc).await?;
        println!("post answer success");
    } else {
        panic!("generate local_description failed!");
    }

    println!("Press ctrl-c to stop");
    tokio::select! {
        _ = done_rx.recv() => {
            info!("received done signal!");
        }
        _ = tokio::signal::ctrl_c() => {
            println!();
        }
    };

    peer_connection.close().await?;

    Ok(())
}