use anyhow::{Result, anyhow};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use warp::Filter;

#[derive(Serialize, Deserialize, Clone)]
struct Client {
    #[serde(rename = "webRTC")]
    web_rtc: WebRtc,
}

#[derive(Serialize, Deserialize, Clone)]
struct WebRtc {
    offer: Option<serde_json::Value>,
    answer: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Peer {
    #[serde(skip)]
    created: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "publicKey")]
    public_key: String,
    #[serde(rename = "webRTC")]
    web_rtc: WebRtc,
    #[serde(skip)]
    client: Option<Client>,
}

struct App {
    peers: RwLock<HashMap<String, Peer>>,
}

impl App {
    pub fn new() -> App {
        App {
            peers: RwLock::new(HashMap::new()),
        }
    }

    fn find_random_id(&self) -> Result<String> {
        let mut rng = rand::rng();
        loop {
            let id = (rng.random::<u64>() % 10000).to_string();
            if let Some(_) = self
                .peers
                .read()
                .map_err(|err| anyhow!("{}", err))?
                .get(&id)
            {
                continue;
            }
            return Ok(id);
        }
    }

    pub fn peer_create(&self, mut peer: Peer) -> Result<String> {
        let id = self.find_random_id()?;

        peer.created = chrono::Utc::now();
        self.peers
            .write()
            .map_err(|err| anyhow!("{}", err))?
            .insert(id.clone(), peer);

        return Ok(id);
    }

    pub fn peer_get(&self, id: String) -> Result<Option<Peer>> {
        if let Some(peer) = self
            .peers
            .read()
            .map_err(|err| anyhow!("{}", err))?
            .get(&id)
        {
            return Ok(Some(peer.clone()));
        }

        return Ok(None);
    }

    pub fn peer_client_get(&self, id: String) -> Result<Option<Client>> {
        if let Some(peer) = self
            .peers
            .read()
            .map_err(|err| anyhow!("{}", err))?
            .get(&id)
        {
            return Ok(peer.client.clone());
        }

        return Ok(None);
    }

    pub fn peer_client_set(&self, id: String, client: Client) -> Result<()> {
        if let Some(peer) = self
            .peers
            .write()
            .map_err(|err| anyhow!("{}", err))?
            .get_mut(&id)
        {
            peer.client = Some(client)
        } else {
            return Err(anyhow!("No such peer {}", id));
        }

        return Ok(());
    }

    pub fn cleanup(&self) -> Result<()> {
        println!("Cleaning up");
        let mut peers = self.peers.write().map_err(|err| anyhow!("{}", err))?;
        let now = chrono::Utc::now();
        peers.retain(|_, p: &mut Peer| {
            now - p.created >= chrono::Duration::minutes(30)
        });

        return Ok(());
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct InternalError {
    message: String,
}

impl warp::reject::Reject for InternalError {}

#[derive(Serialize, Deserialize, Debug)]
struct CreateResponse {
    identifier: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct EmptyResponse {}

#[derive(Serialize, Deserialize)]
struct PeerCreateRequest {
    peer: Peer,
}

#[derive(Serialize, Deserialize)]
struct PeerGetResponse {
    peer: Peer,
}

#[derive(Serialize, Deserialize)]
struct PeerClientGetResponse {
    client: Option<Client>,
}

#[derive(Serialize, Deserialize)]
struct PeerClientCreateRequest {
    client: Client,
}

#[tokio::main]
async fn main() {
    let app = Arc::new(App::new());

    tokio::spawn({
        let app = app.clone();
        async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_mins(10));
            loop {
                if let Err(err) = app.cleanup() {
                    println!("Cleanup error: {}", err);
                }
                interval.tick().await;
            }
        }
    });

    let peer_create = warp::path!("peer")
        .and(warp::post())
        .and(warp::body::json::<PeerCreateRequest>())
        .map({
            let app = app.clone();
            move |body: PeerCreateRequest| match app.peer_create(body.peer) {
                Err(err) => warp::reply::with_status(
                    warp::reply::json(&InternalError {
                        message: err.to_string(),
                    }),
                    warp::http::StatusCode::INTERNAL_SERVER_ERROR,
                ),
                Ok(identifier) => warp::reply::with_status(
                    warp::reply::json(&CreateResponse { identifier }),
                    warp::http::StatusCode::OK,
                ),
            }
        });

    let peer_get = warp::path!("peer" / String).and(warp::get()).map({
        let app = app.clone();
        move |id: String| match app.peer_get(id) {
            Err(err) => warp::reply::with_status(
                warp::reply::json(&InternalError {
                    message: err.to_string(),
                }),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ),
            Ok(None) => warp::reply::with_status(
                warp::reply::json(&EmptyResponse {}),
                warp::http::StatusCode::NOT_FOUND,
            ),
            Ok(Some(peer)) => warp::reply::with_status(
                warp::reply::json(&PeerGetResponse { peer }),
                warp::http::StatusCode::OK,
            ),
        }
    });

    let peer_client_get = warp::path!("peer" / String / "client")
        .and(warp::get())
        .map({
            let app = app.clone();
            move |id: String| match app.peer_client_get(id) {
                Err(err) => warp::reply::with_status(
                    warp::reply::json(&InternalError {
                        message: err.to_string(),
                    }),
                    warp::http::StatusCode::INTERNAL_SERVER_ERROR,
                ),
                Ok(client) => warp::reply::with_status(
                    warp::reply::json(&PeerClientGetResponse { client }),
                    warp::http::StatusCode::OK,
                ),
            }
        });

    let peer_client_create = warp::path!("peer" / String / "client")
        .and(warp::post())
        .and(warp::body::json::<PeerClientCreateRequest>())
        .map({
            let app = app.clone();
            move |id: String, body: PeerClientCreateRequest| match app
                .peer_client_set(id, body.client)
            {
                Err(err) => warp::reply::with_status(
                    warp::reply::json(&InternalError {
                        message: err.to_string(),
                    }),
                    warp::http::StatusCode::INTERNAL_SERVER_ERROR,
                ),
                Ok(_) => warp::reply::with_status(
                    warp::reply::json(&EmptyResponse {}),
                    warp::http::StatusCode::OK,
                ),
            }
        });

    let api = peer_create
        .or(peer_get)
        .or(peer_client_get)
        .or(peer_client_create);

    warp::serve(api).run(([127, 0, 0, 1], 3000)).await;
}
