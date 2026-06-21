"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  return <Sonner theme={theme as ToasterProps["theme"]} className="toaster group" {...props} />;
};

export { Toaster };
