{
  description = "amdl";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default-linux";
  };

  outputs = { self, nixpkgs, systems, ... }:
    let
      inherit (nixpkgs) lib;
      eachSystem = lib.genAttrs (import systems);
      pkgsFor = eachSystem (system: import nixpkgs { inherit system; });
      package = builtins.fromJSON (builtins.readFile ./package.json);
    in {
      packages = eachSystem (system: let
        inherit (lib) makeBinPath;
        pkgs = pkgsFor.${system};
      in rec {
        default = amdl;
        amdl = pkgs.buildNpmPackage rec {
          pname = package.name;
          inherit (package) version;

          # uncomment this and let the build fail, then get the current hash
          # very scuffed but endorsed!
          # npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
          npmDepsHash = "sha256-1p/QMZQoFwXxXxlTYTtdHQ3O7p+RSzD3RpoKRB40CHg=";

          nativeBuildInputs = with pkgs; [ makeWrapper ];

          buildInputs = with pkgs; [ ffmpeg yt-dlp ];

          installPhase = ''
            runHook preInstall

            mkdir -p $out
            mv node_modules dist views public $out/
            makeWrapper ${pkgs.nodejs-slim}/bin/node $out/bin/amdl \
              --prefix PATH : ${makeBinPath buildInputs} \
              --add-flags "$out/dist/src/index.js" \
              --set VIEWS_DIR $out/views \
              --set PUBLIC_DIR $out/public

            runHook postInstall
          '';

          src = ./.;

          meta.mainProgram = package.name;
        };
      });

      devShells = eachSystem (system: let
        pkgs = pkgsFor.${system};
      in {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            nodePackages.npm

            ffmpeg yt-dlp
          ];
        };
      });

      nixosModules = rec {
        default = amdl;
        amdl = { config, lib, pkgs, ... }: let
          inherit (pkgs) system;
          inherit (lib) getExe mkEnableOption mkIf mkOption types;
          cfg = config.services.amdl;
        in {
          options = {
            services.amdl = {
              enable = mkEnableOption "enable amdl";
              package = mkOption {
                type = types.package;
                default = self.packages.${system}.amdl;
              };
              stateDir = mkOption {
                type = types.path;
                default = "/var/lib/amdl";
              };
              user = mkOption {
                type = types.str;
                default = "amdl";
              };
              group = mkOption {
                type = types.str;
                default = "amdl";
              };
              config = {
                server = {
                  port = mkOption {
                    type = types.int;
                    default = 2000;
                  };
                  frontend = {
                    search_count = mkOption {
                      type = types.int;
                      default = 5;
                    };
                    displayed_codecs = mkOption {
                      type = types.listOf types.str;
                      default = ["aac_legacy" "aac_he_legacy"];
                    };
                  };
                };
                downloader = {
                  ffmpeg_path = mkOption {
                    type = types.str;
                    default = "ffmpeg";
                  };
                  ytdlp_path = mkOption {
                    type = types.str;
                    default = "yt-dlp";
                  };
                  cache = {
                    directory = mkOption {
                      type = types.str;
                      default = "cache";
                    };
                    ttl = mkOption {
                      type = types.int;
                      default = 3600;
                    };
                  };
                  api = {
                    language = mkOption {
                      type = types.str;
                      default = "en-US";
                    };
                  };
                };
              };
              env = {
                MEDIA_USER_TOKEN = mkOption {
                  type = types.str;
                };
                ITUA = mkOption {
                  type = types.str;
                  default = "US";
                };
                WIDEVINE_CLIENT_ID = mkOption {
                  type = types.str;
                };
                WIDEVINE_PRIVATE_KEY = mkOption {
                  type = types.str;
                };
                # do NOT include views/public directory here
                # we set that in the wrapper script of the program, so it wouldn't even do anything
                # probably shouldn't change it anyway... bad idea
              };
            };
          };

          config =  let
            toml = pkgs.formats.toml { };
          in mkIf cfg.enable {
            systemd.services.amdl = {
              description = "amdl";
              after = [ "network.target" ];
              wantedBy = [ "multi-user.target" ];

              preStart = ''
                config='${cfg.stateDir}/config.toml'
                cp -f '${toml.generate "config.toml" cfg.config}' "$config"
              ''; # TODO: symlink instead of cp, shouldn't matter for reproducibility since its preStart but whatever

              serviceConfig = {
                Type = "simple";
                User = cfg.user;
                Group = cfg.group;
                WorkingDirectory = cfg.stateDir;
                ExecStart = "${getExe cfg.package}";
                Restart = "always";
                RuntimeDirectory = "amdl";
                RuntimeDirectoryMode = "0755";
              };

              environment = {
                MEDIA_USER_TOKEN = cfg.env.MEDIA_USER_TOKEN;
                ITUA = cfg.env.ITUA;
                WIDEVINE_CLIENT_ID = cfg.env.WIDEVINE_CLIENT_ID;
                WIDEVINE_PRIVATE_KEY = cfg.env.WIDEVINE_PRIVATE_KEY;
              }; # TODO: write some function to do this, also is this safe??
            };

            users.users = mkIf (cfg.user == "amdl") {
              amdl = {
                home = cfg.stateDir;
                group = cfg.group;
                createHome = true;
                isSystemUser = true;
                useDefaultShell = true;
              };
            };
            users.groups = mkIf (cfg.group == "amdl") {
              amdl = { };
            };
          };
        };
      };
    };
}
