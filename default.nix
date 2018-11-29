#with import (builtins.fetchTarball "https://nixos.org/channels/nixpkgs-unstable/nixexprs.tar.xz") {};
with (import <nixpkgs> {});

mkShell {
  buildInputs = [
    nodejs-8_x nodePackages_8_x.pnpm
  ];
}

