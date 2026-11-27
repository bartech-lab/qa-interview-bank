# Fonts

Embedded in `dist/index.html` by `tools/build.py`: each `url(fonts/<file>.woff2)` in `src/style.css` becomes a `data:` URI, and `OFL.txt` becomes the licence comment at the end of the page. Licence and copyright: `OFL.txt`.

| File | Made from | Weights |
|---|---|---|
| `qa-bank-serif-roman.woff2` | `@fontsource-variable/source-serif-4` 5.3.1, `source-serif-4-latin-wght-normal.woff2` | 400 to 650 |
| `qa-bank-serif-italic.woff2` | same package, `source-serif-4-latin-wght-italic.woff2` | 400 |
| `public-sans.woff2` | `@fontsource-variable/public-sans` 5.3.0, `public-sans-latin-wght-normal.woff2` | 400 to 700 |

Steps: `fonttools varLib.instancer <file> wght=<range>`, then `pyftsubset --unicodes="U+0020-007E,U+00A0-00FF,U+0141,U+0142,U+0301,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2022,U+2190-2193,U+2264,U+2265,U+2212,U+20AC" --layout-features='kern,liga,calt,tnum,lnum' --flavor=woff2`. Source Serif 4 reserves the name "Source", so the two serif files are renamed to "QA Bank Serif" in their name table (OFL condition 3).
