use crate::signalling::AnswerTo;
use anyhow::Result;
use bytes::{Bytes, BytesMut};
use captures::capture;
use log::{error, info, log};
use std::sync::Arc;
use std::time::Duration;
use tokio::io;
use tokio::io::AsyncReadExt;
use webrtc::api::APIBuilder;
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::api::media_engine::MediaEngine;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::interceptor::registry::Registry;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;

pub(crate) async fn main() -> Result<()> {
    // Create a MediaEngine object to configure the supported codec
    let mut m = MediaEngine::default();

    // Register default codecs
    m.register_default_codecs()?;

    // Create a InterceptorRegistry. This is the user configurable RTP/RTCP Pipeline.
    // This provides NACKs, RTCP Reports and other features. If you use `webrtc.NewPeerConnection`
    // this is enabled by default. If you are manually managing You MUST create a InterceptorRegistry
    // for each PeerConnection.
    let mut registry = Registry::new();

    // Use the default set of Interceptors
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

    // Create a datachannel with label 'data'
    let data_channel = peer_connection.create_data_channel("data", None).await?;

    let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<()>(1);

    // Set the handler for Peer connection state
    // This will notify you when the peer has connected/disconnected
    peer_connection.on_peer_connection_state_change(Box::new(
        capture!(with done_tx = done_tx.clone(), move |s: RTCPeerConnectionState| {
            info!("Peer Connection State has changed: {s}");

            if s == RTCPeerConnectionState::Failed {
                // Wait until PeerConnection has had no network activity for 30 seconds or another failure. It may be reconnected using an ICE Restart.
                // Use webrtc.PeerConnectionStateDisconnected if you are interested in detecting faster timeout.
                // Note that the PeerConnection may come back from PeerConnectionStateDisconnected.
                error!("Peer Connection has gone to failed exiting");
                let _ = done_tx.try_send(());
            }

            Box::pin(async {})
        }),
    ));

    // Register channel opening handling
    let d1 = Arc::clone(&data_channel);
    data_channel.on_open(Box::new(capture!(with done_tx = done_tx.clone(), move || {
        println!("Ready to send data");
        let mut buffer = BytesMut::zeroed(1024);
        Box::pin(async move {
            loop {
                let n = io::stdin().read(buffer.as_mut()).await;
                match n {
                    Ok(0) => {
                        done_tx.try_send(()).unwrap();
                    }
                    Ok(n) => {
                        buffer.truncate(n);

                        d1.send(&Bytes::from(buffer.clone())).await.unwrap();
                    }
                    Err(_) => {}
                }
            }
        })
    })));

    // Create an offer to send to the browser
    let offer = peer_connection.create_offer(None).await?;

    // Create channel that is blocked until ICE Gathering is complete
    let mut gather_complete = peer_connection.gathering_complete_promise().await;

    // Sets the LocalDescription, and starts our UDP listeners
    peer_connection.set_local_description(offer).await?;

    // Block until ICE Gathering is complete, disabling trickle ICE
    // we do this because we only can exchange one signaling message
    // in a production application you should exchange ICE Candidates via OnICECandidate
    let _ = gather_complete.recv().await;

    // Output the answer in base64 so we can paste it in browser

    let signalling = crate::signalling::SignallingClient::new("http://64.188.74.63".to_owned());

    let session_id = if let Some(local_desc) = peer_connection.local_description().await {
        let x = signalling.post_offer(local_desc).await?;
        println!("offer response: {}", x.identifier);
        x
    } else {
        panic!("generate local_description failed!");
    };

    // Wait for the answer to be pasted

    let answer: RTCSessionDescription = loop {
        let timeout = tokio::time::sleep(Duration::from_millis(1500));
        tokio::pin!(timeout);
        tokio::select! {
            _ = timeout.as_mut() => {

                let result = signalling.get_answer(&session_id.identifier).await;
                match result {
                    Ok(answer) => {break answer.client.web_rtc.answer;}
                    Err(_) => {
                        continue;
                    }
                }
            }
        }
    };

    // Apply the answer as the remote description
    peer_connection.set_remote_description(answer).await?;

    //println!("Press ctrl-c to stop");
    tokio::select! {
        _ = done_rx.recv() => {
            //println!("received done signal!");
        }
        _ = tokio::signal::ctrl_c() => {
            println!();
        }
    };

    peer_connection.close().await?;

    Ok(())
}
