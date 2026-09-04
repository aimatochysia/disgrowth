# Scene art plates

The store ships with SVG silhouettes so it can launch without commissioned painting.
If you illustrate plates solely for this site, drop files here using these names. The server
detects them at boot and swaps the matching layer.

| File | Layer | Notes |
| --- | --- | --- |
| `sky-day.jpg` (or `.webp` / `.png`) | Day sky | Full-bleed, horizon in the lower third |
| `sky-night.jpg` (or `.webp` / `.png`) | Night sky | Same camera as day sky |
| `far.png` | Distant ridge / overgrown skyline | Transparent PNG, sit on the bottom edge |
| `mid.png` | Forest + ruined exchange hall | Transparent PNG |
| `near.png` | Foreground grove / ferns | Transparent PNG |

Keep a shared horizon line across `far` / `mid` / `near` so parallax does not tear.
Day and night can be the same drawings if you grade them in the file; the CSS still
cross-fades the two skies.

Do not put Discord branding in the plates.
