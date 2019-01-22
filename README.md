# dolphin-textures

Requirements: 
Node 10.13

Installation:
`npm i`

Usage:

Copy the texture folder from `Dolphin Emulator/Dump/Textures/[gameid]`

`npm run sort [gameid]`


-Textures with an alpha channel are moved to the `alpha` folder while those without one are moved to `nonalpha`

-Textures that match some specific resolutions are moved the the `fmv` folder. This was useful for Metroid Prime, where each frame of a FMV was dumped to a texture. Your mileage may vary with other games

-Files mentioned in `include/[gameid].txt` are excluded from the above rules

-Files mentioned in `ignore/[gameid].txt` are always moved to `ignore`
