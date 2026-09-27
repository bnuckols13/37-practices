/**
 * Unicode Tibetan to Wylie (EWTS), by BDRC's converter (jsewts). Its "_" marks a
 * space in the Tibetan (between shads, "/_/"); here that is an ordinary space.
 */
import J from 'jsewts';

export const tibetanToWylie = s => J.toWylie(String(s).normalize('NFC')).replace(/_/g, ' ').replace(/ {2,}/g, ' ').trim();
