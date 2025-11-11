use reqwest::Client;
use serde::{Deserialize, Serialize};
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use std::fmt::Display;
use log::debug;

pub struct SignallingClient {
    base_url: String,
    client: Client
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfferTo {
    pub peer: OfferPeerTo
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfferPeerTo {
    #[serde(rename = "publicKey")]
    pub public_key: String,
    #[serde(rename = "webRTC")]
    pub web_rtc: OfferPeerWebRTCTo
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfferPeerWebRTCTo {
    pub offer: RTCSessionDescription
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfferResponse {
    pub identifier: String
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerTo {
    pub client: AnswerPeerTo
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerPeerTo {
    #[serde(rename = "publicKey")]
    pub public_key: Option<String>,
    #[serde(rename = "webRTC")]
    pub web_rtc: AnswerPeerWebRTCTo
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerPeerWebRTCTo {
    pub answer: RTCSessionDescription
}

impl SignallingClient {
    pub fn new(base_url: String) -> Self {
        Self { base_url, client: Default::default() }
    }

    pub async fn post_offer(&self, offer: RTCSessionDescription) -> anyhow::Result<OfferResponse> {
        let body = OfferTo {
            peer: OfferPeerTo {
                public_key: "none".to_string(),
                web_rtc: OfferPeerWebRTCTo {
                    offer
                }
            }
        };
        let res = self.client.post(format!("{}/api/peer", self.base_url))
            .json(&body)
            .send()
            .await?;
        Ok(res.json().await?)
    }

    pub async fn post_answer(&self, id: String, answer: RTCSessionDescription) -> anyhow::Result<()> {
        let body = AnswerTo {
            client: AnswerPeerTo {
                public_key: Option::from("none".to_string()),
                web_rtc: AnswerPeerWebRTCTo {
                    answer
                }
            }
        };
        let res = self.client.post(format!("{}/api/peer/{id}/client", self.base_url))
            .json(&body)
            .send()
            .await?;
        res.bytes().await?;
        Ok(())
    }

    pub async fn get_offer(&self, id: &str) -> anyhow::Result<OfferTo> {
        let res = self.client.get(format!("{}/api/peer/{id}", self.base_url))
            .send()
            .await?;
        Ok(res.json().await?)
    }

    pub async fn get_answer(&self, id: &str) -> anyhow::Result<AnswerTo> {
        let res = self.client.get(format!("{}/api/peer/{id}/client", self.base_url))
            .send()
            .await?;
        let x = res.text().await?;
        Ok(serde_json::from_str::<AnswerTo>(&x)?)
    }
}