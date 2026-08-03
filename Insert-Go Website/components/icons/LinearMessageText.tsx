import type { IconProps } from "./types";

// body string is emitter-controlled <path> markup only (cashie icon set)
const body = "<path d=\"M 14 -0.75 L 6 -0.75 L 6 0.75 L 14 0.75 L 14 -0.75 Z M 6 -0.75 C 3.884 -0.75 2.16 -0.221 0.97 0.97 C -0.221 2.16 -0.75 3.884 -0.75 6 L 0.75 6 C 0.75 4.116 1.221 2.84 2.03 2.03 C 2.84 1.221 4.116 0.75 6 0.75 L 6 -0.75 Z M -0.75 6 L -0.75 19 L 0.75 19 L 0.75 6 L -0.75 6 Z M -0.75 19 C -0.75 19.964 0.036 20.75 1 20.75 L 1 19.25 C 0.864 19.25 0.75 19.136 0.75 19 L -0.75 19 Z M 1 20.75 L 14 20.75 L 14 19.25 L 1 19.25 L 1 20.75 Z M 14 20.75 C 16.116 20.75 17.84 20.221 19.03 19.03 C 20.221 17.84 20.75 16.116 20.75 14 L 19.25 14 C 19.25 15.884 18.779 17.16 17.97 17.97 C 17.16 18.779 15.884 19.25 14 19.25 L 14 20.75 Z M 20.75 14 L 20.75 6 L 19.25 6 L 19.25 14 L 20.75 14 Z M 20.75 6 C 20.75 3.884 20.221 2.16 19.03 0.97 C 17.84 -0.221 16.116 -0.75 14 -0.75 L 14 0.75 C 15.884 0.75 17.16 1.221 17.97 2.03 C 18.779 2.84 19.25 4.116 19.25 6 L 20.75 6 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 2 2)\"/><path d=\"M 0 -0.75 C -0.414 -0.75 -0.75 -0.414 -0.75 0 C -0.75 0.414 -0.414 0.75 0 0.75 L 0 -0.75 Z M 10 0.75 C 10.414 0.75 10.75 0.414 10.75 0 C 10.75 -0.414 10.414 -0.75 10 -0.75 L 10 0.75 Z M 0 0.75 L 10 0.75 L 10 -0.75 L 0 -0.75 L 0 0.75 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 7 9.500)\"/><path d=\"M 0 -0.75 C -0.414 -0.75 -0.75 -0.414 -0.75 0 C -0.75 0.414 -0.414 0.75 0 0.75 L 0 -0.75 Z M 7 0.75 C 7.414 0.75 7.75 0.414 7.75 0 C 7.75 -0.414 7.414 -0.75 7 -0.75 L 7 0.75 Z M 0 0.75 L 7 0.75 L 7 -0.75 L 0 -0.75 L 0 0.75 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 7 9.500) matrix(1 0 0 1 0 5)\"/>";

export function LinearMessageText({ size = 20, className }: IconProps) {
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
