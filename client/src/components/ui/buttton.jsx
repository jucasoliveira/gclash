import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { ReloadIcon } from "@radix-ui/react-icons";


const buttonVariants = cva(
  `inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50`,
  {
    variants: {
      variant: {
        default:
          "bg-lerio-primary text-primary-foreground hover:text-black hover:bg-lerio-opacity/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input border-lerio-primary text-lerio-primary font-bold bg-background hover:bg-accent hover:text-accent-foreground",
        clear:
          "text-lerio-primary underline-offset-4 hover:text-lerio-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);



const Button = React.forwardRef(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      chevron = false,
      icon,
      iconPosition = "left",
      loading = false,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          icon && (iconPosition === "left" ? "pl-10" : "pr-10"),
          "relative"
        )}
        ref={ref}
        {...props}
      >
        {loading && (
          // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
          <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
        )}
        {!loading && icon && iconPosition === "left" && (
          <div className="absolute left-0 inset-y-0 flex items-center pl-3 pointer-events-none">
            {icon}
          </div>
        )}
        {props.children}
        {chevron && <ChevronRight className="ml-2" />}
        {!loading && icon && iconPosition === "right" && (
          <div className="absolute right-0 inset-y-0 flex items-center pr-3 pointer-events-none">
            {icon}
          </div>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
