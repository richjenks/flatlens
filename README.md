# FlatLens

3D video on any screen.

FlatLens helps you watch 3D content on regular screens by cropping and/or correcting equirectangular distortion.

It doesn't make 2D videos 3D nor make images pop out, but it does make 3D content appear more natural on 2D displays without requiring specialist hardware.

## Why FlatLens Exists

FlatLens exists because the only alternatives are either expensive, outdated, or require specialist hardware. Put simply, it exists to allow normal people with normal hardware to watch 3D content in a non-distorted way.

## Usage

```sh
git clone git@github.com:richjenks/flatlens.git
cd flatlens
npm i
npm run e:build
```

You'll find the built app the `dist-electron` folder.

## Features

FlatLens runs video detections (looking at metadata, filename, and resolution) and attempts to auto-configure its settings. If incorrecct, they can be overriden with player controls:

**Layout**:
- Side-by-Side (SBS): Left and right eyes are arranged next to each other.
- Over-Under (OU): The two views are stacked vertically.

**Sizing**:
- Double Size: Half Resolution content needs stretching to appear normal, either vertically or horizontally, depending on the Layout.
- Normal Size: Full Resolution content can simply be displayed as-is, without stretching.

**Projection**:
- Flat: Normal flat projection, suitable for most videos.
- 180º: _Half_ surround VR content with equirectangular correction — inside a half sphere.
- 360º: _Full_ surround VR content with equirectangular correction — inside a full sphere.

**View Modes**:

- Mono Mode: Watch a single "eye" — probably what you want.
- Source Mode: Watch the video as-is, with no eye cropping.
- Anaglyph Mode: Render both eyes with an anaglyph filter for red-cyan glasses — more for fun than practicality.

## Notes

**Layout & Resolution Settings**
Resolution settings change when you swap Layouts. This is because in _SBS Half_, the video must be stretched _horizontally_ but in _OU Half_ the video must be stretched _vertically_. This will make sense if you compare an SBS Half video to an OU Half video in _Source Mode_.

**No Layout/Resolution in Source Mode**
Layout and Resolution settings are disabled in Source Mode. The whole point of Source Mode is to view the video as-is, so Layout and Resolution are disabled and ignored in this mode

**Anaglyph Glasses**
The goal of FlatLens is to play 3D content without specialist hardware. The only exception to this is anaglyph glasses, which are optional (again, for fun rather than practicality) and cheaply available online. FlatLens uses the Dubois (least-squares) algorithm to minimise ghosting and preserve more natural colours when viewed with spectrally correct red–cyan glasses.

**180º and 360º Panoramas**

FlatLens was not designed with the intention of supporting panoramas (single-eye equirectangular content, a.k.a photo spheres) but its settings are independent enough that it does anyway. Change to _Source Mode_ and pick 180º or 360º Projection (as appropriate) and your panorama should display correctly.

## Commands

```sh
npm run dev              # Launch local web development server (live reload)
npm run e:dev            # Launch local Electron app (live reload)

npm run build            # Build distributable web package
npm run e:build          # Build executable for current OS

npm run serve            # Web server for latest dist package (without rebuild)
npm run e:serve          # Electron app for latest dist package (without rebuild)

npm run e:build-all      # Build all executables
npm run e:build-mac      # Build MacOS executable
npm run e:build-windows  # Build Windows executable
npm run e:build-linux    # Build Linux executable
```

## App Icons

1. Ensure ImageMagick is installed: `brew install imagemagick`
2. Put a 1024x1024px PNG at `assets/src/icon.png`
3. Run `npm run icons` to generate all required app icons
