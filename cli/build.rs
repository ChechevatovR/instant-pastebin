fn main() {
    println!("cargo::rustc-link-lib=sdl2-doom-lib");
    println!("cargo::rustc-link-search=./games/sdl2-doom/build");
}
