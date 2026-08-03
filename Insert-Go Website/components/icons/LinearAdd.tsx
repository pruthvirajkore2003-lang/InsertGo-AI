import type { IconProps } from "./types";

// body string is emitter-controlled <path> markup only (cashie icon set)
const body = "<path d=\"M 0 -0.75 C -0.414 -0.75 -0.75 -0.414 -0.75 0 C -0.75 0.414 -0.414 0.75 0 0.75 L 0 -0.75 Z M 12 0.75 C 12.414 0.75 12.75 0.414 12.75 0 C 12.75 -0.414 12.414 -0.75 12 -0.75 L 12 0.75 Z M 0 0.75 L 12 0.75 L 12 -0.75 L 0 -0.75 L 0 0.75 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 6 12)\"/><path d=\"M -0.75 12 C -0.75 12.414 -0.414 12.75 0 12.75 C 0.414 12.75 0.75 12.414 0.75 12 L -0.75 12 Z M 0.75 0 C 0.75 -0.414 0.414 -0.75 0 -0.75 C -0.414 -0.75 -0.75 -0.414 -0.75 0 L 0.75 0 Z M 0.75 12 L 0.75 0 L -0.75 0 L -0.75 12 L 0.75 12 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 12 6)\"/>";

export function LinearAdd({ size = 20, className }: IconProps) {
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
