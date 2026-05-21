"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, className, position = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement>(null);

  const updateCoords = React.useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x = 0;
      let y = 0;

      switch (position) {
        case "top":
          x = rect.left + rect.width / 2;
          y = rect.top;
          break;
        case "bottom":
          x = rect.left + rect.width / 2;
          y = rect.bottom;
          break;
        case "left":
          x = rect.left;
          y = rect.top + rect.height / 2;
          break;
        case "right":
          x = rect.right;
          y = rect.top + rect.height / 2;
          break;
      }
      setCoords({ x: x + window.scrollX, y: y + window.scrollY });
    }
  }, [position]);

  const handleMouseEnter = () => {
    updateCoords();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleFocus = () => {
    updateCoords();
    setIsVisible(true);
  };

  const handleBlur = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      window.addEventListener("scroll", updateCoords);
      window.addEventListener("resize", updateCoords);
    }
    return () => {
      window.removeEventListener("scroll", updateCoords);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isVisible, updateCoords]);

  const clonedChild = React.cloneElement(children as React.ReactElement<any>, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      (children as any).props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      (children as any).props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      handleFocus();
      (children as any).props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      handleBlur();
      (children as any).props.onBlur?.(e);
    },
  });

  return (
    <>
      {clonedChild}
      {isVisible && (
        <div
          className={cn(
            "fixed z-[100] px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg pointer-events-none whitespace-nowrap animate-in fade-in zoom-in duration-150",
            className
          )}
          style={{
            left: coords.x,
            top: coords.y,
            transform: position === "top" ? "translate(-50%, -100%) translateY(-8px)" :
                       position === "bottom" ? "translate(-50%, 0) translateY(8px)" :
                       position === "left" ? "translate(-100%, -50%) translateX(-8px)" :
                       "translate(0, -50%) translateX(8px)"
          }}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <div
            className={cn(
              "absolute w-2 h-2 bg-gray-900 rotate-45",
              position === "top" ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" :
              position === "bottom" ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" :
              position === "left" ? "right-0 top-1/2 translate-x-1/2 -translate-y-1/2" :
              "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2"
            )}
          />
        </div>
      )}
    </>
  );
}
