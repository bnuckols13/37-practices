# Reading Room fonts

`render` copies these into `translations/assets/fonts/`, so the published pages load no fonts from Google or anyone else.

| File | What it is | Licence |
|---|---|---|
| `IlluminatedText-{Regular,Italic,Bold}.woff2` | A subset of **Gentium Book Plus 6.200** by SIL International, made to keep its real small caps (Google Fonts' copy strips them). It covers Latin, Latin Extended, IAST and punctuation, with every OpenType feature kept. | SIL Open Font License 1.1 (`OFL.txt`) |
| `NotoSerifTibetan-Tibetan.woff2` | The Tibetan block (U+0F00–0FFF) of **Noto Serif Tibetan** 2.001, copyright 2018 Google LLC, from Ubuntu's `fonts-noto-core` package, subset with every OpenType feature kept (the stacking of Tibetan letters needs them). Noto declares no Reserved Font Name, so the subset keeps its name. | SIL Open Font License 1.1 |
| `TiroBangla-Bengali.woff2` | The Bengali range of **Tiro Bangla** 1.52, copyright 2020 The Indigo Project Authors (Tiro Typeworks), as Google Fonts serves it, unmodified. | SIL Open Font License 1.1 |

**Why the Gentium subset is renamed.** "Gentium" and "SIL" are Reserved Font Names, and the OFL FAQ (2.6) counts a subset as a modified version, which may not use them. The copyright and licence records inside each font are kept, and its description names the original.

**How the subset was made** (from Ubuntu's `fonts-sil-gentiumplus` 6.200 package, with fontTools):

```sh
pyftsubset GentiumBookPlus-Regular.ttf \
  --unicodes="U+0000-00FF,U+0100-017F,U+0180-024F,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+20AC,U+2100-214F,U+2190-21FF,U+2212,U+25CC" \
  --layout-features='*' --name-IDs='*' --name-legacy --name-languages='*' \
  --flavor=woff2 --no-hinting --desubroutinize
```

The same command was run for Italic and Bold. Noto Serif Tibetan was subset the same way with `--unicodes="U+0020,U+00A0,U+0F00-0FFF,U+25CC"`. The name records were then changed from "Gentium Book Plus" to "Illuminated Text".
