import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/utils/assetUrl";

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("avatar-container", className)}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  src,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  const resolvedSrc = resolveAssetUrl(typeof src === "string" ? src : undefined);

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("avatar-image", className)}
      src={resolvedSrc}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("avatar-fallback", className)}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
