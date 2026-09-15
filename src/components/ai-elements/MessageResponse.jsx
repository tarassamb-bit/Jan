import { memo } from "react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown } from "streamdown";

const streamdownPlugins = { cjk, code, math, mermaid };

export const MessageResponse = memo(
  ({ className = "", children, ...props }) => (
    <Streamdown
      className={`message-response ${className}`.trim()}
      plugins={streamdownPlugins}
      {...props}
    >
      {children}
    </Streamdown>
  ),
  (previous, next) => previous.children === next.children && previous.isAnimating === next.isAnimating,
);

MessageResponse.displayName = "MessageResponse";
