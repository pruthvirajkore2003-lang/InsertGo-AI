import type { IconProps } from "./types";

// body string is emitter-controlled <path> markup only (cashie icon set)
const body = "<path d=\"M 7.5 20.75 C 12.044 20.75 15.75 17.044 15.75 12.5 L 14.25 12.5 C 14.25 16.216 11.216 19.25 7.5 19.25 L 7.5 20.75 Z M 15.75 12.5 L 15.75 7.5 L 14.25 7.5 L 14.25 12.5 L 15.75 12.5 Z M 15.75 7.5 C 15.75 2.956 12.044 -0.75 7.5 -0.75 L 7.5 0.75 C 11.216 0.75 14.25 3.784 14.25 7.5 L 15.75 7.5 Z M 7.5 -0.75 C 2.956 -0.75 -0.75 2.956 -0.75 7.5 L 0.75 7.5 C 0.75 3.784 3.784 0.75 7.5 0.75 L 7.5 -0.75 Z M -0.75 7.5 L -0.75 12.5 L 0.75 12.5 L 0.75 7.5 L -0.75 7.5 Z M -0.75 12.5 C -0.75 17.044 2.956 20.75 7.5 20.75 L 7.5 19.25 C 3.784 19.25 0.75 16.216 0.75 12.5 L -0.75 12.5 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 4.500 2)\"/><path d=\"M 1.5 4.25 C 1.084 4.25 0.75 3.916 0.75 3.5 L -0.75 3.5 C -0.75 4.744 0.256 5.75 1.5 5.75 L 1.5 4.25 Z M 0.75 3.5 L 0.75 1.5 L -0.75 1.5 L -0.75 3.5 L 0.75 3.5 Z M 0.75 1.5 C 0.75 1.084 1.084 0.75 1.5 0.75 L 1.5 -0.75 C 0.256 -0.75 -0.75 0.256 -0.75 1.5 L 0.75 1.5 Z M 1.5 0.75 C 1.909 0.75 2.25 1.087 2.25 1.5 L 3.75 1.5 C 3.75 0.253 2.731 -0.75 1.5 -0.75 L 1.5 0.75 Z M 2.25 1.5 L 2.25 3.5 L 3.75 3.5 L 3.75 1.5 L 2.25 1.5 Z M 2.25 3.5 C 2.25 3.913 1.909 4.25 1.5 4.25 L 1.5 5.75 C 2.731 5.75 3.75 4.747 3.75 3.5 L 2.25 3.5 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 10.500 6)\"/><path d=\"M -0.75 4 C -0.75 4.414 -0.414 4.75 0 4.75 C 0.414 4.75 0.75 4.414 0.75 4 L -0.75 4 Z M 0.75 0 C 0.75 -0.414 0.414 -0.75 0 -0.75 C -0.414 -0.75 -0.75 -0.414 -0.75 0 L 0.75 0 Z M 0.75 4 L 0.75 0 L -0.75 0 L -0.75 4 L 0.75 4 Z\" fill=\"currentColor\" fill-rule=\"nonzero\" transform=\"matrix(1 0 0 1 12 2)\"/>";

export function LinearMouse({ size = 20, className }: IconProps) {
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
