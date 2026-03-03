#!/bin/zsh
# Подгружаем nvm (или fnm), чтобы в PATH был node
[[ -f "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"
[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc"
exec node "$(dirname "$0")/dist/index.js"
