use crate::wordle::GuessLetterResult::{GRAY, GREEN, YELLOW};
use crate::wordle::GuessResult::{Loss, TryAgain, Win};
use colored::Colorize;
use rand::prelude::IndexedRandom;
use std::io;

pub struct Wordle {
    word: &'static str,
    pub attempts_left: u8,
}

const WORDS: [&str; 4] = [
    "abeam",
    "abear",
    "abeat",
    "abeng"
];

impl Default for Wordle {
    fn default() -> Self {
        Wordle {
            word: WORDS.choose(&mut rand::rng()).unwrap().to_owned(),
            attempts_left: 5
        }
    }
}

impl Wordle {
    pub fn play() -> Option<()> {
        let mut wordle = Wordle::default();
        println!("Take a guess in this nice game of Wordle: ");
        loop {
            let mut line = String::new();
            io::stdin().read_line(&mut line).expect("Could not read line");
            line = line.trim().to_lowercase();
            if line.len() != 5 {
                println!("Guess a 5-letter word");
                continue
            }
            let guess_result = wordle.guess(line.clone());
            match guess_result {
                Win => {
                    println!("You win!");
                    break Some(())
                }
                Loss => {
                    println!("No guesses left");
                    break None
                }
                TryAgain { result } => {
                    for i in 0..result.len() {
                        match result[i] {
                            GRAY => {print!("{}", line.chars().nth(i).unwrap());}
                            YELLOW => { print!("{}", String::from(line.chars().nth(i).unwrap()).yellow()); }
                            GREEN => { print!("{}", String::from(line.chars().nth(i).unwrap()).green()); }
                        }
                    }
                    println!();
                }
            }
        }
    }

    pub fn guess(&mut self, guess: String) -> GuessResult {
        if self.attempts_left == 0  {
            return Loss
        };
        self.attempts_left -= 1;
        if guess == self.word  {
            return Win
        }
        if self.attempts_left == 0  {
            return Loss
        }
        TryAgain {
            result: [
                self.guess_letter(guess.chars().nth(0).unwrap(), 0),
                self.guess_letter(guess.chars().nth(1).unwrap(), 1),
                self.guess_letter(guess.chars().nth(2).unwrap(), 2),
                self.guess_letter(guess.chars().nth(3).unwrap(), 3),
                self.guess_letter(guess.chars().nth(4).unwrap(), 4)
            ]
        }
    }

    fn guess_letter(&self, letter: char, pos: usize) -> GuessLetterResult {
        if letter.eq_ignore_ascii_case(&self.word.chars().nth(pos).unwrap()) {
            return GREEN
        };
        for i in 0..5 {
            if letter.eq_ignore_ascii_case(&self.word.chars().nth(i).unwrap()) {
                return YELLOW
            }
        }
        GRAY
    }
}

enum GuessResult {
    Win,
    Loss,
    TryAgain {result: [GuessLetterResult; 5]},
}

enum GuessLetterResult {
    GRAY,
    YELLOW,
    GREEN
}