{
  description = "instant pb frontend";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    denv = {
      url = "github:iliayar/env.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs@{ flake-parts, denv, ... }:
    flake-parts.lib.mkFlake { inputs = denv.inputs; } {
      imports = [ denv.flakeModules.default ];
      systems =
        [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      perSystem = { config, self', inputs', pkgs, system, ... }: {
        denvs.default = {
            denv.packages = with pkgs; [
                nodejs

                typescript-language-server

                # Doom

                # How to fix emscripted
                # cp -r /nix/store/ajv94air67dbyjramrjlv0y6j969hsyx-emscripten-2.0.27/share/emscripten/cache ~/.emscripten_cache
                # chmod u+rwX -R ~/.emscripten_cache
                # export EM_CACHE=~/.emscripten_cache
                emscripten
                SDL2
                SDL2_image
                SDL2_ttf
            ];

            denv.env.EM_CACHE = "$HOME/.emscripten_cache";
        };
      };
      flake = { };
    };
}
