// Diff highlighter utility for Slate editor
// This file will contain functions to compute and apply diff decorations

import { diff_match_patch } from 'diff-match-patch';
import { Editor, Node, Range } from 'slate';

export type CharDiff = { text: string; type: 'added' | 'removed' | 'unchanged' };

export type Decoration = {
  start: number;
  end: number;
  added?: boolean;
  removed?: boolean;
  text?: string;
};

export function getCharDiff(oldStr: string, newStr: string): CharDiff[] {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(oldStr, newStr);
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map((diff: [number, string]) => {
    const [type, text] = diff;
    switch (type) {
      case 1: // INSERT
        return { text, type: 'added' as const };
      case -1: // DELETE
        return { text, type: 'removed' as const };
      case 0: // EQUAL
        return { text, type: 'unchanged' as const };
      default:
        return { text, type: 'unchanged' as const };
    }
  });
}



export function createUnifiedDiff(oldStr: string, newStr: string): { 
  combinedText: string; 
  decorations: Decoration[] 
} {
  console.log(">>> createUnifiedDiff is getting diffs: ", oldStr, newStr);
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(oldStr, newStr);
  dmp.diff_cleanupSemantic(diffs);
  
  let combinedText = '';
  const decorations: Decoration[] = [];
  let currentOffset = 0;
  
  for (const diff of diffs) {
    const [type, text] = diff;
    
    if (type === 1) { // INSERT - add new text
      console.log(">>> createUnifiedDiff is adding new text: ", text);
      console.log(">>> createUnifiedDiff currentOffset: ", currentOffset);
      decorations.push({
        start: currentOffset,
        end: currentOffset + text.length,
        added: true
      });
      combinedText += text;
      console.log(">>> createUnifiedDiff combinedText: ", combinedText);
      currentOffset += text.length;
    } else if (type === -1) { // DELETE - keep old text with strikethrough
      decorations.push({
        start: currentOffset,
        end: currentOffset + text.length,
        removed: true
      });
      combinedText += text;
      currentOffset += text.length;
    } else { // EQUAL - unchanged text
      combinedText += text;
      currentOffset += text.length;
    }
  }
  // add text content to decorations
  decorations.forEach((decoration) => {
    decoration.text = combinedText.slice(decoration.start, decoration.end);
  });
  console.log(">>> createUnifiedDiff returning decorations: ", decorations);
  return { combinedText, decorations };
}

export {}; 