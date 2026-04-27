# demo

Source for the README demo asset (`docs/demo.gif`). Built with [Remotion](https://www.remotion.dev/).

## Re-render

```bash
cd demo
npm install
npm run render:mp4   # → demo/out/demo.mp4
```

Then convert to a palette-optimised GIF:

```bash
ffmpeg -y -i out/demo.mp4 -vf "fps=20,scale=900:-1:flags=lanczos,palettegen=stats_mode=diff" out/palette.png
ffmpeg -y -i out/demo.mp4 -i out/palette.png -filter_complex "[0:v]fps=20,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 out/demo.gif
cp out/demo.gif out/demo.mp4 ../docs/
```

## Live preview

```bash
npm run studio
```

Opens the Remotion Studio at <http://localhost:3000> for scrubbing and tweaking. Edit `src/AgentlightsDemo.tsx` for layout/timing, `src/Pane.tsx` for per-pane visuals, `src/scripts.ts` for the fake Claude output streamed in each pane.
