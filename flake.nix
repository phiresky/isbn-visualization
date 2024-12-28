{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    #rust-overlay = {
    #  url = "github:oxalica/rust-overlay";
    #  inputs = {
    #    nixpkgs.follows = "nixpkgs";
    #  };
    #};
  };
  outputs = { self, nixpkgs, flake-utils, /*rust-overlay*/ }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          #overlays = [ (import rust-overlay) ];
          pkgs = import nixpkgs {
            inherit system /*overlays*/;
          };
          #rustToolchain = pkgs.pkgsBuildHost.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
          #nativeBuildInputs = with pkgs; [ rustToolchain pkg-config wasm-bindgen-cli ];
          buildInputs = with pkgs; [ pnpm openssl nodejs ];
        in
        with pkgs;
        {
          devShells.default = mkShell {
            # 👇 and now we can just inherit them
            inherit buildInputs /*nativeBuildInputs*/;
            # shellHook = ''
            #   # For rust-analyzer 'hover' tooltips to work.
            #   export RUST_SRC_PATH=${pkgs.rustPlatform.rustLibSrc}
            # '';
          };
        }
      );
}
