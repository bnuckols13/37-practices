/**
 * The engine's English ear: loads the CMU Pronouncing Dictionary into
 * lib/english.mjs once, for Node. The Workshop page loads the same dictionary
 * from a CDN instead, so english.mjs itself stays free of imports.
 */
import { dictionary } from 'cmu-pronouncing-dictionary';
import { useDictionary } from './english.mjs';

useDictionary(dictionary);
export { dictionary };
