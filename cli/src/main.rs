use clap::{AppSettings, Arg, ArgAction, Command};
mod server;
mod client;
mod signalling;
mod wordle;

use std::io::Write;

#[tokio::main]
async fn main() {
    let mut app = Command::new("instant-pastebin")
        .setting(AppSettings::DeriveDisplayOrder)
        .subcommand_negates_reqs(true)
        .arg(
            Arg::new("FULLHELP")
                .help("Prints more detailed help information")
                .long("fullhelp"),
        )
        .arg(
            Arg::new("debug")
                .long("debug")
                .short('d')
                .help("Prints debug log information"),
        )
        .arg(
            Arg::new("send")
                .long("send")
                .conflicts_with("receive")
                .action(ArgAction::Set)
                .help("Initiate channel to send data")
        )
        .arg(
            Arg::new("receive")
                .long("receive")
                .conflicts_with("send")
                .action(ArgAction::Set)
                .help("Receive data from channel")
        );

    let matches = app.clone().get_matches();

    if matches.is_present("FULLHELP") {
        app.print_long_help().unwrap();
        std::process::exit(0);
    }

    let debug = matches.is_present("debug");
    if debug {
        env_logger::Builder::new()
            .format(|buf, record| {
                writeln!(
                    buf,
                    "{}:{} [{}] {} - {}",
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    record.level(),
                    chrono::Local::now().format("%H:%M:%S.%6f"),
                    record.args()
                )
            })
            .filter(None, log::LevelFilter::Trace)
            .init();
    } else {
        env_logger::init();
    }

    if matches.is_present("send") {
        let filename = matches.get_one::<String>("send").unwrap().clone();
        server::main(&filename).await.unwrap()
    } else if matches.is_present("receive") {
        let session_id = matches.get_one::<String>("receive").unwrap().clone();
        client::main(&session_id).await.unwrap()
    } else {
        println!("One of the modes is required");
    }
}