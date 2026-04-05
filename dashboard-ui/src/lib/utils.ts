import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes safely.
 * It combines clsx for conditional classes and tailwind-merge to handle 
 * class priority (e.g., overriding padding-2 with padding-4).
 * 
 * Performance: O(n) where n is the number of class strings.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
