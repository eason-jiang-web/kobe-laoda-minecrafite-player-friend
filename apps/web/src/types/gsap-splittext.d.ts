declare module "gsap/SplitText" {
  import type { gsap } from "gsap";

  export type SplitTextConfig = {
    type?: string;
    linesClass?: string;
    wordsClass?: string;
    charsClass?: string;
    autoSplit?: boolean;
    mask?: "lines" | "words" | "chars" | boolean;
    onSplit?: (self: SplitText) => gsap.core.Animation | void;
  };

  export class SplitText {
    lines: Element[];
    words: Element[];
    chars: Element[];
    masks?: Element[];

    constructor(targets: Element | Element[] | string, config?: SplitTextConfig);
    revert(): void;

    static create(targets: Element | Element[] | string, config?: SplitTextConfig): SplitText;
    static register(core: typeof gsap): void;
  }

  export default SplitText;
}
