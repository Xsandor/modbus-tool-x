import {csv} from '#preload';
import * as Papa from 'papaparse';

export default function useCSV() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function saveCSV(data: any, source: string) {
    const text = Papa.unparse(data);
    csv.save(text, source);
  }

  return {
    saveCSV,
  };
}
