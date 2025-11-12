{
  description = "instant pb cli";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs@{ flake-parts, nixpkgs, fenix, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];

      perSystem = { pkgs, system, ... }:
        {
          _module.args.pkgs = import inputs.nixpkgs {
            inherit system;
            overlays = [
              fenix.overlays.default
            ];
          };

          devShells.default = pkgs.mkShell {
            buildInputs = with pkgs; [
              (pkgs.fenix.complete.withComponents [
                "cargo"
                "clippy"
                "rust-src"
                "rustc"
                "rustfmt"
              ])
              rust-analyzer-nightly
              pkg-config
              openssl

              # Doom
              cmake
              SDL2
              SDL2_mixer
            ];
            shellHook = ''
                export LD_LIBRARY_PATH="''${LD_LIBRARY_PATH:+LD_LIBRARY_PATH:}${pkgs.lib.makeLibraryPath (with pkgs; [ openssl ])}:$PWD/games/sdl2-doom/build";
            '';
          };
        };
    };
}
