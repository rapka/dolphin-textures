## *Looking for texture packs download links? see [PACKS.md](PACKS.md)*

# dolphin-textures
This is a script for batch upscaling of images with [ESRGAN](https://github.com/xinntao/ESRGAN). It is designed to be used with textures dumped from the Dolphin Gamecube/Wii emulator, but can be used for any images.

# Requirements
All the requirements for running ESRGAN by itself still apply. They are detailed in [this blog post](https://kingdomakrillic.tumblr.com/post/178254875891/i-figured-out-how-to-get-esrgan-and-sftgan).

Additionally, Node.js v10 is required, which can be downloaded [here](https://nodejs.org/en/download/)

# Usage

1. First, run `npm install`. This will download my fork of ESRGAN as well as any other required libraries
2. Copy the folder containing your images to `input`. The name of this folder doesn't matter, but it will need to be reused later. The rest of these instructions will refer to this folder as `gameID`, since that's the naming scheme Dolphin uses. Because some images may be deleted, I recommend making a backup first.
3. Any images you don't want to be upscaled can be added to `ignore/[gameID].txt`. Similarly, any images that you aboslutely want to be upscaled can be added to `include/[gameID].txt`. My personal settings for some games are already included.
4. Run `npm run upscale [gameid]`!
5. Your upscaled images will (eventually) be in `output/[gameID]/alpha-final` and `output/[gameID]/nonalpha-final`. Any ignored images will be untouched and moved to `output/gameID/ignored`.
6. If you're planning on distrubiting these results as a texture pack for Dolphin, consider converting the images from PNG to DDS using the [Custom Texture Tool](https://forums.dolphin-emu.org/Thread-custom-texture-tool-ps-v38-0) for performance reasons

# Implementation details
Before upscaling, the script does a few checks to make sure each image is actually worth upscaling:
* Images that contain `_mip` in the filename are treated as uselss mipmaps and deleted.
* Because Dolphin dumps individual frames from FMV movies in some games, some dumped textures should be ignored. To that end, the script ignores files whose name contains one of the strings in `ignore_patterns.txt`. The file comes prefilled with several resolutions I've found it helpful to ignore. To enable one, remove the `// ` from the line it's on. 
** Note that regular expressions can be used in this file as well.
* Any images that are uniformly one color are deleted because upscaling them would be a waste of time
* ESRGAN doesn't know how to handle images with transparency. To get around this limitation, transparent images have their alpha channels extracted into a separate channel to be upscaled independently. These upscaled images are then gamma corrected to account for noise introduced by the algorithm and are then merged back into the main image.
* For debugging purposes, the rest of the folders in `output` contain intermediary images used during this process.
