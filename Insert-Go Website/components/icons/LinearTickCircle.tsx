import type { IconProps } from "./types";

// body string is emitter-controlled <path> markup only (cashie icon set)
const body = "<path d=\"M 10 20.75 C 15.914 20.75 20.75 15.914 20.75 10 L 19.25 10 C 19.25 15.086 15.086 19.25 10 19.25 L 10 20.75 Z M 20.75 10 C 20.75 4.086 15.914 -0.75 10 -0.75 L 10 0.75 C 15.086 0.75 19.25 4.914 19.25 10 L 20.75 10 Z M 10 -0.75 C 4.086 -0.75 -0.75 4.086 -0.75 10 L 0.75 10 C 0.75 4.914 4.914 0.75 10 0.75 L 10 -0.75 Z M -0.75 10 C -0.75 15.914 4.086 20.75 10 20.75 L 10 19.25 C 4.914 19.25 0.75 15.086 0.75 10 L -0.75 10 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 2 2)\"/><path d=\"M 0.53 2.3 C 0.237 2.007 -0.237 2.007 -0.53 2.3 C -0.823 2.593 -0.823 3.067 -0.53 3.36 L 0.53 2.3 Z M 2.83 5.66 L 2.3 6.19 C 2.592 6.483 3.067 6.483 3.36 6.191 L 2.83 5.66 Z M 9.03 0.531 C 9.323 0.238 9.323 -0.237 9.031 -0.53 C 8.738 -0.823 8.263 -0.823 7.97 -0.531 L 9.03 0.531 Z M -0.53 3.36 L 2.3 6.19 L 3.36 5.13 L 0.53 2.3 L -0.53 3.36 Z M 3.36 6.191 L 9.03 0.531 L 7.97 -0.531 L 2.3 5.129 L 3.36 6.191 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 7.750 9.170)\"/>";

export function LinearTickCircle({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
