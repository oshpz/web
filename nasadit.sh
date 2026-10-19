#!/usr/bin/env bash
# Nasazení webu, aplikace a serveru do prostředí TEST nebo OSTRY (L0). Podrobně: docs/prostredi.md
#
#   ./nasadit.sh test                         web + aplikace na test.oshpz.cz (tento repozitář, větev main)
#   ./nasadit.sh ostry [--cname novy.oshpz.cz] [--cil ../web-ostry]
#                                             sestavení do repozitáře oshpz/web-ostry (výchozí doména oshpz.cz)
#   ./nasadit.sh ostry --nanecisto [složka]   jen sestaví do složky a zkontroluje, nic necommituje
#   ./nasadit.sh server test|ostry            Apps Script: clasp push + nové nasazení verze (URL se nemění)
#
# Odmítne nasadit, když jsou v repozitáři necommitnuté změny nebo když konfigurace obsahuje DOPLNIT.
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Chybí Node.js (https://nodejs.org) – potřebuje ho sestavení." >&2; exit 1; }
exec node prostredi/nasadit.mjs "$@"
