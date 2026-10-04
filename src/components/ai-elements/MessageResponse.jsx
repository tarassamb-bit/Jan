import { memo } from "react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { defaultRemarkPlugins, Streamdown } from "streamdown";
import { isDriveFileLink, remarkDriveLinks } from "./drive-links.js";
import { isGmailComposeLink, remarkGmailLinks } from "./gmail-links.js";

const streamdownPlugins = { cjk, code, math, mermaid };
const remarkPlugins = [...Object.values(defaultRemarkPlugins), remarkGmailLinks, remarkDriveLinks];
const linkSafety = { enabled: true, onLinkCheck: isGmailComposeLink };
const driveLogo = "https://logos.composio.dev/api/googledrive";

function DriveLink({ href, children }) {
  if (!isDriveFileLink(href)) return <span>{children}</span>;
  return <a className="jan-drive-link" href={href} target="_blank" rel="noopener noreferrer"><img src={driveLogo} alt="" aria-hidden="true" />{children}</a>;
}

const components = { "drive-link": DriveLink };
const allowedTags = { "drive-link": ["href"] };

export const MessageResponse = memo(
  ({ className = "", children, ...props }) => (
    <Streamdown
      className={`message-response ${className}`.trim()}
      plugins={streamdownPlugins}
      remarkPlugins={remarkPlugins}
      linkSafety={linkSafety}
      components={components}
      allowedTags={allowedTags}
      {...props}
    >
      {children}
    </Streamdown>
  ),
  (previous, next) => previous.children === next.children && previous.isAnimating === next.isAnimating,
);

MessageResponse.displayName = "MessageResponse";
