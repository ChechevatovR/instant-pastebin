use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub(crate) struct FileInfo {
    #[serde(rename = "fileName")]
    pub filename: String,
    #[serde(rename = "fileSize")]
    pub filesize: Option<usize>,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum InfoMessage {
    #[serde(rename = "begin")]
    Begin {
        #[serde(rename = "fileInfo")]
        fileinfo: FileInfo
    },

    #[serde(rename = "end")]
    End {},
}
