import React, { useState, useRef } from "react";
import PropTypes from "prop-types";

const Tooltip = ({ children, content, position = "top", color = "dark", delay = 300, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const hasOpenChild = () => {
    if (!triggerRef.current) return false;
    return triggerRef.current.querySelector('[data-state="open"]') !== null;
  };

  const handleMouseEnter = () => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => {
      if (triggerRef.current && !hasOpenChild()) {
        setIsVisible(true);
      }
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const colorClasses = {
    dark: "bg-gray-800 text-white",
    light: "bg-gray-100 text-gray-800 border border-gray-300",
    primary: "bg-blue-500 text-white",
    success: "bg-green-500 text-white",
    warning: "bg-yellow-500 text-white",
    danger: "bg-red-500 text-white",
  };

  const positionClasses = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  };

  const arrowClasses = {
    top: "left-1/2 top-full -mt-1 -translate-x-1/2",
    bottom: "bottom-full left-1/2 -mb-1 -translate-x-1/2",
    left: "left-full top-1/2 -ml-1 -translate-y-1/2",
    right: "right-full top-1/2 -mr-1 -translate-y-1/2",
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      data-tooltip={typeof content === "string" ? content : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && !hasOpenChild() && (
        <div
          className={`pointer-events-none absolute z-[9999] px-3 py-2 rounded-md text-sm whitespace-nowrap shadow-lg ${positionClasses[position]} ${colorClasses[color]}`}
          translate="no"
        >
          {content}
          <div
            className={`absolute w-2 h-2 rotate-45 ${arrowClasses[position]} ${colorClasses[color].split(" ")[0]}`}
          />
        </div>
      )}
    </div>
  );
};

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  position: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  color: PropTypes.oneOf(["dark", "light", "primary", "success", "warning", "danger"]),
  delay: PropTypes.number,
  className: PropTypes.string,
};

export default Tooltip;
